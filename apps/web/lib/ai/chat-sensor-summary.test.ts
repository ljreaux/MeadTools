import assert from "node:assert/strict";
import test from "node:test";
import { sensorHistorySummarySchema, type AccountReadAdapter } from "@meadtools/recipe-agent";
import { getChatbotConfig } from "./chat-config";
import { runChatTurn } from "./chat-service";
import type { ChatCompletionRequest } from "./chat-model";

const active = "00000000-0000-4000-8000-000000000001";
const empty = "00000000-0000-4000-8000-000000000002";
const emptyStats = { validCount: 0, minimum: null, maximum: null, first: null, last: null, firstAt: null, lastAt: null, range: null, netChange: null };
function summary(hasData: boolean) {
  const from = "2026-10-11T00:00:00Z", to = "2026-10-14T00:00:00Z";
  const stats = { validCount: 289, minimum: 1, maximum: 1.02, first: 1.02, last: 1, firstAt: from, lastAt: to, range: 0.02, netChange: -0.02 };
  return sensorHistorySummarySchema.parse({
    window: { from: hasData ? from : null, to: hasData ? to : null, basis: "latest_recorded_72_hours" },
    coverage: "all_samples_in_window", sampleCount: hasData ? 289 : 0,
    firstSampleAt: hasData ? from : null, lastSampleAt: hasData ? to : null, gravityUnit: "SG",
    measured: hasData ? stats : emptyStats, deviceCalculated: hasData ? stats : emptyStats,
    maxGapSeconds: hasData ? 900 : null, gapsOverOneHour: 0, repeatedTimestamps: 0,
    correctionProvenance: "stored_device_calculation", stabilityAssessment: "not_assessed",
  });
}

test("dense and empty sensor histories fit one comparison without raw pages or a token-limit fallback", async () => {
  let rawReads = 0, summaries = 0, dispatches = 0;
  const requests: ChatCompletionRequest[] = [];
  const adapter: AccountReadAdapter = {
    listBrews: async () => ({ rows: [], hasMore: false }), getBrew: async () => null,
    getBrewTimeline: async () => null, getRecipe: async () => null, listRecipes: async () => ({ rows: [], hasMore: false }),
    getBrewSensorHistory: async () => { rawReads++; throw new Error("Raw pages are unnecessary for this comparison"); },
    getBrewSensorSummary: async ({ id }) => { summaries++; return summary(id === active); },
  };
  const result = await runChatTurn({ userId: 7, maxOutputTokens: 1000, maxToolCalls: 8,
    maxProviderCalls: 10, maxTotalProviderTokens: 60000, maxProviderInputCharacters: 60000,
    accountReadAdapter: adapter,
    request: { messages: [{ role: "user", content: "Compare the sensor evidence for my two mead brews." }] },
    client: { async complete(request) {
      requests.push({ ...request, messages: structuredClone(request.messages) });
      const n = dispatches++;
      // Offline context-size surrogate, not a provider tokenizer or billing rate.
      const inputTokens = Math.ceil(JSON.stringify({ messages: request.messages, tools: request.tools }).length / 4);
      return { id: `summary-${n}`, model: "offline", usage: { inputTokens, cachedInputTokens: 0, outputTokens: 20, totalTokens: inputTokens + 20 },
        message: n < 2 ? { role: "assistant", content: null, tool_calls: [{ id: `call-${n}`, type: "function", function: {
          name: "summarize_brew_sensor_history", arguments: JSON.stringify({ id: n === 0 ? active : empty }),
        } }] } : { role: "assistant", content: "Active has 289 samples over the reported 72-hour window; the other brew has no sensor samples. Neither result is a stability verdict." } };
    } } });
  assert.equal(dispatches, 3);
  assert.equal(summaries, 2);
  assert.equal(rawReads, 0);
  assert.match(result.answer, /289 samples/);
  assert.doesNotMatch(result.answer, /safe provider-token limit/);
  assert.ok(result.usage.totalTokens < 60000);
  for (const tool of result.toolResults) assert.ok(JSON.stringify(tool.result).length < 1500);
  assert.equal(requests[2].messages.filter(m => m.role === "system").length, 1);
});

