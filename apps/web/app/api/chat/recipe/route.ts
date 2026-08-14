import { NextRequest, NextResponse } from "next/server";
import { chatParamsFromRequest, toServerSentEventsResponse } from "@tanstack/ai";
import {
  quoteCreditsForChatUsage,
  reserveCreditsForBoundedChatTurn
} from "@meadtools/chat-domain";
import { InsufficientCreditsError } from "@meadtools/credit-accounting";
import { buildRecipeDraftInputSchema } from "@meadtools/recipe-workflows";
import { recipeDataV2Schema } from "@meadtools/schemas";
import { z } from "zod";
import {
  chatRequestSchema,
  runChatTurn,
  type ChatRequest
} from "@/lib/ai/chat-service";
import { getLocalChatbotConfig } from "@/lib/ai/chat-config";
import { generateChatConversationTitle } from "@/lib/ai/chat-conversation-title";
import { requireLocalChatbotUser } from "@/lib/ai/chat-access";
import { FireworksChatClient } from "@/lib/ai/fireworks";
import { streamRecipeChatTurn } from "@/lib/ai/tanstack-chat-stream";
import { getIngredientCatalogForChat } from "@/lib/db/ingredients";
import { getAdditiveCatalogForChat } from "@/lib/db/additives";
import { searchYeastsForChat } from "@/lib/db/yeasts";
import {
  chatContextSelectionSchema,
  getSelectedChatContext,
  type SelectedChatContext
} from "@/lib/ai/chat-account-context";
import {
  completeChatbotUsage,
  recordChatbotUsageStart
} from "@/lib/db/chatbot-usage";
import {
  CreditFeePolicyNotConfiguredError,
  CreditPricingNotConfiguredError,
  getActiveCreditFeePolicy,
  getActiveCreditPricing
} from "@/lib/db/credit-pricing";
import {
  reserveCreditBalance,
  reverseCreditReservation,
  settleCreditReservation
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
  updateChatConversationState
} from "@/lib/db/chat-conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHAT_REQUEST_BYTES = 150_000;
const chatTurnPersistenceSchema = z.object({
  conversationId: z.string().uuid(),
  clientMessageId: z.string().trim().min(1).max(128)
}).strict();

/**
 * Private evaluator endpoint. The signed-in user may only send a message to
 * an owned active conversation. The provider receives the bounded persisted
 * transcript and latest structured draft—not client-supplied history.
 * @add 402:CreditAccountErrorResponse
 * @openapi
 */
