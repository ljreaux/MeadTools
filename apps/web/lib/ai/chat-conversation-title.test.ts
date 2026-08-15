import assert from "node:assert/strict";
import test from "node:test";
import {
  generateChatConversationTitle,
  sanitizeConversationTitle
} from "./chat-conversation-title";
import type { FireworksCompletionRequest } from "./fireworks";

test("conversation titles use one compact tool-free provider request", async () => {
  let request: FireworksCompletionRequest | undefined;
  const result = await generateChatConversationTitle({
    userId: 7,
    firstMessage: "Help me create a blackberry mead recipe.",
    client: {
      async complete(input) {
        request = input;
        return {
          id: "title-request",
          model: "test-model",
          message: { role: "assistant", content: "{\"title\":\"Blackberry Mead Recipe\"}" },
          usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16, cachedInputTokens: 0 }
        };
      }
    }
  });

  assert.equal(request?.maxOutputTokens, 32);
  assert.equal(request?.toolChoice, "none");
  assert.equal(request?.reasoningEffort, "none");
  assert.equal(request?.responseFormat?.type, "json_schema");
  assert.equal(request?.responseFormat?.json_schema.strict, true);
  assert.deepEqual(request?.responseFormat?.json_schema.schema, {
    type: "object",
    additionalProperties: false,
    properties: { title: { type: "string" } },
    required: ["title"]
  });
  assert.equal(result.title, "Blackberry Mead Recipe");
});

test("conversation titles accept a compact plain-text provider response", async () => {
  const result = await generateChatConversationTitle({
    userId: 7,
    firstMessage: "Can you help me draft a raspberry mead?",
    client: {
      async complete() {
        return {
          id: "title-request",
          model: "test-model",
          message: { role: "assistant", content: "Raspberry Mead Draft" },
          usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16, cachedInputTokens: 0 }
        };
      }
    }
  });

  assert.equal(result.title, "Raspberry Mead Draft");
});

test("conversation title sanitization falls back to the first message", () => {
  assert.equal(
    sanitizeConversationTitle("** Blackberry mead! **", "Draft a blackberry mead"),
    "Blackberry mead"
  );
  assert.equal(
    sanitizeConversationTitle(null, " Draft a blackberry mead "),
    "Draft a blackberry mead"
  );
  assert.equal(
    sanitizeConversationTitle(
      "We need to create a concise title for this MeadTools chat",
      "Can you help draft a strawberry mead recipe?"
    ),
    "Can you help draft a strawberry mead recipe?"
  );
});