test("sensor summary is not advertised or executable without an authenticated account adapter", async () => {
  let calls = 0;
  const result = await runChatTurn({ userId: 7, maxOutputTokens: 1000, maxToolCalls: 8,
    request: { messages: [{ role: "user", content: "Read the sensor summary for my mead." }] },
    client: { async complete(request) {
      assert.equal(request.tools?.some(t => t.function.name === "summarize_brew_sensor_history"), false);
      const n = calls++;
      return { id: `no-account-${n}`, model: "offline", usage: { inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, totalTokens: 20 },
        message: n === 0 ? { role: "assistant", content: null, tool_calls: [{ id: "denied", type: "function", function: { name: "summarize_brew_sensor_history", arguments: JSON.stringify({ id: active }) } }] }
          : { role: "assistant", content: "Account reads are unavailable." } };
    } } });
  assert.equal((result.toolResults[0].result as { status: string }).status, "unavailable");
});

test("a full two-brew evidence path keeps all tools model-led and fits the accepted context budget", async () => {
  let dispatches = 0;
  const config = getChatbotConfig({ CHATBOT_ENABLED: "true", OPENAI_API_KEY: "offline-placeholder" })!;
  const brew = (id: string) => ({ id, name: id === active ? "Active" : "Unlinked", stage: "PRIMARY",
    start_date: "2026-10-01T00:00:00Z", end_date: null, current_volume_liters: null });
  const adapter: AccountReadAdapter = {
    listBrews: async () => ({ rows: [brew(active), brew(empty)], hasMore: false }),
    getBrew: async () => null, getRecipe: async () => null,
    listRecipes: async () => ({ rows: [], hasMore: false }),
    getBrewSensorHistory: async () => { throw new Error("Unexpected raw history read"); },
    getBrewSensorSummary: async ({ id }) => summary(id === active),
    getBrewTimeline: async ({ id }) => ({ hasMore: false, rows: Array.from({ length: 6 }, (_, i) => ({
      id: `00000000-0000-4000-8000-00000000001${i}`, datetime: `2026-10-${10 + i}T00:00:00Z`,
      type: "GRAVITY", title: "Manual reading", note: null,
      gravity: id === active ? 1.02 - i * 0.004 : 1.04, temperature: null, temp_units: null,
      data: { source: "measured", readingRole: "GENERAL" },
    })) }),
  };
  const steps = [
    ["list_brews", { query: "Test Brew" }],
    ["get_brew_timeline", { id: active }],
    ["summarize_brew_sensor_history", { id: active }],
    ["get_brew_timeline", { id: empty }],
    ["summarize_brew_sensor_history", { id: empty }],
    ["search_wiki", { query: "hydrometer" }],
    ["fetch_wiki_page", { url: "https://wiki.meadtools.com/en/faq/hydrometer" }],
  ] as const;
  const result = await runChatTurn({ userId: 7, maxOutputTokens: 1000, maxToolCalls: config.maxToolCalls,
    maxProviderCalls: config.maxProviderCalls, maxTotalProviderTokens: config.maxTotalProviderTokens, maxProviderInputCharacters: 60000,
    accountReadAdapter: adapter,
    wikiFetcher: async url => ({ ok: true, status: 200, url,
      headers: { get: () => "text/html" },
      text: async () => "<title>Hydrometer</title><main>Compare gravity measurements several days apart.</main>",
    }),
    request: { messages: [
      { role: "user", content: "Assess Active Test Brew." },
      { role: "assistant", content: "A prior assessment found falling sensor gravity, but completion is unconfirmed." },
      { role: "user", content: "Compare Active Test Brew with Unlinked Test Brew using manual history, sensor history and cited guidance." },
    ] },
    client: { async complete(request) {
      assert.equal(request.toolChoice, "auto");
      const inputTokens = Math.ceil(JSON.stringify({ messages: request.messages, tools: request.tools }).length / 4);
      const step = steps[dispatches++];
      return { id: `comparison-${dispatches}`, model: "offline",
        usage: { inputTokens, cachedInputTokens: 0, outputTokens: 100, totalTokens: inputTokens + 100 },
        message: step ? { role: "assistant", content: null, tool_calls: [{ id: `compare-${dispatches}`,
          type: "function", function: { name: step[0], arguments: JSON.stringify(step[1]) } }] }
          : { role: "assistant", content: "Active has more automatic evidence, but neither summary alone confirms completion. Unlinked has no sensor data. Compare subsequent manual gravity measurements. Source: https://wiki.meadtools.com/en/faq/hydrometer" },
      };
    } },
  });
  assert.equal(dispatches, 8);
  assert.equal(result.toolResults.length, 7);
  for (const tool of result.toolResults) assert.equal((tool.result as { status: string }).status, "ok", tool.toolName);
  assert.match(result.answer, /Active has more/);
  assert.ok(result.usage.totalTokens < config.maxTotalProviderTokens);
});

