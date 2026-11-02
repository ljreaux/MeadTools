import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_OPENAI_MODEL, getChatbotConfig } from "./chat-config";

test("chatbot configuration is disabled until explicitly enabled and configured", () => {
  assert.equal(getChatbotConfig({ OPENAI_API_KEY: "key" }), null);
  assert.equal(getChatbotConfig({ CHATBOT_ENABLED: "true" }), null);
  assert.ok(
    getChatbotConfig({
      CHATBOT_ENABLED: "true",
      OPENAI_API_KEY: "key",
    }),
  );
});

test("chatbot configuration clamps per-turn operator-controlled limits", () => {
  const config = getChatbotConfig({
    CHATBOT_ENABLED: "true",
    OPENAI_API_KEY: "key",
    CHATBOT_MAX_OUTPUT_TOKENS: "9000",
    CHATBOT_MAX_TOOL_CALLS: "100",
    CHATBOT_MAX_PROVIDER_CALLS: "100",
    CHATBOT_MAX_TOTAL_OUTPUT_TOKENS: "20000",
    CHATBOT_MAX_PROVIDER_INPUT_CHARACTERS: "90000",
    CHATBOT_MAX_TOTAL_PROVIDER_TOKENS: "200000",
    CHATBOT_USAGE_ENVIRONMENT: "Preview-Test",
  });

  assert.ok(config);
  assert.equal(config.provider, "openai");
  assert.equal(config.model, DEFAULT_OPENAI_MODEL);
  assert.equal(config.reasoningEffort, "medium");
  assert.equal(config.maxOutputTokens, 8_000);
  assert.equal(config.maxToolCalls, 12);
  assert.equal(config.maxProviderCalls, 14);
  assert.equal(config.maxTotalOutputTokens, 12_000);
  assert.equal(config.maxProviderInputCharacters, 80_000);
  assert.equal(config.maxTotalProviderTokens, 100_000);
  assert.equal(config.usageEnvironment, "preview-test");
});

test("hosted chat defaults to the approved Luna medium profile", () => {
  const config = getChatbotConfig({
    CHATBOT_ENABLED: "true",
    OPENAI_API_KEY: "key",
  });
  assert.equal(config?.model, "gpt-5.6-luna");
  assert.equal(config?.reasoningEffort, "medium");

  assert.equal(config?.maxToolCalls, 12);
  assert.equal(config?.maxProviderCalls, 14);
  assert.equal(config?.maxTotalProviderTokens, 100_000);
});

test("operator reasoning overrides retain bounded low and medium choices", () => {
  for (const [value, expected] of [
    ["low", "low"],
    ["medium", "medium"],
    ["high", "medium"],
    [undefined, "medium"],
  ] as const) {
    const config = getChatbotConfig({
      CHATBOT_ENABLED: "true",
      OPENAI_API_KEY: "key",
      CHATBOT_REASONING_EFFORT: value,
    });
    assert.equal(config?.reasoningEffort, expected);
    assert.equal(config?.model, DEFAULT_OPENAI_MODEL);
  }
});


test("obsolete orchestration settings cannot select a different execution path", () => {
  for (const value of ["guided", "minimal", "unknown", "", undefined]) {
    const config = getChatbotConfig({ CHATBOT_ENABLED: "true", OPENAI_API_KEY: "key", CHATBOT_ORCHESTRATION: value });
    assert.ok(config);
    assert.equal("orchestration" in config, false);
    assert.equal(config.model, DEFAULT_OPENAI_MODEL);
    assert.equal(config.maxToolCalls, 12);
  }
});

test("model overrides remain explicit and blank overrides use Luna", () => {
  for (const [value, expected] of [
    [undefined, DEFAULT_OPENAI_MODEL],
    ["", DEFAULT_OPENAI_MODEL],
    ["   ", DEFAULT_OPENAI_MODEL],
    [" gpt-5.4-mini-2026-03-17 ", "gpt-5.4-mini-2026-03-17"],
  ] as const) {
    const config = getChatbotConfig({ CHATBOT_ENABLED: "true", OPENAI_API_KEY: "key", CHATBOT_OPENAI_MODEL: value });
    assert.equal(config?.model, expected);

  }
});


test("operators can retain smaller turn budgets", () => {
  const config = getChatbotConfig({ CHATBOT_ENABLED: "true", OPENAI_API_KEY: "offline-placeholder",
    CHATBOT_MAX_TOOL_CALLS: "8", CHATBOT_MAX_PROVIDER_CALLS: "10", CHATBOT_MAX_TOTAL_PROVIDER_TOKENS: "60000" });
  assert.equal(config?.maxToolCalls, 8);
  assert.equal(config?.maxProviderCalls, 10);
  assert.equal(config?.maxTotalProviderTokens, 60_000);
});