export async function POST(request: NextRequest) {
  const access = await requireLocalChatbotUser(request);
  if (access instanceof NextResponse) return access;

  const config = getLocalChatbotConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Local chatbot testing is not configured." },
      { status: 503 }
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_CHAT_REQUEST_BYTES) {
    return NextResponse.json({ error: "Chat request is too large." }, { status: 413 });
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
      clientMessageId: params.forwardedProps.clientMessageId
    });
    const latestMessage = chatMessagesFromTanStack(params.messages).at(-1);
    if (!latestMessage || latestMessage.role !== "user") {
      throw new Error("The latest chat message must be from the user.");
    }
    // Validate the current text before it reaches the transcript database.
    chatRequestSchema.parse({ messages: [latestMessage] });

    if (params.forwardedProps.selectedAccountContext !== undefined) {
      const selection = chatContextSelectionSchema.parse(
        params.forwardedProps.selectedAccountContext
      );
      selectedContext = await getSelectedChatContext(access.userId, selection);
      if (!selectedContext) {
        return NextResponse.json(
          { error: "The selected recipe or brew is not available." },
          { status: 400 }
        );
      }
    }

    const pending = await appendPendingChatMessage({
      userId: access.userId,
      conversationId: persistence.conversationId,
      clientMessageId: persistence.clientMessageId,
      content: latestMessage.content
    });
    if (pending.duplicate) {
      return NextResponse.json(
        { error: "This chat message was already submitted. Reload the conversation before trying again." },
        { status: 409 }
      );
    }
    pendingMessageId = pending.message.id;
    shouldGenerateTitle = pending.isFirstMessage;
    initialMessageContent = latestMessage.content;

    const [messages, latestDraft] = await Promise.all([
      getChatProviderHistory({
        userId: access.userId,
        conversationId: persistence.conversationId,
        pendingMessageId
      }),
      getLatestChatDraftForProvider({
        userId: access.userId,
        conversationId: persistence.conversationId
      })
    ]);
    const persistedRecipeData = recipeDataV2Schema.safeParse(latestDraft?.recipeData);
    const persistedDraftInput = buildRecipeDraftInputSchema.safeParse(
      latestDraft?.recipeDraftInput
    );
    chatRequest = chatRequestSchema.parse({
      messages,
      ...(persistedRecipeData.success ? { activeRecipeData: persistedRecipeData.data } : {}),
      ...(persistedDraftInput.success ? { recipeDraftInput: persistedDraftInput.data } : {})
    });
    if (selectedContext) chatRequest.selectedAccountContext = selectedContext;
    threadId = persistence.conversationId;
    runId = params.runId;
  } catch (error) {
    return persistenceErrorResponse(error);
  }

  const requestId = crypto.randomUUID();
  const requestStartedAt = new Date();
  let creditPricing: Awaited<ReturnType<typeof getActiveCreditPricing>>;
  let creditFeePolicy: Awaited<ReturnType<typeof getActiveCreditFeePolicy>>;
  try {
    [creditPricing, creditFeePolicy] = await Promise.all([
      getActiveCreditPricing({ provider: "fireworks", model: config.model, at: requestStartedAt }),
      getActiveCreditFeePolicy({ at: requestStartedAt })
    ]);
    const reservation = reserveCreditsForBoundedChatTurn({
      // The loop stops before its next request once this threshold is reached,
      // so one final bounded completion may extend beyond it.
      maxProviderTokens: config.maxTotalProviderTokens + config.maxOutputTokens,
      includesTitleGeneration: shouldGenerateTitle,
      pricing: creditPricing.pricing,
      feePolicy: creditFeePolicy.policy
    });
    await reserveCreditBalance({
      userId: access.userId,
      operationId: requestId,
      idempotencyKey: `chat-reservation:${requestId}`,
      reservationCredits: reservation.chargedCredits,
      pricingVersionId: creditPricing.id,
      feePolicyVersionId: creditFeePolicy.id,
      now: requestStartedAt
    });
  } catch (error) {
    await failPendingMessageSilently({
      userId: access.userId,
      conversationId: threadId,
      pendingMessageId
    });
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json({
        error: error.message,
        availableCredits: error.availableCredits,
        requiredCredits: error.requiredCredits
      }, { status: 402 });
    }
    if (
      error instanceof CreditPricingNotConfiguredError ||
      error instanceof CreditFeePolicyNotConfiguredError
    ) {
      return NextResponse.json({ error: "Chat billing is not configured for this model." }, { status: 503 });
    }
    console.error("Unable to reserve chat credits safely.", {
      requestId,
      userId: access.userId,
      model: config.model,
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      { error: "The chatbot billing guard is unavailable. Please try again later." },
      { status: 503 }
    );
  }

  try {
    await recordChatbotUsageStart({
      requestId,
      userId: access.userId,
      environment: config.usageEnvironment,
      model: config.model
    });
  } catch (error) {
    await reverseCreditReservationSilently({
      userId: access.userId,
      operationId: requestId,
      idempotencyKey: `chat-reversal:${requestId}`
    });
    await failPendingMessageSilently({
      userId: access.userId,
      conversationId: threadId,
      pendingMessageId
    });
    console.error("Unable to start chatbot usage auditing safely.", {
      requestId,
      userId: access.userId,
      environment: config.usageEnvironment
    });
    return NextResponse.json(
      { error: "The chatbot usage audit is unavailable. Please try again later." },
      { status: 503 }
    );
  }

  const client = new FireworksChatClient({
    apiKey: config.apiKey,
    model: config.model,
    annotations: { project: "chatbot", environment: config.usageEnvironment }
  });
  const selectedContextReference = selectedContext
    ? contextReferenceFrom(selectedContext)
    : undefined;

  const stream = streamRecipeChatTurn({
    model: config.model,
    runId,
    threadId,
    run: async (onEvent) => {
      let providerResultCompleted = false;
      let creditReservationFinalized = false;
      try {
        const titlePromise = shouldGenerateTitle
          ? generateChatConversationTitle({
              client,
              userId: access.userId,
              firstMessage: initialMessageContent
            }).catch(() => undefined)
          : undefined;
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
              return [{
                id: ingredient.id,
                name: ingredient.name,
                category: ingredient.category,
                brix
              }];
            });
          },
          additiveLookup: async () => {
            const additives = await getAdditiveCatalogForChat();
            return additives.flatMap((additive) => {
              if (!Number.isFinite(additive.dosage) || additive.dosage <= 0) return [];
              return [{
                id: additive.id,
                name: additive.name,
                dosagePerGallon: additive.dosage,
                unit: additive.unit
              }];
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
              return [{
                id: yeast.id,
                brand: yeast.brand,
                name: yeast.name,
                nitrogenRequirement,
                tolerance: numberOrUndefined(yeast.tolerance),
                lowTemperature: numberOrUndefined(yeast.low_temp),
                highTemperature: numberOrUndefined(yeast.high_temp)
              }];
            });
          },
          onEvent
        });
        const titleResult = titlePromise ? await titlePromise : undefined;
        const usage = mergeTitleUsage(result.usage, titleResult);
        providerResultCompleted = true;
        const creditQuote = quoteCreditsForChatUsage({
          usage: {
            inputTokens: usage.inputTokens,
            cachedInputTokens: usage.cachedInputTokens,
            outputTokens: usage.outputTokens
          },
          providerCallCount: usage.requestIds.length,
          pricing: creditPricing.pricing,
          feePolicy: creditFeePolicy.policy
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
            now: new Date()
          });
        } else {
          await reverseCreditReservation({
            userId: access.userId,
            operationId: requestId,
            idempotencyKey: `chat-reversal:${requestId}`,
            now: new Date()
          });
        }
        creditReservationFinalized = true;
        const recipeData = recipeDataFromToolResults(result.toolResults);
        const usageEventId = await recordCompletedUsage({
          requestId,
          userId: access.userId,
          usage,
          requestStartedAt
        });
        await completeChatTurn({
          userId: access.userId,
          conversationId: threadId,
          pendingMessageId,
          answer: result.answer,
          citations: citationsFromAnswer(result.answer),
          ...(result.recipeDraftInput ? { recipeDraftInput: result.recipeDraftInput } : {}),
          ...(recipeData ? { recipeData } : {}),
          ...(selectedContextReference ? { contexts: [selectedContextReference] } : {}),
          generation: {
            ...(usageEventId ? { usageEventId } : {}),
            provider: usage.provider,
            model: usage.model,
            status: "completed",
            latencyMs: usage.latencyMs
          }
        });
        if (titleResult) {
          await updateChatConversationState({
            userId: access.userId,
            conversationId: threadId,
            title: titleResult.title
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
            totalTokens: result.usage.totalTokens
          })
        );
        return titleResult ? { ...result, conversationTitle: titleResult.title } : result;
      } catch (error) {
        console.error("Hosted chatbot turn failed.", {
          requestId,
          userId: access.userId,
          environment: config.usageEnvironment,
          model: config.model,
          providerResultCompleted,
          creditReservationFinalized,
          error: error instanceof Error ? error.message : "unknown"
        });
        await failPendingMessageSilently({
          userId: access.userId,
          conversationId: threadId,
          pendingMessageId
        });
        if (!providerResultCompleted && !creditReservationFinalized) {
          await reverseCreditReservationSilently({
            userId: access.userId,
            operationId: requestId,
            idempotencyKey: `chat-reversal:${requestId}`
          });
        }
        if (!providerResultCompleted) {
          await recordFailedUsage({
            requestId,
            userId: access.userId,
            model: config.model,
            requestStartedAt
          });
        }
        throw error;
      }
    }
  });

  return toServerSentEventsResponse(stream, {
    headers: {
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no"
    }
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
      error: error instanceof Error ? error.message : "unknown"
    });
  }
}

