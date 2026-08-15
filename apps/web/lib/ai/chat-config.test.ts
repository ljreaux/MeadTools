import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_OPENAI_MODEL,
  getLocalChatbotConfig
} from "./chat-config";

test("local chatbot configuration is disabled until explicitly enabled and configured", () => {
  assert.equal(getLocalChatbotConfig({ OPENAI_API_KEY: "key" }), null);
  assert.equal(getLocalChatbotConfig({ CHATBOT_LOCAL_TEST_ENABLED: "true" }), null);
  assert.ok(getLocalChatbotConfig({
    CHATBOT_LOCAL_TEST_ENABLED: "true",
    OPENAI_API_KEY: "key"
  }));
});

test("local chatbot configuration clamps per-turn operator-controlled limits", () => {
  const config = getLocalChatbotConfig({
    CHATBOT_LOCAL_TEST_ENABLED: "true",
    OPENAI_API_KEY: "key",
    CHATBOT_MAX_OUTPUT_TOKENS: "9000",
    CHATBOT_MAX_TOOL_CALLS: "100",
    CHATBOT_MAX_PROVIDER_CALLS: "100",
    CHATBOT_MAX_TOTAL_OUTPUT_TOKENS: "20000",
    CHATBOT_MAX_PROVIDER_INPUT_CHARACTERS: "90000",
    CHATBOT_MAX_TOTAL_PROVIDER_TOKENS: "200000",
    CHATBOT_USAGE_ENVIRONMENT: "Preview-Test"
  });

  assert.ok(config);
  assert.equal(config.provider, "openai");
  assert.equal(config.model, DEFAULT_OPENAI_MODEL);
  assert.equal(config.maxOutputTokens, 8_000);
  assert.equal(config.maxToolCalls, 8);
  assert.equal(config.maxProviderCalls, 12);
  assert.equal(config.maxTotalOutputTokens, 12_000);
  assert.equal(config.maxProviderInputCharacters, 80_000);
  assert.equal(config.maxTotalProviderTokens, 100_000);
  assert.equal(config.usageEnvironment, "preview-test");
});
