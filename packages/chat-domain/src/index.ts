import { z } from "zod";

export const CHAT_THREAD_RETENTION_DAYS = 90;
export const CHAT_THREAD_MAX_MESSAGES = 500;
export const CHAT_THREAD_MAX_CONTENT_BYTES = 1_048_576;
/** Reserve room for an assistant reply when accepting a new user turn. */
export const CHAT_THREAD_ASSISTANT_RESERVATION_BYTES = 65_536;
export const CHAT_PROVIDER_HISTORY_MESSAGES = 16;

export const chatConversationStateSchema = z.enum(["active", "archived"]);
export const chatMessageRoleSchema = z.enum(["user", "assistant"]);
export const chatMessageStatusSchema = z.enum([
  "pending",
  "complete",
  "failed",
  "cancelled"
]);
export const chatContextKindSchema = z.enum(["recipe", "brew"]);

export const chatCitationSchema = z.object({
  title: z.string().trim().min(1).max(240),
  url: z.string().url().max(2_000)
}).strict();

export const chatContextReferenceSchema = z.object({
  kind: chatContextKindSchema,
  recordId: z.string().trim().min(1).max(64),
  label: z.string().trim().min(1).max(240)
}).strict();

export type ChatConversationState = z.infer<typeof chatConversationStateSchema>;
export type ChatMessageRole = z.infer<typeof chatMessageRoleSchema>;
export type ChatMessageStatus = z.infer<typeof chatMessageStatusSchema>;
export type ChatCitation = z.infer<typeof chatCitationSchema>;
export type ChatContextReference = z.infer<typeof chatContextReferenceSchema>;

/** Creates a stable local title without spending a provider call. */
export function conversationTitleFromMessage(message: string): string {
  const normalized = message.trim().replace(/\s+/g, " ");
  if (normalized.length <= 80) return normalized || "New chat";
  return `${normalized.slice(0, 77).trimEnd()}…`;
}

/** Detects provider thinking/instruction text that should never be user-facing. */
export function isUnusableConversationTitle(title: string): boolean {
  const normalized = title.trim().replace(/\s+/g, " ");
  return /\b(we need to|create a concise title|title for (?:this|the) (?:meadtools )?chat|the user (?:says|asked|wants)|need to create)\b/i.test(normalized);
}

export function conversationExpiresAt(lastActivityAt: Date): Date {
  const expiresAt = new Date(lastActivityAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + CHAT_THREAD_RETENTION_DAYS);
  return expiresAt;
}

export function conversationIsAtCapacity(options: {
  messageCount: number;
  contentBytes: number;
}): boolean {
  return options.messageCount >= CHAT_THREAD_MAX_MESSAGES ||
    options.contentBytes >= CHAT_THREAD_MAX_CONTENT_BYTES;
}
