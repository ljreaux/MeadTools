import { NextRequest, NextResponse } from "next/server";
import {
  chatParamsFromRequest,
  toServerSentEventsResponse,
} from "@tanstack/ai";
import {
  failedProviderReservationAction,
  quoteCreditsForChatUsage,
  reserveCreditsForBoundedChatTurn,
} from "@meadtools/chat-domain";
import { InsufficientCreditsError } from "@meadtools/credit-accounting";
import { buildRecipeDraftInputSchema } from "@meadtools/recipe-workflows";
import { recipeDataV2Schema } from "@meadtools/schemas";
import { z } from "zod";
import {
  chatRequestSchema,
  runDeterministicChatTurn,
  runChatTurn,
  type ChatRequest,
} from "@/lib/ai/chat-service";
import { getChatbotConfig } from "@/lib/ai/chat-config";
import {
  generateChatConversationTitleAfterProviderAttempt,
  type ChatConversationTitleResult,
} from "@/lib/ai/chat-conversation-title";
import { ChatProviderRequestError } from "@/lib/ai/chat-model";
import { requireChatbotUser } from "@/lib/ai/chat-access";
import { OpenAIChatClient } from "@/lib/ai/openai";
import { streamRecipeChatTurn } from "@/lib/ai/tanstack-chat-stream";
import { getIngredientCatalogForChat } from "@/lib/db/ingredients";
import { getAdditiveCatalogForChat } from "@/lib/db/additives";
import { searchYeastsForChat } from "@/lib/db/yeasts";
import {
  chatContextSelectionSchema,
  getSelectedChatContext,
  type SelectedChatContext,
} from "@/lib/ai/chat-account-context";
import {
  completeChatbotUsage,
  getChatbotUsageCheckpoint,
  recordChatbotProviderAttempt,
  recordChatbotUsageProgress,
  recordChatbotUsageStart,
} from "@/lib/db/chatbot-usage";
import {
  CreditFeePolicyNotConfiguredError,
  CreditPricingNotConfiguredError,
  getActiveCreditFeePolicy,
  getActiveCreditPricing,
} from "@/lib/db/credit-pricing";
import {
  reserveCreditBalance,
  reverseCreditReservation,
  settleCreditReservation,
} from "@/lib/db/credit-accounting";
import {
  ChatConversationCapacityError,
  ChatConversationNotFoundError,
  ChatConversationTurnInFlightError,
  ChatConversationUnavailableError,
  appendPendingChatMessage,
  completeChatTurn,
  failPendingChatMessage,
  getChatProviderHistory,
  getLatestChatDraftForProvider,
  updateChatConversationState,
} from "@/lib/db/chat-conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHAT_REQUEST_BYTES = 150_000;
const chatTurnPersistenceSchema = z
  .object({
    conversationId: z.string().uuid(),
    clientMessageId: z.string().trim().min(1).max(128),
  })
  .strict();

/**
 * An entitled user may only send a message to an owned active conversation.
 * The provider receives the bounded persisted transcript and latest structured
 * draft—not client-supplied history.
 * @add 402:CreditAccountErrorResponse
 * @openapi
 */
