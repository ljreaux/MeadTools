import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_THREAD_ASSISTANT_RESERVATION_BYTES,
  CHAT_THREAD_MAX_CONTENT_BYTES,
  CHAT_THREAD_MAX_MESSAGES,
  conversationExpiresAt,
  conversationIsAtCapacity,
  conversationTitleFromMessage,
  isUnusableConversationTitle
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
