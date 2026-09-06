import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_THREAD_ASSISTANT_RESERVATION_BYTES,
  CHAT_THREAD_MAX_CONTENT_BYTES,
  CHAT_THREAD_MAX_MESSAGES,
  CHAT_TURN_CREDIT_WARNING_CREDITS,
  CHAT_TURN_PREAUTHORIZATION_CREDITS,
  CHAT_TITLE_RESERVATION_TOKENS,
  conversationExpiresAt,
  conversationIsAtCapacity,
  conversationTitleFromMessage,
  failedProviderReservationAction,
  isUnusableConversationTitle,
  quoteCreditsForChatUsage,
  reserveCreditsForBoundedChatTurn,
} from "../src/index";

test("conversation titles are local, compact, and stable", () => {
  assert.equal(
    conversationTitleFromMessage("  Draft   a traditional mead  "),
    "Draft a traditional mead",
  );
  assert.equal(conversationTitleFromMessage(""), "New chat");
  assert.equal(
    conversationTitleFromMessage("a".repeat(81)),
    `${"a".repeat(77)}…`,
  );
});

test("provider thinking text is never a usable conversation title", () => {
  assert.equal(
    isUnusableConversationTitle(
      "We need to create a concise title for the chat. The user says…",
    ),
    true,
  );
  assert.equal(isUnusableConversationTitle("Strawberry Mead Draft"), false);
});

test("conversation retention is measured from activity", () => {
  assert.equal(
    conversationExpiresAt(new Date("2026-08-08T12:00:00.000Z")).toISOString(),
    "2026-11-06T12:00:00.000Z",
  );
});

test("thread capacity has independent message and content ceilings", () => {
  assert.equal(
    conversationIsAtCapacity({
      messageCount: CHAT_THREAD_MAX_MESSAGES - 1,
      contentBytes: 0,
    }),
    false,
  );
  assert.equal(
    conversationIsAtCapacity({
      messageCount: CHAT_THREAD_MAX_MESSAGES,
      contentBytes: 0,
    }),
    true,
  );
  assert.equal(
    conversationIsAtCapacity({
      messageCount: 0,
      contentBytes: CHAT_THREAD_MAX_CONTENT_BYTES,
    }),
    true,
  );
  assert.equal(CHAT_THREAD_ASSISTANT_RESERVATION_BYTES, 65_536);
});

test("chat credit billing reserves the bounded maximum and skips deterministic turns", () => {
  const pricing = {
    uncachedInputPicousdPerMillionTokens: BigInt(140_000_000_000),
    cachedInputPicousdPerMillionTokens: BigInt(28_000_000_000),
    outputPicousdPerMillionTokens: BigInt(280_000_000_000),
  };
  const feePolicy = {
    markupBasisPoints: 2_500,
    fixedTurnCredits: 0,
    minimumTurnCredits: 1,
  };

  const reservation = reserveCreditsForBoundedChatTurn({
    maxProviderTokens: 60_000,
    includesTitleGeneration: true,
    pricing,
    feePolicy,
  });
  assert.equal(CHAT_TITLE_RESERVATION_TOKENS, 2_000);
  assert.equal(CHAT_TURN_PREAUTHORIZATION_CREDITS, 67);
  assert.equal(CHAT_TURN_CREDIT_WARNING_CREDITS, 100);
  assert.equal(reservation.chargedCredits, 22);
  const expensiveReservation = reserveCreditsForBoundedChatTurn({
    maxProviderTokens: 66_000,
    includesTitleGeneration: true,
    pricing: {
      uncachedInputPicousdPerMillionTokens: 750_000_000_000n,
      cachedInputPicousdPerMillionTokens: 75_000_000_000n,
      outputPicousdPerMillionTokens: 4_500_000_000_000n,
    },
    feePolicy: {
      markupBasisPoints: 3_500,
      fixedTurnCredits: 0,
      minimumTurnCredits: 1,
    },
  });
  assert.equal(
    expensiveReservation.chargedCredits,
    CHAT_TURN_PREAUTHORIZATION_CREDITS,
  );
  assert.equal(
    quoteCreditsForChatUsage({
      usage: { inputTokens: 1_000, cachedInputTokens: 200, outputTokens: 300 },
      providerCallCount: 0,
      pricing,
      feePolicy,
    }),
    undefined,
  );
  assert.deepEqual(
    quoteCreditsForChatUsage({
      usage: { inputTokens: 1_000, cachedInputTokens: 200, outputTokens: 300 },
      providerCallCount: 1,
      pricing,
      feePolicy,
    }),
    { providerCostPicousd: BigInt(201_600_000), chargedCredits: 1 },
  );
});

test("interrupted provider reservations reverse only confirmed unattempted work", () => {
  assert.equal(
    failedProviderReservationAction({
      providerAttemptCount: 0,
      checkpointedProviderCallCount: 0,
    }),
    "reverse",
  );
  assert.equal(
    failedProviderReservationAction({
      providerAttemptCount: 1,
      checkpointedProviderCallCount: 0,
    }),
    "hold",
  );
  assert.equal(
    failedProviderReservationAction({
      providerAttemptCount: 1,
      checkpointedProviderCallCount: 1,
    }),
    "settle",
  );
  assert.equal(
    failedProviderReservationAction({
      // Rows created before attempt counting have zero attempts but retain a
      // durable historic provider checkpoint, which remains safe to settle.
      providerAttemptCount: 0,
      checkpointedProviderCallCount: 1,
    }),
    "settle",
  );
});

test("a failed title attempt prevents settlement of only the earlier agent completion", () => {
  assert.equal(
    failedProviderReservationAction({
      // One agent completion checkpointed; the title request was dispatched
      // but failed before its usage checkpoint could persist.
      providerAttemptCount: 2,
      checkpointedProviderCallCount: 1,
    }),
    "hold",
  );
});

test("expired uncertain provider attempts release the bounded customer hold", () => {
  assert.equal(
    failedProviderReservationAction({
      providerAttemptCount: 1,
      checkpointedProviderCallCount: 0,
      releaseUncheckpointedProviderAttempts: true,
    }),
    "reverse",
  );
  assert.equal(
    failedProviderReservationAction({
      providerAttemptCount: 2,
      checkpointedProviderCallCount: 1,
      releaseUncheckpointedProviderAttempts: true,
    }),
    "settle",
  );
});
