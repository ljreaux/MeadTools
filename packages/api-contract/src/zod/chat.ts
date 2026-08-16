import { z } from "zod";

const isoDateTimeSchema = z.string().datetime({ offset: true });
export const chatConversationStateResponseSchema = z.enum([
  "active",
  "archived",
]);
export const chatContextKindResponseSchema = z.enum(["recipe", "brew"]);

export const chatConversationIdPathParamsSchema = z.object({
  conversationId: z.string().uuid(),
});

export const chatConversationListQuerySchema = z.object({
  state: chatConversationStateResponseSchema.optional(),
  query: z.string().trim().min(1).max(160).optional(),
  before: isoDateTimeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const chatThreadQuerySchema = z.object({
  beforeSequence: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const createChatConversationRequestBodySchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

export const updateChatConversationRequestBodySchema = z
  .object({
    title: z.string().trim().min(1).max(160).optional(),
    state: chatConversationStateResponseSchema.optional(),
  })
  .strict()
  .refine((value) => value.title !== undefined || value.state !== undefined, {
    message: "At least one conversation field is required.",
  });

export const chatCitationResponseSchema = z.object({
  title: z.string(),
  url: z.string().url(),
});

export const chatConversationResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  state: chatConversationStateResponseSchema,
  messageCount: z.number().int().nonnegative(),
  contentBytes: z.number().int().nonnegative(),
  lastActivityAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

export const chatMessageResponseSchema = z.object({
  id: z.string().uuid(),
  sequence: z.number().int().positive(),
  clientMessageId: z.string().nullable(),
  role: z.enum(["user", "assistant"]),
  status: z.enum(["pending", "complete", "failed", "cancelled"]),
  content: z.string(),
  citations: z.array(chatCitationResponseSchema),
  createdAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.nullable(),
});

export const chatDraftResponseSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().positive(),
  recipeDraftInput: z.unknown().nullable(),
  recipeData: z.unknown().nullable(),
  savedRecipeId: z.number().int().nullable(),
  createdAt: isoDateTimeSchema,
});

export const chatConversationsResponseSchema = z.object({
  conversations: z.array(chatConversationResponseSchema),
  nextBefore: isoDateTimeSchema.nullable(),
});

export const chatConversationThreadResponseSchema = z.object({
  conversation: chatConversationResponseSchema,
  messages: z.array(chatMessageResponseSchema),
  nextBeforeSequence: z.number().int().positive().nullable(),
  latestDraft: chatDraftResponseSchema.nullable(),
});

export const createChatConversationResponseSchema = z.object({
  conversation: chatConversationResponseSchema,
});

export const updateChatConversationResponseSchema =
  createChatConversationResponseSchema;

export const deleteChatConversationResponseSchema = z.object({
  deleted: z.literal(true),
});

export const chatConversationErrorResponseSchema = z.object({
  error: z.string(),
});

export const chatMessageContextResponseSchema = z.object({
  kind: chatContextKindResponseSchema,
  recordId: z.string(),
  label: z.string(),
});
