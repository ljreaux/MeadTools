import { NextRequest, NextResponse } from "next/server";
import { chatParamsFromRequest, toServerSentEventsResponse } from "@tanstack/ai";
import {
  chatRequestSchema,
  runChatTurn,
  type ChatRequest
} from "@/lib/ai/chat-service";
import { getLocalChatbotConfig } from "@/lib/ai/chat-config";
import { FireworksChatClient } from "@/lib/ai/fireworks";
import { streamRecipeChatTurn } from "@/lib/ai/tanstack-chat-stream";
import { getIngredientCatalogForChat } from "@/lib/db/ingredients";
import { getAdditiveCatalogForChat } from "@/lib/db/additives";
import { searchYeastsForChat } from "@/lib/db/yeasts";
import {
  chatContextSelectionSchema,
  getSelectedChatContext
} from "@/lib/ai/chat-account-context";
import {
  ChatbotUsageLimitError,
  completeChatbotUsage,
  reserveChatbotUsage
} from "@/lib/db/chatbot-usage";
import { verifyUser } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CHAT_REQUEST_BYTES = 150_000;

/**
 * Private local-test recipe chatbot endpoint. It is deliberately disabled by
 * default, requires existing MeadTools authentication, and only permits
 * explicitly allow-listed user IDs. It does not save messages or recipes.
 */
export async function POST(request: NextRequest) {
  const authenticatedUser = await verifyUser(request);
  if (authenticatedUser instanceof NextResponse) return authenticatedUser;
  if (typeof authenticatedUser !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getLocalChatbotConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Local chatbot testing is not configured." },
      { status: 503 }
    );
  }
  if (!config.allowedUserIds.has(authenticatedUser)) {
    return NextResponse.json(
      { error: "This user is not permitted to use the local chatbot." },
      { status: 403 }
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_CHAT_REQUEST_BYTES) {
    return NextResponse.json({ error: "Chat request is too large." }, { status: 413 });
  }

  let chatRequest: ChatRequest;
  let threadId: string;
  let runId: string;
  try {
    const params = await chatParamsFromRequest(request);
    chatRequest = chatRequestSchema.parse({
      messages: chatMessagesFromTanStack(params.messages),
      ...(params.forwardedProps.activeRecipeData !== undefined
        ? { activeRecipeData: params.forwardedProps.activeRecipeData }
        : {}),
      ...(params.forwardedProps.recipeDraftInput !== undefined
        ? { recipeDraftInput: params.forwardedProps.recipeDraftInput }
        : {})
    });
    if (params.forwardedProps.selectedAccountContext !== undefined) {
      const selection = chatContextSelectionSchema.parse(
        params.forwardedProps.selectedAccountContext
      );
      const selectedAccountContext = await getSelectedChatContext(
        authenticatedUser,
        selection
      );
      if (!selectedAccountContext) {
        return NextResponse.json(
          { error: "The selected recipe or brew is not available." },
          { status: 400 }
        );
      }
      chatRequest.selectedAccountContext = selectedAccountContext;
    }
    threadId = params.threadId;
    runId = params.runId;
  } catch {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const requestId = crypto.randomUUID();
  const requestStartedAt = new Date();
  try {
    await reserveChatbotUsage({
      requestId,
      userId: authenticatedUser,
      environment: config.usageEnvironment,
      model: config.model,
      limits: {
        maxRequestsPerHour: config.maxRequestsPerHour,
        maxRequestsPerDay: config.maxRequestsPerDay,
        maxTokensPerDay: config.maxTokensPerDay
      },
      now: requestStartedAt
    });
  } catch (error) {
    if (error instanceof ChatbotUsageLimitError) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: { "retry-after": "3600" } }
      );
    }
    console.error("Unable to reserve chatbot usage safely.", {
      requestId,
      userId: authenticatedUser,
      environment: config.usageEnvironment
    });
    return NextResponse.json(
      { error: "The chatbot usage guard is unavailable. Please try again later." },
      { status: 503 }
    );
  }
  const client = new FireworksChatClient({
    apiKey: config.apiKey,
    model: config.model,
    annotations: { project: "chatbot", environment: config.usageEnvironment }
  });

  const stream = streamRecipeChatTurn({
    model: config.model,
    runId,
    threadId,
    run: async (onEvent) => {
      try {
        const result = await runChatTurn({
          client,
          userId: authenticatedUser,
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
        await recordCompletedUsage({
          requestId,
          userId: authenticatedUser,
          usage: result.usage,
          requestStartedAt
        });
        console.info(
          "Hosted chatbot usage",
          JSON.stringify({
            requestId,
            userId: authenticatedUser,
            environment: config.usageEnvironment,
            model: result.usage.model,
            providerCalls: result.usage.requestIds.length,
            inputTokens: result.usage.inputTokens,
            cachedInputTokens: result.usage.cachedInputTokens,
            outputTokens: result.usage.outputTokens,
            totalTokens: result.usage.totalTokens
          })
        );
        return result;
      } catch (error) {
        await recordFailedUsage({
          requestId,
          userId: authenticatedUser,
          model: config.model,
          requestStartedAt
        });
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

async function recordCompletedUsage(options: {
  requestId: string;
  userId: number;
  usage: Awaited<ReturnType<typeof runChatTurn>>["usage"];
  requestStartedAt: Date;
}) {
  try {
    await completeChatbotUsage({
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
  }).slice(-12);
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
