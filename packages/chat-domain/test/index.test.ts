import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_THREAD_ASSISTANT_RESERVATION_BYTES,
  CHAT_THREAD_MAX_CONTENT_BYTES,
  CHAT_THREAD_MAX_MESSAGES,
  CHAT_TITLE_RESERVATION_TOKENS,
  conversationExpiresAt,
  conversationIsAtCapacity,
  conversationTitleFromMessage,
  isUnusableConversationTitle,
  quoteCreditsForChatUsage,
  reserveCreditsForBoundedChatTurn
} from "../src/index";

test("conversation titles are local, compact, and stable", () => {
  assert.equal(conversationTitleFromMessage("  Draft   a traditional mead  "), "Draft a traditional mead");
  assert.equal(conversationTitleFromMessage(""), "New chat");
  assert.equal(conversationTitleFromMessage("a".repeat(81)), `${"a".repeat(77)}…`);
});

test("provider thinking text is never a usable conversation title", () => {
  assert.equal(
    isUnusableConversationTitle("We need to create a concise title for the chat. The user says…"),
    true
  );
  assert.equal(isUnusableConversationTitle("Strawberry Mead Draft"), false);
});

test("conversation retention is measured from activity", () => {
  assert.equal(
    conversationExpiresAt(new Date("2026-08-08T12:00:00.000Z")).toISOString(),
    "2026-11-06T12:00:00.000Z"
  );
});

test("thread capacity has independent message and content ceilings", () => {
  assert.equal(conversationIsAtCapacity({ messageCount: CHAT_THREAD_MAX_MESSAGES - 1, contentBytes: 0 }), false);
  assert.equal(conversationIsAtCapacity({ messageCount: CHAT_THREAD_MAX_MESSAGES, contentBytes: 0 }), true);
  assert.equal(conversationIsAtCapacity({ messageCount: 0, contentBytes: CHAT_THREAD_MAX_CONTENT_BYTES }), true);
  assert.equal(CHAT_THREAD_ASSISTANT_RESERVATION_BYTES, 65_536);
});

test("chat credit billing reserves the bounded maximum and skips deterministic turns", () => {
  const pricing = {
    uncachedInputPicousdPerMillionTokens: BigInt(140_000_000_000),
    cachedInputPicousdPerMillionTokens: BigInt(28_000_000_000),
    outputPicousdPerMillionTokens: BigInt(280_000_000_000)
  };
  const feePolicy = { markupBasisPoints: 2_500, fixedTurnCredits: 0, minimumTurnCredits: 1 };

  const reservation = reserveCreditsForBoundedChatTurn({
    maxProviderTokens: 60_000,
    includesTitleGeneration: true,
    pricing,
    feePolicy
  });
  assert.equal(CHAT_TITLE_RESERVATION_TOKENS, 2_000);
  assert.equal(reservation.chargedCredits, 22);
  assert.equal(
    quoteCreditsForChatUsage({
      usage: { inputTokens: 1_000, cachedInputTokens: 200, outputTokens: 300 },
      providerCallCount: 0,
      pricing,
      feePolicy
    }),
    undefined
  );
  assert.deepEqual(
    quoteCreditsForChatUsage({
      usage: { inputTokens: 1_000, cachedInputTokens: 200, outputTokens: 300 },
      providerCallCount: 1,
      pricing,
      feePolicy
    }),
    { providerCostPicousd: BigInt(201_600_000), chargedCredits: 1 }
  );
});
