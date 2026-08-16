import "server-only";

import {
  CHAT_PROVIDER_HISTORY_MESSAGES,
  CHAT_THREAD_ASSISTANT_RESERVATION_BYTES,
  CHAT_THREAD_MAX_CONTENT_BYTES,
  CHAT_THREAD_MAX_MESSAGES,
  conversationExpiresAt,
  conversationIsAtCapacity,
  conversationTitleFromMessage,
  isUnusableConversationTitle,
  type ChatCitation,
  type ChatContextReference,
  type ChatConversationState,
} from "@meadtools/chat-domain";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

const DEFAULT_THREAD_PAGE_SIZE = 50;
const MAX_THREAD_PAGE_SIZE = 100;

export class ChatConversationNotFoundError extends Error {
  constructor() {
    super("The chat conversation is not available.");
    this.name = "ChatConversationNotFoundError";
  }
}

export class ChatConversationUnavailableError extends Error {
  constructor() {
    super("This chat conversation is archived or expired.");
    this.name = "ChatConversationUnavailableError";
  }
}

export class ChatConversationCapacityError extends Error {
  constructor() {
    super(
      "This chat has reached its message or content limit. Start a new chat to continue.",
    );
    this.name = "ChatConversationCapacityError";
  }
}

/** A conversation has an accepted turn that has not reached a terminal state. */
export class ChatConversationTurnInFlightError extends Error {
  constructor() {
    super(
      "This chat is still processing its previous message. Please wait for it to finish.",
    );
    this.name = "ChatConversationTurnInFlightError";
  }
}

type LockedConversation = {
  id: string;
  title: string;
  state: "active" | "archived";
  next_sequence: number;
  message_count: number;
  content_bytes: number;
  expires_at: Date;
};

export type StoredChatMessage = {
  id: string;
  sequence: number;
  clientMessageId: string | null;
  role: "user" | "assistant";
  status: "pending" | "complete" | "failed" | "cancelled";
  content: string;
  citations: ChatCitation[];
  createdAt: string;
  completedAt: string | null;
};