test("the default budget lets a thorough two-brew path finish beyond 60k reported tokens", async () => {
  let dispatches = 0;
  const config = getChatbotConfig({ CHATBOT_ENABLED: "true", OPENAI_API_KEY: "offline-placeholder" })!;
  const brew = (id: string) => ({ id, name: id === active ? "Active" : "Unlinked", stage: "PRIMARY",
    start_date: "2026-10-01T00:00:00Z", end_date: null, current_volume_liters: null });
  const adapter: AccountReadAdapter = {
    listBrews: async () => ({ rows: [brew(active), brew(empty)], hasMore: false }),
    getBrew: async id => ({ ...brew(id), latestReadings: [] }), getRecipe: async () => null,
    listRecipes: async () => ({ rows: [], hasMore: false }),
    getBrewSensorHistory: async () => { throw new Error("Unexpected raw history read"); },
    getBrewSensorSummary: async ({ id }) => summary(id === active),
    getBrewTimeline: async ({ id }) => ({ hasMore: false, rows: Array.from({ length: 6 }, (_, i) => ({
      id: `00000000-0000-4000-8000-00000000001${i}`, datetime: `2026-10-${10 + i}T00:00:00Z`,
      type: "GRAVITY", title: "Manual reading", note: null,
      gravity: id === active ? 1.02 - i * 0.004 : 1.04, temperature: null, temp_units: null,
      data: { source: "measured", readingRole: "GENERAL" },
    })) }),
  };
  const steps = [
    ["list_brews", { query: "Test Brew" }],
    ["get_brew", { id: active }],
    ["get_brew_timeline", { id: active }],
    ["summarize_brew_sensor_history", { id: active }],
    ["get_brew", { id: empty }],
    ["get_brew_timeline", { id: empty }],
    ["summarize_brew_sensor_history", { id: empty }],
    ["search_wiki", { query: "hydrometer" }],
    ["fetch_wiki_page", { url: "https://wiki.meadtools.com/en/faq/hydrometer" }],
  ] as const;
  const result = await runChatTurn({ userId: 7, maxOutputTokens: 1000, maxToolCalls: config.maxToolCalls,
    maxProviderCalls: config.maxProviderCalls, maxTotalProviderTokens: config.maxTotalProviderTokens, maxProviderInputCharacters: 60000,
    accountReadAdapter: adapter,
    wikiFetcher: async url => ({ ok: true, status: 200, url,
      headers: { get: () => "text/html" },
      text: async () => "<title>Hydrometer</title><main>Compare gravity measurements several days apart.</main>",
    }),
    request: { messages: [
      { role: "user", content: "Assess Active Test Brew." },
      { role: "assistant", content: "A prior assessment found falling sensor gravity, but completion is unconfirmed." },
      { role: "user", content: "Compare Active Test Brew with Unlinked Test Brew using manual history, sensor history and cited guidance." },
    ] },
    client: { async complete(request) {
      assert.equal(request.toolChoice, "auto");
      // Script provider-reported usage at the scale seen in the live comparison. No paid calls.
      const inputTokens = 7900;
      const step = steps[dispatches++];
      return { id: `comparison-${dispatches}`, model: "offline",
        usage: { inputTokens, cachedInputTokens: 0, outputTokens: 100, totalTokens: inputTokens + 100 },
        message: step ? { role: "assistant", content: null, tool_calls: [{ id: `compare-${dispatches}`,
          type: "function", function: { name: step[0], arguments: JSON.stringify(step[1]) } }] }
          : { role: "assistant", content: "Active has more automatic evidence, but neither summary alone confirms completion. Unlinked has no sensor data. Compare subsequent manual gravity measurements. Source: https://wiki.meadtools.com/en/faq/hydrometer" },
      };
    } },
  });
  assert.equal(dispatches, 10);
  assert.equal(result.toolResults.length, 9);
  for (const tool of result.toolResults) assert.equal((tool.result as { status: string }).status, "ok", tool.toolName);
  assert.match(result.answer, /Active has more/);
  assert.equal(result.usage.totalTokens, 80000);
  assert.ok(result.usage.totalTokens < config.maxTotalProviderTokens);
});
