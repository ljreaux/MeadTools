import {
  conversationTitleFromMessage,
  isUnusableConversationTitle,
} from "@meadtools/chat-domain";
import type { ChatModelClient, ChatUsage } from "./chat-model";

const MAX_TITLE_LENGTH = 80;

export type ChatConversationTitleResult = {
  title: string;
  usage: ChatUsage;
  providerRequestId: string;
  model: string;
};

/**
 * One compact, tool-free provider call for a new thread's human-readable title.
 * The caller must keep the deterministic first-message title when this fails.
 */
export async function generateChatConversationTitle(options: {
  client: ChatModelClient;
  userId: number;
  firstMessage: string;
}): Promise<ChatConversationTitleResult> {
  const completion = await options.client.complete({
    userId: options.userId,
    maxOutputTokens: 32,
    toolChoice: "none",
    reasoningEffort: "none",
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "chat_conversation_title",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            // Keep this to the strict Structured Outputs subset. Length is
            // enforced by sanitizeConversationTitle after completion.
            title: { type: "string" },
          },
          required: ["title"],
        },
        strict: true,
      },
    },
    messages: [
      {
        role: "system",
        content:
          'Create a 2-6 word, descriptive subject line for a MeadTools chat. Do not echo instructions or conversational phrasing. Return JSON only. Examples: \'Can you help draft a strawberry mead recipe?\' becomes {"title":"Strawberry Mead Recipe"}; \'Lets make an avocado honey traditional\' becomes {"title":"Avocado Honey Traditional"}.',
      },
      { role: "user", content: options.firstMessage },
    ],
  });
  return {
    title: sanitizeConversationTitle(
      titleFromCompletion(completion.message.content),
      options.firstMessage,
    ),
    usage: completion.usage,
    providerRequestId: completion.id,
    model: completion.model,
  };
}

function titleFromCompletion(content: string | null): string | null {
  if (!content) return null;
  const normalized = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    const parsed = JSON.parse(normalized) as { title?: unknown };
    return typeof parsed.title === "string" ? parsed.title : null;
  } catch {
    // A title is presentation-only. Accept a compact plain-text answer if a
    // provider degrades structured output rather than showing the raw opener.
    return normalized.includes("{") || normalized.includes("}")
      ? null
      : normalized;
  }
}

export function sanitizeConversationTitle(
  value: string | null,
  fallbackMessage: string,
): string {
  const normalized = value
    ?.replace(/["'`*_#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.?!:;,-]+$/, "")
    .slice(0, MAX_TITLE_LENGTH)
    .trim();
  if (!normalized || isUnusableConversationTitle(normalized)) {
    return conversationTitleFromMessage(fallbackMessage);
  }
  return normalized;
}
