import { NextRequest, NextResponse } from "next/server";
import { chatParamsFromRequest, toServerSentEventsResponse } from "@tanstack/ai";
import { chatRequestSchema, runChatTurn } from "@/lib/ai/chat-service";
import { getLocalChatbotConfig } from "@/lib/ai/chat-config";
import { FireworksChatClient } from "@/lib/ai/fireworks";
import { streamRecipeChatTurn } from "@/lib/ai/tanstack-chat-stream";
import { searchIngredientsForChat } from "@/lib/db/ingredients";
import { searchYeastsForChat } from "@/lib/db/yeasts";
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

  let chatRequest: ReturnType<typeof chatRequestSchema.parse>;
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
    threadId = params.threadId;
    runId = params.runId;
  } catch {
    return NextResponse.json({ error: "Invalid chat request." }, { status: 400 });
  }

  const requestId = crypto.randomUUID();
  const client = new FireworksChatClient({
    apiKey: config.apiKey,
    model: config.model
  });

  const stream = streamRecipeChatTurn({
    model: config.model,
    runId,
    threadId,
    run: async (onEvent) => {
      const result = await runChatTurn({
        client,
        userId: authenticatedUser,
        request: chatRequest,
        maxOutputTokens: config.maxOutputTokens,
        maxToolCalls: config.maxToolCalls,
        ingredientLookup: async (query, limit) => {
          const ingredients = await searchIngredientsForChat(query);
          return ingredients.slice(0, limit).flatMap((ingredient) => {
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
      console.info("Hosted chatbot local test completed", {
        requestId,
        userId: authenticatedUser,
        usage: result.usage
      });
      return result;
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