export type StoredChatConversation = {
  id: string;
  title: string;
  state: ChatConversationState;
  messageCount: number;
  contentBytes: number;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredChatDraft = {
  id: string;
  revision: number;
  recipeDraftInput: unknown;
  recipeData: unknown;
  savedRecipeId: number | null;
  createdAt: string;
};

export type StoredChatThread = {
  conversation: StoredChatConversation;
  messages: StoredChatMessage[];
  nextBeforeSequence: number | null;
  latestDraft: StoredChatDraft | null;
};

export async function createChatConversation(options: {
  userId: number;
  title?: string;
  now?: Date;
}): Promise<StoredChatConversation> {
  const now = options.now ?? new Date();
  const conversation = await prisma.chat_conversations.create({
    data: {
      user_id: options.userId,
      title: options.title?.trim().slice(0, 160) || "New chat",
      last_activity_at: now,
      expires_at: conversationExpiresAt(now),
    },
  });
  return toStoredConversation(conversation);
}

export async function listChatConversations(options: {
  userId: number;
  state?: ChatConversationState;
  query?: string;
  limit?: number;
  before?: Date;
  now?: Date;
}): Promise<{
  conversations: StoredChatConversation[];
  nextBefore: string | null;
}> {
  const take = normalizePageSize(options.limit);
  const now = options.now ?? new Date();
  const rows = await prisma.chat_conversations.findMany({
    where: {
      user_id: options.userId,
      expires_at: { gt: now },
      ...(options.state ? { state: options.state } : {}),
      ...(options.query
        ? {
            AND: options.query
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .map((term) => ({
                title: { contains: term, mode: "insensitive" as const },
              })),
          }
        : {}),
      ...(options.before ? { last_activity_at: { lt: options.before } } : {}),
    },
    orderBy: [{ last_activity_at: "desc" }, { id: "desc" }],
    take: take + 1,
    include: {
      messages: {
        where: { role: "user" },
        orderBy: { sequence: "asc" },
        take: 1,
        select: { content: true },
      },
    },
  });
  const hasNext = rows.length > take;
  const conversations = await Promise.all(
    rows.slice(0, take).map(async (row) => {
      const fallbackMessage = row.messages[0]?.content;
      if (!fallbackMessage || !isUnusableConversationTitle(row.title)) {
        return toStoredConversation(row);
      }
      const repaired = await prisma.chat_conversations.update({
        where: { id: row.id },
        data: { title: conversationTitleFromMessage(fallbackMessage) },
      });
      return toStoredConversation(repaired);
    }),
  );
  const last = conversations.at(-1);
  return {
    conversations,
    nextBefore: hasNext && last ? last.lastActivityAt : null,
  };
}

export async function getChatThread(options: {
  userId: number;
  conversationId: string;
  beforeSequence?: number;
  limit?: number;
  now?: Date;
}): Promise<StoredChatThread> {
  const now = options.now ?? new Date();
  const conversation = await prisma.chat_conversations.findFirst({
    where: {
      id: options.conversationId,
      user_id: options.userId,
      expires_at: { gt: now },
    },
  });
  if (!conversation) throw new ChatConversationNotFoundError();

  const take = normalizePageSize(options.limit);
  const rows = await prisma.chat_messages.findMany({
    where: {
      conversation_id: conversation.id,
      ...(options.beforeSequence
        ? { sequence: { lt: options.beforeSequence } }
        : {}),
    },
    orderBy: { sequence: "desc" },
    take: take + 1,
  });
  const hasNext = rows.length > take;
  const messages = rows.slice(0, take).reverse().map(toStoredMessage);
  const latestDraft = await prisma.chat_drafts.findFirst({
    where: { conversation_id: conversation.id },
    orderBy: { revision: "desc" },
  });

  const firstUserMessage = messages.find((message) => message.role === "user");
  const repairedConversation =
    firstUserMessage && isUnusableConversationTitle(conversation.title)
      ? await prisma.chat_conversations.update({
          where: { id: conversation.id },
          data: {
            title: conversationTitleFromMessage(firstUserMessage.content),
          },
        })
      : conversation;

  return {
    conversation: toStoredConversation(repairedConversation),
    messages,
    nextBeforeSequence: hasNext ? (messages.at(0)?.sequence ?? null) : null,
    latestDraft: latestDraft ? toStoredDraft(latestDraft) : null,
  };
}

/**
 * Creates the client-visible user message before a provider call. Its client
 * message ID makes retries safe without storing a provider request payload.
 */
export async function appendPendingChatMessage(options: {
  userId: number;
  conversationId: string;
  clientMessageId: string;
  content: string;
  now?: Date;
}): Promise<{
  message: StoredChatMessage;
  duplicate: boolean;
  isFirstMessage: boolean;
}> {
  const now = options.now ?? new Date();
  const content = options.content.trim();
  const contentBytes = Buffer.byteLength(content, "utf8");

  return prisma.$transaction(async (tx) => {
    const conversation = await lockConversation(
      tx,
      options.conversationId,
      options.userId,
    );

    const duplicate = await tx.chat_messages.findUnique({
      where: {
        conversation_id_client_message_id: {
          conversation_id: options.conversationId,
          client_message_id: options.clientMessageId,
        },
      },
    });
    if (duplicate) {
      return {
        message: toStoredMessage(duplicate),
        duplicate: true,
        isFirstMessage: false,
      };
    }
    const inFlight = await tx.chat_messages.findFirst({
      where: {
        conversation_id: conversation.id,
        role: "user",
        status: "pending",
      },
      select: { id: true },
    });
    if (inFlight) throw new ChatConversationTurnInFlightError();
    assertConversationCanReceiveMessage(
      conversation,
      now,
      contentBytes + CHAT_THREAD_ASSISTANT_RESERVATION_BYTES,
      2,
    );

    const sequence = conversation.next_sequence;
    const message = await tx.chat_messages.create({
      data: {
        conversation_id: conversation.id,
        sequence,
        client_message_id: options.clientMessageId,
        role: "user",
        status: "pending",
        content,
      },
    });
    await tx.chat_conversations.update({
      where: { id: conversation.id },
      data: {
        next_sequence: { increment: 1 },
        message_count: { increment: 1 },
        content_bytes: { increment: contentBytes },
        ...(conversation.message_count === 0 &&
        conversation.title === "New chat"
          ? { title: conversationTitleFromMessage(content) }
          : {}),
      },
    });
    return {
      message: toStoredMessage(message),
      duplicate: false,
      isFirstMessage: conversation.message_count === 0,
    };
  });
}

/** Returns the bounded, transcript-only context used for the next provider call. */
export async function getChatProviderHistory(options: {
  userId: number;
  conversationId: string;
  pendingMessageId: string;
  now?: Date;
}): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const now = options.now ?? new Date();
  const conversation = await prisma.chat_conversations.findFirst({
    where: {
      id: options.conversationId,
      user_id: options.userId,
      state: "active",
      expires_at: { gt: now },
    },
    select: { id: true },
  });
  if (!conversation) throw new ChatConversationUnavailableError();

  const messages = await prisma.chat_messages.findMany({
    where: {
      conversation_id: conversation.id,
      OR: [
        { status: "complete" },
        { id: options.pendingMessageId, status: "pending" },
      ],
    },
    orderBy: { sequence: "desc" },
    take: CHAT_PROVIDER_HISTORY_MESSAGES,
  });
  return messages.reverse().map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

/** Returns only the latest structured draft state for an active owned thread. */
export async function getLatestChatDraftForProvider(options: {
  userId: number;
  conversationId: string;
  now?: Date;
}): Promise<StoredChatDraft | null> {
  const now = options.now ?? new Date();
  const conversation = await prisma.chat_conversations.findFirst({
    where: {
      id: options.conversationId,
      user_id: options.userId,
      state: "active",
      expires_at: { gt: now },
    },
    select: { id: true },
  });
  if (!conversation) throw new ChatConversationUnavailableError();
  const draft = await prisma.chat_drafts.findFirst({
    where: { conversation_id: conversation.id },
    orderBy: { revision: "desc" },
  });
  return draft ? toStoredDraft(draft) : null;
}

/**
 * Commits the visible assistant reply and any structured recipe revision in
 * one transaction. The thread expiry is renewed only after a completed turn.
 */
export async function completeChatTurn(options: {
  userId: number;
  conversationId: string;
  pendingMessageId: string;
  answer: string;
  citations?: ChatCitation[];
  recipeDraftInput?: unknown;
  recipeData?: unknown;
  contexts?: ChatContextReference[];
  generation: {
    usageEventId?: string;
    provider: string;
    model: string;
    status: string;
    latencyMs?: number;
  };
  now?: Date;
}): Promise<{
  assistantMessage: StoredChatMessage;
  draft: StoredChatDraft | null;
}> {
  const now = options.now ?? new Date();
  const answer = options.answer.trim();
  const answerBytes = Buffer.byteLength(answer, "utf8");

  return prisma.$transaction(async (tx) => {
    const conversation = await lockConversation(
      tx,
      options.conversationId,
      options.userId,
    );
    assertConversationCanReceiveMessage(conversation, now, answerBytes);
    const pending = await tx.chat_messages.findFirst({
      where: {
        id: options.pendingMessageId,
        conversation_id: conversation.id,
        role: "user",
        status: "pending",
      },
    });
    if (!pending) throw new ChatConversationUnavailableError();

    const latestDraft = await tx.chat_drafts.findFirst({
      where: { conversation_id: conversation.id },
      orderBy: { revision: "desc" },
      select: {
        revision: true,
        recipe_draft_input: true,
        recipe_data: true,
      },
    });
    const shouldStoreDraft =
      options.recipeDraftInput !== undefined ||
      options.recipeData !== undefined;
    const draft = shouldStoreDraft
      ? await tx.chat_drafts.create({
          data: {
            conversation_id: conversation.id,
            revision: (latestDraft?.revision ?? 0) + 1,
            ...(options.recipeDraftInput !== undefined ||
            (latestDraft?.recipe_draft_input !== undefined &&
              latestDraft.recipe_draft_input !== null)
              ? {
                  recipe_draft_input: (options.recipeDraftInput ??
                    latestDraft?.recipe_draft_input) as Prisma.InputJsonValue,
                }
              : {}),
            ...(options.recipeData !== undefined ||
            (latestDraft?.recipe_data !== undefined &&
              latestDraft.recipe_data !== null)
              ? {
                  recipe_data: (options.recipeData ??
                    latestDraft?.recipe_data) as Prisma.InputJsonValue,
                }
              : {}),
          },
        })
      : null;

    const assistant = await tx.chat_messages.create({
      data: {
        conversation_id: conversation.id,
        sequence: conversation.next_sequence,
        role: "assistant",
        status: "complete",
        content: answer,
        ...(options.citations?.length
          ? { citations: options.citations as Prisma.InputJsonValue }
          : {}),
        ...(draft ? { draft_id: draft.id } : {}),
        completed_at: now,
      },
    });
    await tx.chat_messages.update({
      where: { id: pending.id },
      data: { status: "complete", completed_at: now },
    });
    if (options.contexts?.length) {
      await tx.chat_message_contexts.createMany({
        data: options.contexts.map((context) => ({
          message_id: pending.id,
          kind: context.kind,
          record_id: context.recordId,
          label: context.label,
        })),
        skipDuplicates: true,
      });
    }
    await tx.chat_generations.create({
      data: {
        message_id: assistant.id,
        ...(options.generation.usageEventId
          ? { usage_event_id: options.generation.usageEventId }
          : {}),
        provider: options.generation.provider,
        model: options.generation.model,
        status: options.generation.status,
        ...(options.generation.latencyMs !== undefined
          ? { latency_ms: options.generation.latencyMs }
          : {}),
        completed_at: now,
      },
    });
    await tx.chat_conversations.update({
      where: { id: conversation.id },
      data: {
        next_sequence: { increment: 1 },
        message_count: { increment: 1 },
        content_bytes: { increment: answerBytes },
        last_activity_at: now,
        expires_at: conversationExpiresAt(now),
      },
    });
    return {
      assistantMessage: toStoredMessage(assistant),
      draft: draft ? toStoredDraft(draft) : null,
    };
  });
}

export async function failPendingChatMessage(options: {
  userId: number;
  conversationId: string;
  pendingMessageId: string;
  now?: Date;
}): Promise<void> {
  const now = options.now ?? new Date();
  const result = await prisma.chat_messages.updateMany({
    where: {
      id: options.pendingMessageId,
      conversation_id: options.conversationId,
      status: "pending",
      conversation: { user_id: options.userId },
    },
    data: { status: "failed", completed_at: now },
  });
  if (result.count === 0) throw new ChatConversationNotFoundError();
}

/**
 * Marks user messages whose provider turn could not have completed as failed.
 *
 * Chat model calls have a bounded timeout, so this intentionally uses a much
 * longer grace period. It is safe to run repeatedly alongside a request that
 * happens to finish at the same time: a completed turn changes the message
 * status before this update can match it.
 */
export async function failAbandonedPendingChatMessages(options?: {
  olderThan?: Date;
  now?: Date;
}): Promise<{ failed: number }> {
  const now = options?.now ?? new Date();
  const olderThan =
    options?.olderThan ?? new Date(now.getTime() - 60 * 60 * 1000);
  const result = await prisma.chat_messages.updateMany({
    where: {
      role: "user",
      status: "pending",
      created_at: { lte: olderThan },
    },
    data: { status: "failed", completed_at: now },
  });
  return { failed: result.count };
}

export async function updateChatConversationState(options: {
  userId: number;
  conversationId: string;
  state?: ChatConversationState;
  title?: string;
}): Promise<StoredChatConversation> {
  if (options.state === undefined && options.title === undefined) {
    throw new Error(
      "A chat conversation update must include a title or state.",
    );
  }
  const result = await prisma.chat_conversations.updateMany({
    where: { id: options.conversationId, user_id: options.userId },
    data: {
      ...(options.state !== undefined ? { state: options.state } : {}),
      ...(options.title !== undefined
        ? { title: options.title.trim().slice(0, 160) }
        : {}),
    },
  });
  if (result.count === 0) throw new ChatConversationNotFoundError();
  const conversation = await prisma.chat_conversations.findUniqueOrThrow({
    where: { id: options.conversationId },
  });
  return toStoredConversation(conversation);
}

export async function deleteChatConversation(options: {
  userId: number;
  conversationId: string;
}): Promise<void> {
  const result = await prisma.chat_conversations.deleteMany({
    where: { id: options.conversationId, user_id: options.userId },
  });
  if (result.count === 0) throw new ChatConversationNotFoundError();
}

export async function purgeExpiredChatConversations(
  now = new Date(),
): Promise<number> {
  const result = await prisma.chat_conversations.deleteMany({
    where: { expires_at: { lte: now } },
  });
  return result.count;
}

async function lockConversation(
  tx: Prisma.TransactionClient,
  conversationId: string,
  userId: number,
): Promise<LockedConversation> {
  const rows = await tx.$queryRaw<LockedConversation[]>(Prisma.sql`
    SELECT "id", "title", "state", "next_sequence", "message_count", "content_bytes", "expires_at"
    FROM "chat_conversations"
    WHERE "id" = ${conversationId}::uuid AND "user_id" = ${userId}
    FOR UPDATE
  `);
  const conversation = rows[0];
  if (!conversation) throw new ChatConversationNotFoundError();
  return conversation;
}

function assertConversationCanReceiveMessage(
  conversation: LockedConversation,
  now: Date,
  additionalBytes: number,
  additionalMessageCount = 1,
) {
  if (conversation.state !== "active" || conversation.expires_at <= now) {
    throw new ChatConversationUnavailableError();
  }
  if (
    conversationIsAtCapacity({
      messageCount: conversation.message_count,
      contentBytes: conversation.content_bytes,
    }) ||
    conversation.message_count + additionalMessageCount >
      CHAT_THREAD_MAX_MESSAGES ||
    conversation.content_bytes + additionalBytes > CHAT_THREAD_MAX_CONTENT_BYTES
  ) {
    throw new ChatConversationCapacityError();
  }
}

function normalizePageSize(value: number | undefined): number {
  if (!value || !Number.isInteger(value)) return DEFAULT_THREAD_PAGE_SIZE;
  return Math.min(Math.max(value, 1), MAX_THREAD_PAGE_SIZE);
}

function toStoredConversation(conversation: {
  id: string;
  title: string;
  state: "active" | "archived";
  message_count: number;
  content_bytes: number;
  last_activity_at: Date;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}): StoredChatConversation {
  return {
    id: conversation.id,
    title: conversation.title,
    state: conversation.state,
    messageCount: conversation.message_count,
    contentBytes: conversation.content_bytes,
    lastActivityAt: conversation.last_activity_at.toISOString(),
    expiresAt: conversation.expires_at.toISOString(),
    createdAt: conversation.created_at.toISOString(),
    updatedAt: conversation.updated_at.toISOString(),
  };
}

function toStoredMessage(message: {
  id: string;
  sequence: number;
  client_message_id: string | null;
  role: "user" | "assistant";
  status: "pending" | "complete" | "failed" | "cancelled";
  content: string;
  citations: Prisma.JsonValue | null;
  created_at: Date;
  completed_at: Date | null;
}): StoredChatMessage {
  return {
    id: message.id,
    sequence: message.sequence,
    clientMessageId: message.client_message_id,
    role: message.role,
    status: message.status,
    content: message.content,
    citations: citationsFromJson(message.citations),
    createdAt: message.created_at.toISOString(),
    completedAt: message.completed_at?.toISOString() ?? null,
  };
}

function toStoredDraft(draft: {
  id: string;
  revision: number;
  recipe_draft_input: Prisma.JsonValue | null;
  recipe_data: Prisma.JsonValue | null;
  saved_recipe_id: number | null;
  created_at: Date;
}): StoredChatDraft {
  return {
    id: draft.id,
    revision: draft.revision,
    recipeDraftInput: draft.recipe_draft_input,
    recipeData: draft.recipe_data,
    savedRecipeId: draft.saved_recipe_id,
    createdAt: draft.created_at.toISOString(),
  };
}

function citationsFromJson(value: Prisma.JsonValue | null): ChatCitation[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((citation) => {
    if (
      !citation ||
      typeof citation !== "object" ||
      Array.isArray(citation) ||
      typeof citation.title !== "string" ||
      typeof citation.url !== "string"
    ) {
      return [];
    }
    return [{ title: citation.title, url: citation.url }];
  });
}