export async function POST(request: NextRequest) {
  const access = await requireChatbotUser(request);
  if (access instanceof NextResponse) return access;

  const config = getChatbotConfig();
  if (!config) {
    return NextResponse.json(
      { error: "The recipe assistant is not currently available." },
      { status: 503 },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_CHAT_REQUEST_BYTES
  ) {
    return NextResponse.json(
      { error: "Chat request is too large." },
      { status: 413 },
    );
  }

  let chatRequest: ChatRequest;
  let pendingMessageId: string;
  let threadId: string;
  let runId: string;
  let selectedContext: SelectedChatContext | undefined;
  let shouldGenerateTitle = false;
  let initialMessageContent = "";
  try {
    const params = await chatParamsFromRequest(request);
    const persistence = chatTurnPersistenceSchema.parse({
      conversationId: params.forwardedProps.conversationId,
      clientMessageId: params.forwardedProps.clientMessageId,
    });
    const latestMessage = chatMessagesFromTanStack(params.messages).at(-1);
    if (!latestMessage || latestMessage.role !== "user") {
      throw new Error("The latest chat message must be from the user.");
    }
    // Validate the current text before it reaches the transcript database.
    chatRequestSchema.parse({ messages: [latestMessage] });

    if (params.forwardedProps.selectedAccountContext !== undefined) {
      const selection = chatContextSelectionSchema.parse(
        params.forwardedProps.selectedAccountContext,
      );
      selectedContext = await getSelectedChatContext(access.userId, selection);
      if (!selectedContext) {
        return NextResponse.json(
          { error: "The selected recipe or brew is not available." },
          { status: 400 },
        );
      }
    }

    const pending = await appendPendingChatMessage({
      userId: access.userId,
      conversationId: persistence.conversationId,
      clientMessageId: persistence.clientMessageId,
      content: latestMessage.content,
    });
    if (pending.duplicate) {
      return NextResponse.json(
        {
          error:
            "This chat message was already submitted. Reload the conversation before trying again.",
        },
        { status: 409 },
      );
    }
    pendingMessageId = pending.message.id;
    shouldGenerateTitle = pending.isFirstMessage;
    initialMessageContent = latestMessage.content;

    const [messages, latestDraft] = await Promise.all([
      getChatProviderHistory({
        userId: access.userId,
        conversationId: persistence.conversationId,
        pendingMessageId,
      }),
      getLatestChatDraftForProvider({
        userId: access.userId,
        conversationId: persistence.conversationId,
      }),
    ]);
    const persistedRecipeData = recipeDataV2Schema.safeParse(
      latestDraft?.recipeData,
    );
    const persistedDraftInput = buildRecipeDraftInputSchema.safeParse(
      latestDraft?.recipeDraftInput,
    );
    chatRequest = chatRequestSchema.parse({
      messages,
      ...(persistedRecipeData.success
        ? { activeRecipeData: persistedRecipeData.data }
        : {}),
      ...(persistedDraftInput.success
        ? { recipeDraftInput: persistedDraftInput.data }
        : {}),
    });
    if (selectedContext) chatRequest.selectedAccountContext = selectedContext;
    threadId = persistence.conversationId;
    runId = params.runId;
  } catch (error) {
    return persistenceErrorResponse(error);
  }

  // These exact capabilities, scope, safety, and calculator answers do not
  // contact a provider. Resolve them before obtaining a price snapshot or
  // reserving the user's balance, while keeping their persisted transcript
  // behavior identical to a provider-backed turn.
  const deterministicResult = runDeterministicChatTurn({
    request: chatRequest,
    provider: config.provider,
  });
  if (deterministicResult) {
    try {
      await completeChatTurn({
        userId: access.userId,
        conversationId: threadId,
        pendingMessageId,
        answer: deterministicResult.answer,
        citations: citationsFromAnswer(deterministicResult.answer),
        ...(deterministicResult.clearRecipeDraft
          ? { clearRecipeDraft: true }
          : {}),
        ...(selectedContext
          ? { contexts: [contextReferenceFrom(selectedContext)] }
          : {}),
        generation: {
          provider: deterministicResult.usage.provider,
          model: deterministicResult.usage.model,
          status: "completed",
          latencyMs: deterministicResult.usage.latencyMs,
        },
      });
    } catch (error) {
      await failPendingMessageSilently({
        userId: access.userId,
        conversationId: threadId,
        pendingMessageId,
      });
      console.error("Unable to persist deterministic chatbot turn.", {
        userId: access.userId,
        conversationId: threadId,
        error: error instanceof Error ? error.message : "unknown",
      });
      return NextResponse.json(
        { error: "Unable to save this chat response. Please try again." },
        { status: 503 },
      );
    }

    return toServerSentEventsResponse(
      streamRecipeChatTurn({
        model: deterministicResult.usage.model,
        runId,
        threadId,
        run: async () => deterministicResult,
      }),
      {
        headers: {
          "cache-control": "no-store",
          connection: "keep-alive",
          "x-accel-buffering": "no",
        },
      },
    );
  }

  const requestId = crypto.randomUUID();
  const requestStartedAt = new Date();
  let creditPricing: Awaited<ReturnType<typeof getActiveCreditPricing>>;
  let creditFeePolicy: Awaited<ReturnType<typeof getActiveCreditFeePolicy>>;
  try {
    [creditPricing, creditFeePolicy] = await Promise.all([
      getActiveCreditPricing({
        provider: config.provider,
        model: config.model,
        at: requestStartedAt,
      }),
      getActiveCreditFeePolicy({ at: requestStartedAt }),
    ]);
    const reservation = reserveCreditsForBoundedChatTurn({
      // The loop stops before its next request once this threshold is reached,
      // so one final bounded completion may extend beyond it.
      maxProviderTokens: config.maxTotalProviderTokens + config.maxOutputTokens,
      includesTitleGeneration: shouldGenerateTitle,
      pricing: creditPricing.pricing,
      feePolicy: creditFeePolicy.policy,
    });
    await reserveCreditBalance({
      userId: access.userId,
      operationId: requestId,
      idempotencyKey: `chat-reservation:${requestId}`,
      reservationCredits: reservation.chargedCredits,
      pricingVersionId: creditPricing.id,
      feePolicyVersionId: creditFeePolicy.id,
      now: requestStartedAt,
    });
  } catch (error) {
    await failPendingMessageSilently({
      userId: access.userId,
      conversationId: threadId,
      pendingMessageId,
    });
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: error.message,
          availableCredits: error.availableCredits,
          requiredCredits: error.requiredCredits,
        },
        { status: 402 },
      );
    }
    if (
      error instanceof CreditPricingNotConfiguredError ||
      error instanceof CreditFeePolicyNotConfiguredError
    ) {
      return NextResponse.json(
        { error: "Chat billing is not configured for this model." },
        { status: 503 },
      );
    }
    console.error("Unable to reserve chat credits safely.", {
      requestId,
      userId: access.userId,
      model: config.model,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      {
        error:
          "The chatbot billing guard is unavailable. Please try again later.",
      },
      { status: 503 },
    );
  }

  try {
    await recordChatbotUsageStart({
      requestId,
      userId: access.userId,
      environment: config.usageEnvironment,
      model: config.model,
    });
  } catch {
    await reverseCreditReservationSilently({
      userId: access.userId,
      operationId: requestId,
      idempotencyKey: `chat-reversal:${requestId}`,
    });
    await failPendingMessageSilently({
      userId: access.userId,
      conversationId: threadId,
      pendingMessageId,
    });
    console.error("Unable to start chatbot usage auditing safely.", {
      requestId,
      userId: access.userId,
      environment: config.usageEnvironment,
    });
    return NextResponse.json(
      {
        error:
          "The chatbot usage audit is unavailable. Please try again later.",
      },
      { status: 503 },
    );
  }

  const client = new OpenAIChatClient({
    apiKey: config.apiKey,
    model: config.model,
  });
  const selectedContextReference = selectedContext
    ? contextReferenceFrom(selectedContext)
    : undefined;

  const stream = streamRecipeChatTurn({
    model: config.model,
    runId,
    threadId,
    run: async (onEvent) => {
      let creditReservationFinalized = false;
      try {
        const result = await runChatTurn({
          client,
          userId: access.userId,
          request: chatRequest,
          maxOutputTokens: config.maxOutputTokens,
          maxToolCalls: config.maxToolCalls,
          maxProviderCalls: config.maxProviderCalls,
          maxTotalOutputTokens: config.maxTotalOutputTokens,
          maxProviderInputCharacters: config.maxProviderInputCharacters,
          maxTotalProviderTokens: config.maxTotalProviderTokens,
          ingredientLookup: async () => {
            const ingredients = await getIngredientCatalogForChat();
            return ingredients.flatMap((ingredient) => {
              const brix = Number(ingredient.sugar_content);
              if (!Number.isFinite(brix) || brix < 0 || brix > 100) return [];
              return [
                {
                  id: ingredient.id,
                  name: ingredient.name,
                  category: ingredient.category,
                  brix,
                },
              ];
            });
          },
          additiveLookup: async () => {
            const additives = await getAdditiveCatalogForChat();
            return additives.flatMap((additive) => {
              if (!Number.isFinite(additive.dosage) || additive.dosage <= 0)
                return [];
              return [
                {
                  id: additive.id,
                  name: additive.name,
                  dosagePerGallon: additive.dosage,
                  unit: additive.unit,
                },
              ];
            });
          },
          yeastLookup: async (query, limit) => {
            const yeasts = await searchYeastsForChat(query);
            return yeasts.slice(0, limit).flatMap((yeast) => {
              const nitrogenRequirement = yeast.nitrogen_requirement;
              if (
                nitrogenRequirement !== "Very Low" &&
                nitrogenRequirement !== "Low" &&
                nitrogenRequirement !== "Medium" &&
                nitrogenRequirement !== "High" &&
                nitrogenRequirement !== "Very High"
              ) {
                return [];
              }
              return [
                {
                  id: yeast.id,
                  brand: yeast.brand,
                  name: yeast.name,
                  nitrogenRequirement,
                  tolerance: numberOrUndefined(yeast.tolerance),
                  lowTemperature: numberOrUndefined(yeast.low_temp),
                  highTemperature: numberOrUndefined(yeast.high_temp),
                },
              ];
            });
          },
          onEvent,
          onProviderAttempt: () => recordChatbotProviderAttempt({ requestId }),
          onUsage: (usage) => recordChatbotUsageProgress({ requestId, usage }),
        });
        let titleResult: ChatConversationTitleResult | undefined;
        if (shouldGenerateTitle && result.usage.requestIds.length > 0) {
          titleResult = await generateChatConversationTitleAfterProviderAttempt(
            {
              client,
              userId: access.userId,
              firstMessage: initialMessageContent,
              recordProviderAttempt: () =>
                recordChatbotProviderAttempt({ requestId }),
            },
          ).catch((error) => {
            const providerError =
              error instanceof ChatProviderRequestError
                ? {
                    status: error.status,
                    ...(error.details?.type
                      ? { type: error.details.type }
                      : {}),
                    ...(error.details?.code
                      ? { code: error.details.code }
                      : {}),
                    ...(error.details?.parameter
                      ? { parameter: error.details.parameter }
                      : {}),
                  }
                : undefined;
            console.warn("Hosted chatbot title generation failed.", {
              requestId,
              userId: access.userId,
              provider: config.provider,
              model: config.model,
              error: error instanceof Error ? error.message : "unknown",
              ...(providerError ? { providerError } : {}),
            });
            throw error;
          });
        }
        const usage = mergeTitleUsage(
          result.usage,
          titleResult,
          config.provider,
        );
        // The title call is a second provider completion. Persist its tokens
        // before settlement so an interruption cannot erase known spend.
        await recordChatbotUsageProgress({ requestId, usage });
        const creditQuote = quoteCreditsForChatUsage({
          usage: {
            inputTokens: usage.inputTokens,
            cachedInputTokens: usage.cachedInputTokens,
            outputTokens: usage.outputTokens,
          },
          providerCallCount: usage.requestIds.length,
          pricing: creditPricing.pricing,
          feePolicy: creditFeePolicy.policy,
        });
        if (creditQuote) {
          await settleCreditReservation({
            userId: access.userId,
            operationId: requestId,
            idempotencyKey: `chat-settlement:${requestId}`,
            chargedCredits: creditQuote.chargedCredits,
            providerCostPicousd: creditQuote.providerCostPicousd,
            pricingVersionId: creditPricing.id,
            feePolicyVersionId: creditFeePolicy.id,
            now: new Date(),
          });
        } else {
          await reverseCreditReservation({
            userId: access.userId,
            operationId: requestId,
            idempotencyKey: `chat-reversal:${requestId}`,
            now: new Date(),
          });
        }
        creditReservationFinalized = true;
        const recipeData = recipeDataFromToolResults(result.toolResults);
        const usageEventId = await completeChatbotUsage({
          requestId,
          userId: access.userId,
          usage,
          status: "completed",
          windowAt: requestStartedAt,
        });
        await completeChatTurn({
          userId: access.userId,
          conversationId: threadId,
          pendingMessageId,
          answer: result.answer,
          citations: citationsFromAnswer(result.answer),
          ...(result.recipeDraftInput
            ? { recipeDraftInput: result.recipeDraftInput }
            : {}),
          ...(result.clearRecipeDraft ? { clearRecipeDraft: true } : {}),
          ...(recipeData ? { recipeData } : {}),
          ...(selectedContextReference
            ? { contexts: [selectedContextReference] }
            : {}),
          generation: {
            ...(usageEventId ? { usageEventId } : {}),
            provider: usage.provider,
            model: usage.model,
            status: "completed",
            latencyMs: usage.latencyMs,
          },
        });
        if (titleResult) {
          await updateChatConversationState({
            userId: access.userId,
            conversationId: threadId,
            title: titleResult.title,
          });
        }
        console.info(
          "Hosted chatbot usage",
          JSON.stringify({
            requestId,
            userId: access.userId,
            environment: config.usageEnvironment,
            model: result.usage.model,
            providerCalls: result.usage.requestIds.length,
            inputTokens: result.usage.inputTokens,
            cachedInputTokens: result.usage.cachedInputTokens,
            outputTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens,
          }),
        );
        return titleResult
          ? { ...result, conversationTitle: titleResult.title }
          : result;
      } catch (error) {
        console.error("Hosted chatbot turn failed.", {
          requestId,
          userId: access.userId,
          environment: config.usageEnvironment,
          model: config.model,
          creditReservationFinalized,
          error: error instanceof Error ? error.message : "unknown",
        });
        await failPendingMessageSilently({
          userId: access.userId,
          conversationId: threadId,
          pendingMessageId,
        });
        let checkpoint: Awaited<ReturnType<typeof getChatbotUsageCheckpoint>>;
        let usageCheckpointReadable = true;
        try {
          checkpoint = await getChatbotUsageCheckpoint(requestId);
        } catch (usageError) {
          usageCheckpointReadable = false;
          console.error("Unable to read chatbot usage checkpoint safely.", {
            requestId,
            userId: access.userId,
            error: usageError instanceof Error ? usageError.message : "unknown",
          });
        }
        let finalization: "settled" | "reversed" | "held" = "held";
        if (!creditReservationFinalized && usageCheckpointReadable) {
          finalization = await finalizeFailedReservation({
            userId: access.userId,
            requestId,
            checkpoint,
            pricing: creditPricing,
            feePolicy: creditFeePolicy,
          });
          creditReservationFinalized = finalization !== "held";
        }
        if (
          usageCheckpointReadable &&
          checkpoint &&
          (creditReservationFinalized || finalization !== "held")
        ) {
          await recordFailedUsage({
            requestId,
            userId: access.userId,
            usage: checkpoint.usage,
            provider: config.provider,
            model: config.model,
            requestStartedAt,
          });
        }
        throw error;
      }
    },
  });

  return toServerSentEventsResponse(stream, {
    headers: {
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}

async function reverseCreditReservationSilently(options: {
  userId: number;
  operationId: string;
  idempotencyKey: string;
}) {
  try {
    await reverseCreditReservation(options);
  } catch (error) {
    console.error("Unable to reverse an unspent chat credit reservation.", {
      operationId: options.operationId,
      userId: options.userId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

async function recordFailedUsage(options: {
  requestId: string;
  userId: number;
  usage: NonNullable<
    Awaited<ReturnType<typeof getChatbotUsageCheckpoint>>
  >["usage"];
  provider: "openai";
  model: string;
  requestStartedAt: Date;
}) {
  try {
    await completeChatbotUsage({
      requestId: options.requestId,
      userId: options.userId,
      usage: options.usage ?? {
        provider: options.provider,
        model: options.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedInputTokens: 0,
        requestIds: [],
        toolCalls: 0,
        latencyMs: 0,
      },
      status: "failed",
      windowAt: options.requestStartedAt,
    });
  } catch {
    console.error("Failed to persist unsuccessful chatbot usage.", {
      requestId: options.requestId,
      userId: options.userId,
    });
  }
}

/**
 * A provider response can be known even though the turn as a whole failed
 * (for example, the next tool call timed out). Settle only that checkpoint;
 * reverse only when the durable state confirms no provider dispatch occurred.
 */
async function finalizeFailedReservation(options: {
  userId: number;
  requestId: string;
  checkpoint: Awaited<ReturnType<typeof getChatbotUsageCheckpoint>>;
  pricing: Awaited<ReturnType<typeof getActiveCreditPricing>>;
  feePolicy: Awaited<ReturnType<typeof getActiveCreditFeePolicy>>;
}): Promise<"settled" | "reversed" | "held"> {
  try {
    const action = failedProviderReservationAction({
      providerAttemptCount: options.checkpoint?.providerAttemptCount ?? 0,
      checkpointedProviderCallCount:
        options.checkpoint?.checkpointedProviderCallCount ?? 0,
    });
    if (action === "settle" && options.checkpoint) {
      const quote = quoteCreditsForChatUsage({
        usage: {
          inputTokens: options.checkpoint.usage.inputTokens,
          cachedInputTokens: options.checkpoint.usage.cachedInputTokens,
          outputTokens: options.checkpoint.usage.outputTokens,
        },
        providerCallCount: options.checkpoint.checkpointedProviderCallCount,
        pricing: options.pricing.pricing,
        feePolicy: options.feePolicy.policy,
      });
      if (quote) {
        await settleCreditReservation({
          userId: options.userId,
          operationId: options.requestId,
          idempotencyKey: `chat-settlement:${options.requestId}`,
          chargedCredits: quote.chargedCredits,
          providerCostPicousd: quote.providerCostPicousd,
          pricingVersionId: options.pricing.id,
          feePolicyVersionId: options.feePolicy.id,
          now: new Date(),
        });
        return "settled";
      }
      return "held";
    }

    if (action === "hold") return "held";

    await reverseCreditReservation({
      userId: options.userId,
      operationId: options.requestId,
      idempotencyKey: `chat-reversal:${options.requestId}`,
      now: new Date(),
    });
    return "reversed";
  } catch (error) {
    // Leave the original hold intact. The reconciler has the usage checkpoint
    // and can safely settle it instead of granting completed provider work.
    console.error("Unable to finalize failed chatbot credit reservation.", {
      requestId: options.requestId,
      userId: options.userId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return "held";
  }
}

async function failPendingMessageSilently(options: {
  userId: number;
  conversationId: string;
  pendingMessageId: string;
}) {
  try {
    await failPendingChatMessage(options);
  } catch {
    // Do not hide the provider/usage error with a best-effort state cleanup failure.
  }
}

function persistenceErrorResponse(error: unknown) {
  if (error instanceof ChatConversationNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ChatConversationCapacityError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof ChatConversationTurnInFlightError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof ChatConversationUnavailableError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
}

function contextReferenceFrom(context: SelectedChatContext) {
  return context.kind === "recipe"
    ? {
        kind: "recipe" as const,
        recordId: String(context.recipe.id),
        label: context.label,
      }
    : {
        kind: "brew" as const,
        recordId: context.brew.id,
        label: context.label,
      };
}

function citationsFromAnswer(answer: string) {
  const citations = new Map<string, { title: string; url: string }>();
  for (const match of answer.matchAll(
    /\[([^\]]{1,240})\]\((https?:\/\/[^\s)]+)\)/g,
  )) {
    citations.set(match[2], { title: match[1], url: match[2] });
  }
  return [...citations.values()];
}

function mergeTitleUsage(
  usage: Awaited<ReturnType<typeof runChatTurn>>["usage"],
  title: ChatConversationTitleResult | undefined,
  provider: "openai",
) {
  if (!title) return usage;
  return {
    ...usage,
    ...(usage.requestIds.length === 0 ? { provider, model: title.model } : {}),
    inputTokens: usage.inputTokens + title.usage.inputTokens,
    cachedInputTokens: usage.cachedInputTokens + title.usage.cachedInputTokens,
    outputTokens: usage.outputTokens + title.usage.outputTokens,
    totalTokens: usage.totalTokens + title.usage.totalTokens,
    requestIds: [...usage.requestIds, title.providerRequestId],
  };
}

function recipeDataFromToolResults(
  toolResults: Array<{ toolName: string; result: unknown }>,
): unknown {
  for (const toolResult of [...toolResults].reverse()) {
    if (!isRecord(toolResult.result) || toolResult.result.status !== "ok")
      continue;
    const workflow = toolResult.result.result;
    if (isRecord(workflow) && workflow.status === "recipe") {
      const recipeData = recipeDataV2Schema.safeParse(workflow.recipeData);
      if (recipeData.success) return recipeData.data;
    }
  }
  return undefined;
}

function numberOrUndefined(
  value: string | number | null | { toString(): string },
): number | undefined {
  const parsed = Number(
    typeof value === "object" && value !== null ? value.toString() : value,
  );
  return Number.isFinite(parsed) ? parsed : undefined;
}

function chatMessagesFromTanStack(
  messages: unknown[],
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages.flatMap((message) => {
    if (
      !isRecord(message) ||
      (message.role !== "user" && message.role !== "assistant")
    ) {
      return [];
    }
    const content = textContent(message);
    const role: "user" | "assistant" =
      message.role === "user" ? "user" : "assistant";
    return content ? [{ role, content }] : [];
  });
}

function textContent(message: Record<string, unknown>): string {
  if (typeof message.content === "string") return message.content.trim();
  if (!Array.isArray(message.parts)) return "";
  return message.parts
    .flatMap((part) =>
      isRecord(part) && part.type === "text" && typeof part.content === "string"
        ? [part.content]
        : [],
    )
    .join("\n")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