async function recordCompletedUsage(options: {
  requestId: string;
  userId: number;
  usage: Awaited<ReturnType<typeof runChatTurn>>["usage"];
  requestStartedAt: Date;
}): Promise<string | undefined> {
  try {
    return await completeChatbotUsage({
      requestId: options.requestId,
      userId: options.userId,
      usage: options.usage,
      status: "completed",
      windowAt: options.requestStartedAt
    });
  } catch {
    console.error("Failed to persist completed chatbot usage.", {
      requestId: options.requestId,
      userId: options.userId
    });
    return undefined;
  }
}

async function recordFailedUsage(options: {
  requestId: string;
  userId: number;
  model: string;
  requestStartedAt: Date;
}) {
  try {
    await completeChatbotUsage({
      requestId: options.requestId,
      userId: options.userId,
      usage: {
        provider: "fireworks",
        model: options.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cachedInputTokens: 0,
        requestIds: [],
        toolCalls: 0,
        latencyMs: 0
      },
      status: "failed",
      windowAt: options.requestStartedAt
    });
  } catch {
    console.error("Failed to persist unsuccessful chatbot usage.", {
      requestId: options.requestId,
      userId: options.userId
    });
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
    ? { kind: "recipe" as const, recordId: String(context.recipe.id), label: context.label }
    : { kind: "brew" as const, recordId: context.brew.id, label: context.label };
}

function citationsFromAnswer(answer: string) {
  const citations = new Map<string, { title: string; url: string }>();
  for (const match of answer.matchAll(/\[([^\]]{1,240})\]\((https?:\/\/[^\s)]+)\)/g)) {
    citations.set(match[2], { title: match[1], url: match[2] });
  }
  return [...citations.values()];
}

