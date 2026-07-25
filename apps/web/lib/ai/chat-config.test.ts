import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_FIREWORKS_MODEL,
  getLocalChatbotConfig
} from "./chat-config";

test("local chatbot configuration is disabled until explicitly enabled and allow-listed", () => {
  assert.equal(getLocalChatbotConfig({ FIREWORKS_API_KEY: "key" }), null);
  assert.equal(
    getLocalChatbotConfig({
      CHATBOT_LOCAL_TEST_ENABLED: "true",
      FIREWORKS_API_KEY: "key"
    }),
    null
  );
});

test("local chatbot configuration clamps operator-controlled limits", () => {
  const config = getLocalChatbotConfig({
    CHATBOT_LOCAL_TEST_ENABLED: "true",
    CHATBOT_ALLOWED_USER_IDS: " 4, bad, 9, 4 ",
    FIREWORKS_API_KEY: "key",
    CHATBOT_MAX_OUTPUT_TOKENS: "9000",
    CHATBOT_MAX_TOOL_CALLS: "100"
  });

  assert.ok(config);
  assert.equal(config.model, DEFAULT_FIREWORKS_MODEL);
  assert.equal(config.maxOutputTokens, 8_000);
  assert.equal(config.maxToolCalls, 6);
  assert.deepEqual([...config.allowedUserIds], [4, 9]);
});
