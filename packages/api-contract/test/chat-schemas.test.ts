import test from "node:test";
import assert from "node:assert/strict";
import {
  chatConversationListQuerySchema,
  createChatConversationRequestBodySchema,
  updateChatConversationRequestBodySchema,
} from "../src/zod/chat";

test("chat conversation creation accepts an optional compact title", () => {
  assert.deepEqual(
    createChatConversationRequestBodySchema.parse({
      title: " Blackberry batch ",
    }),
    { title: "Blackberry batch" },
  );
});

test("chat conversation updates require an actual supported change", () => {
  assert.equal(
    updateChatConversationRequestBodySchema.safeParse({}).success,
    false,
  );
  assert.deepEqual(
    updateChatConversationRequestBodySchema.parse({ state: "archived" }),
    { state: "archived" },
  );
});

test("chat conversation list search accepts compact title queries", () => {
  assert.deepEqual(
    chatConversationListQuerySchema.parse({
      query: "  blackberry bochet  ",
      limit: "20",
    }),
    { query: "blackberry bochet", limit: 20 },
  );
  assert.equal(
    chatConversationListQuerySchema.safeParse({ query: "" }).success,
    false,
  );
  assert.deepEqual(
    chatConversationListQuerySchema.parse({ cursor: "opaque-page-cursor" }),
    { cursor: "opaque-page-cursor" },
  );
});