function mergeTitleUsage(
  usage: Awaited<ReturnType<typeof runChatTurn>>["usage"],
  title: Awaited<ReturnType<typeof generateChatConversationTitle>> | undefined
) {
  if (!title) return usage;
  return {
    ...usage,
    ...(usage.requestIds.length === 0
      ? { provider: "fireworks" as const, model: title.model }
      : {}),
    inputTokens: usage.inputTokens + title.usage.inputTokens,
    cachedInputTokens: usage.cachedInputTokens + title.usage.cachedInputTokens,
    outputTokens: usage.outputTokens + title.usage.outputTokens,
    totalTokens: usage.totalTokens + title.usage.totalTokens,
    requestIds: [...usage.requestIds, title.providerRequestId]
  };
}

function recipeDataFromToolResults(
  toolResults: Array<{ toolName: string; result: unknown }>
): unknown {
  for (const toolResult of [...toolResults].reverse()) {
    if (!isRecord(toolResult.result) || toolResult.result.status !== "ok") continue;
    const workflow = toolResult.result.result;
    if (isRecord(workflow) && workflow.status === "recipe") {
      const recipeData = recipeDataV2Schema.safeParse(workflow.recipeData);
      if (recipeData.success) return recipeData.data;
    }
  }
  return undefined;
}

function numberOrUndefined(
  value: string | number | null | { toString(): string }
): number | undefined {
  const parsed = Number(typeof value === "object" && value !== null ? value.toString() : value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function chatMessagesFromTanStack(messages: unknown[]): Array<{ role: "user" | "assistant"; content: string }> {
  return messages.flatMap((message) => {
    if (!isRecord(message) || (message.role !== "user" && message.role !== "assistant")) {
      return [];
    }
    const content = textContent(message);
    const role: "user" | "assistant" = message.role === "user" ? "user" : "assistant";
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
        : []
    )
    .join("\n")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
