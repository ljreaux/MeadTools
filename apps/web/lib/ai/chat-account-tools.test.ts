import assert from "node:assert/strict";
import test from "node:test";
import { buildRecipeDraft } from "@meadtools/recipe-workflows";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import {
  accountReadOutputSchemas,
  executeHostedAgentTool,
  executeMcpAgentTool,
  type AccountReadAdapter,
  type AccountEntryRecord,
} from "@meadtools/recipe-agent";
import { runChatTurn } from "./chat-service";
import type { ChatModelClient, ChatCompletionRequest } from "./chat-model";

const brewId = "00000000-0000-4000-8000-000000000001";
const otherId = "00000000-0000-4000-8000-000000000002";
function recipeData() {
  const draft = buildRecipeDraft({
    batchVolume: { value: 2, unit: "gal" }, targetAbv: 10,
    fermentationFinalGravity: 0.999,
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    nutrients: { enabled: true, yeastBrand: "Lalvin", yeastStrain: "71B",
      nitrogenRequirement: "Medium", schedule: "tosna", numberOfAdditions: 4, goFermType: "none" },
    backsweetening: { targetFinalGravity: 1.015 },
    stabilizers: { enabled: true, type: "kmeta", phReading: 3.6 },
  });
  assert.ok(draft.status === "recipe");
  return draft.recipeData;
}
function adapter(overrides: Partial<AccountReadAdapter> = {}): AccountReadAdapter {
  return {
    listBrews: async () => ({ rows: [], hasMore: false }),
    getBrew: async () => null,
    getBrewTimeline: async () => null,
    getBrewSensorHistory: async () => null,
    getBrewSensorSummary: async () => null,
    listRecipes: async () => ({ rows: [], hasMore: false }),
    getRecipe: async () => null,
    ...overrides,
  };
}

test("hosted chat can page the shared sensor-history tool without exposing device details", async () => {
  const cursor = encodeURIComponent(JSON.stringify({ id: brewId, at: "2026-10-17T00:00:00.123456Z" }));
  const inputs: unknown[] = [];
  const requests: ChatCompletionRequest[] = [];
  const accountReadAdapter = adapter({ getBrewSensorHistory: async input => {
    inputs.push(input);
    return { rows: [{ id: brewId, datetime: input.cursor ? "2026-10-16T00:00:00Z" : "2026-10-17T00:00:00.123456Z",
      gravity: input.cursor ? 1.02 : 1.01, calculated_gravity: null, temperature: 20, temp_units: "C" }], hasMore: !input.cursor };
  } });
  const result = await runChatTurn({ userId: 7, maxOutputTokens: 1000, maxToolCalls: 8, accountReadAdapter,
    request: { messages: [{ role: "user", content: "Read the sensor history for my mead brew." }] },
    client: scriptedClient([
      { name: "get_brew_sensor_history", input: { id: brewId, limit: 1 } },
      { name: "get_brew_sensor_history", input: { id: brewId, limit: 1, cursor } },
      "The returned samples show falling gravity; these pages alone do not establish stability.",
    ], requests) });
  assert.equal(inputs.length, 2);
  assert.equal(result.toolResults.length, 2);
  assert.equal(requests.length, 3);
  assert.ok(requests[0].tools?.some(t => t.function.name === "get_brew_sensor_history"));
  assert.match(JSON.stringify(result.toolResults), /1\.01|1\.02/);
  assert.doesNotMatch(JSON.stringify(result.toolResults), /device_id|coefficients":/);
});
function scriptedClient(steps: Array<{ name: string; input: object } | string>, requests: ChatCompletionRequest[] = []): ChatModelClient {
  let index = 0;
  return { async complete(request) {
    requests.push(structuredClone(request));
    const step = steps[index++];
    assert.ok(step, "Unexpected provider call");
    return {
      id: `response-${index}`, model: "mock",
      message: typeof step === "string"
        ? { role: "assistant", content: step }
        : { role: "assistant", content: null, tool_calls: [{
          id: `call-${index}`, type: "function", function: { name: step.name, arguments: JSON.stringify(step.input) },
        }] },
      usage: { inputTokens: 12, cachedInputTokens: 0, outputTokens: 6, totalTokens: 18 },
    };
  } };
}
const limits = { userId: 42, maxOutputTokens: 1_000, maxToolCalls: 6 };

test("saved recipe calculator walkthrough does not force wiki routing or a draft", async () => {
  const requests: ChatCompletionRequest[] = [];
  const result = await runChatTurn({ ...limits,
    client: scriptedClient([
      { name: "list_recipes", input: { query: "Metric Traditional Test" } },
      { name: "get_recipe", input: { id: 6 } },
      "Here are the saved gravity, alcohol, volume, nutrient and stabilizer estimates.",
    ], requests),
    request: { messages: [{ role: "user", content: "Find my saved recipe called Metric Traditional Test and walk me through its calculated gravity, finished alcohol, volumes, nutrients and stabilizers." }] },
    accountReadAdapter: adapter({
      listRecipes: async () => ({ rows: [{ id: 6, name: "Metric Traditional Test", private: true }], hasMore: false }),
      getRecipe: async () => ({ id: 6, name: "Metric Traditional Test", private: true, dataV2: recipeData() }),
    }),
  });
  assert.deepEqual(result.toolResults.map(t => t.toolName), ["list_recipes", "get_recipe"]);
  assert.match(result.answer, /saved gravity/);
  assert.ok(requests.every(r => r.toolChoice === "auto"));
  assert.equal(requests.length, 3);
});

test("recipe requests do not inject a forced draft retry after a model answer", async () => {
  const requests: ChatCompletionRequest[] = [];
  const answer = "I can build a calculated draft after you choose a yeast.";
  const result = await runChatTurn({ ...limits,
    client: scriptedClient([answer], requests),
    request: { messages: [{ role: "user", content: "Create a one gallon traditional mead recipe." }] },
  });
  assert.equal(result.answer, answer);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].toolChoice, "auto");
});

test("hosted and MCP reads share calculations, advanced settings and tool validation", async () => {
  const data = recipeData();
  data.lossAdjustment = { enabled: true, mode: "manual", percentage: 10 };
  data.nutrients!.settings.maxGpl.fermK = "0.25";
  const options = { accountReadAdapter: adapter({ getRecipe: async () => ({ id: 1, name: "Private", private: true, dataV2: data }) }) };
  const hosted = await executeHostedAgentTool("get_recipe", { id: 1 }, options);
  assert.deepEqual(hosted, await executeMcpAgentTool("get_recipe", { id: 1 }, options));
  assert.ok(hosted.status === "ok" && "savedRecipe" in hosted.result);
  assert.deepEqual(hosted.result.savedRecipe.derivedEstimates, calculateRecipeDerivedApiResponse(data).derived);
  assert.equal(hosted.result.savedRecipe.inputs?.nutrients?.settings.maxGpl.fermK, "0.25");
  assert.match(hosted.result.savedRecipe.calculationContext!.units, /separate grams/);
  assert.match(hosted.result.savedRecipe.calculationContext!.nutrientDraftLimitation, /cannot change or promise to retain/);
  assert.equal((await executeHostedAgentTool("get_recipe", { id: 1, userId: 99 }, options)).status, "invalid_input");
  assert.equal((await executeHostedAgentTool("get_recipe", { id: 1 })).status, "unavailable");
});

test("hosted conversation finds and analyzes an owned private recipe without an attachment", async () => {
  const data = recipeData();
  const requests: ChatCompletionRequest[] = [];
  const result = await runChatTurn({ ...limits,
    client: scriptedClient([
      { name: "list_recipes", input: { query: "Blueberry" } },
      { name: "get_recipe", input: { id: 8 } },
      "Here are the saved recipe estimates; no changes were saved.",
    ], requests),
    request: { messages: [{ role: "user", content: "Analyze my saved Blueberry mead recipe." }] },
    accountReadAdapter: adapter({
      listRecipes: async ({ query }) => {
        assert.equal(query, "Blueberry");
        return { rows: [{ id: 8, name: "Blueberry", private: true }], hasMore: false };
      },
      getRecipe: async (id) => {
        assert.equal(id, 8);
        return { id, name: "Blueberry", private: true, dataV2: data };
      },
    }),
  });
  assert.deepEqual(result.toolResults.map((tool) => tool.toolName), ["list_recipes", "get_recipe"]);
  assert.equal(result.recipeDraftInput, undefined);
  for (const request of requests) {
    assert.equal(request.toolChoice, "auto");
    assert.ok(request.tools?.some((tool) => tool.function.name === "get_recipe"));
    assert.ok(!request.tools?.some((tool) => tool.function.name === "get_selected_account_context"));
    assert.ok(!request.tools?.some((tool) => "outputSchema" in tool.function));
  }
});

test("duplicate names can be clarified without forcing a draft or picking an ID", async () => {
  const result = await runChatTurn({ ...limits,
    client: scriptedClient([{ name: "list_recipes", input: { query: "Summer" } }, "I found two Summer recipes. Which one did you mean?"]),
    request: { messages: [{ role: "user", content: "Find my Summer recipe." }] },
    accountReadAdapter: adapter({ listRecipes: async () => ({ rows: [1, 2].map((id) => ({ id, name: "Summer", private: true })), hasMore: false }) }),
  });
  assert.equal(result.toolResults.length, 1);
  assert.match(result.answer, /Which one/);
  assert.equal(result.recipeDraftInput, undefined);
});

test("optional picker is a hint to the ordinary shared read path", async () => {
  const data = recipeData();
  const requests: ChatCompletionRequest[] = [];
  const result = await runChatTurn({ ...limits,
    client: scriptedClient([{ name: "get_recipe", input: { id: 1 } }, "We can discuss lower strength while retaining this recipe's character."], requests),
    request: {
      messages: [{ role: "user", content: "Discuss lower alcohol options for this mead recipe." }],
      selectedAccountContext: { kind: "recipe", label: "UNTRUSTED_NAME", recipe: { id: 1, name: "UNTRUSTED_NAME" } },
    },
    accountReadAdapter: adapter({ getRecipe: async () => ({ id: 1, name: "UNTRUSTED_NAME", private: true, dataV2: data }) }),
  });
  assert.equal(requests[0].toolChoice, "auto");
  assert.doesNotMatch(requests[0].messages[0].content!, /UNTRUSTED_NAME/);
  assert.equal(result.recipeDraftInput, undefined);
});

const entry = (id: string, data: unknown): AccountEntryRecord => ({
  id, datetime: "2026-10-17T00:00:00Z", type: "ADDITION", title: null,
  note: null, gravity: null, temperature: null, temp_units: null, data,
});
const ownedBrew = { id: brewId, name: "Summer", stage: "PRIMARY", start_date: "2026-10-01T00:00:00Z", end_date: null, current_volume_liters: null, latestReadings: [] };

test("brew discovery, paged history and reviewable proposal use the same owned read tools without attachments", async () => {
  let page = 0;
  const result = await runChatTurn({ ...limits,
    client: scriptedClient([
      { name: "list_brews", input: { query: "Summer" } },
      { name: "get_brew", input: { id: brewId } },
      { name: "get_brew_timeline", input: { id: brewId, limit: 1 } },
      { name: "get_brew_timeline", input: { id: brewId, limit: 1, cursor: encodeURIComponent(JSON.stringify({ id: brewId, at: "2026-10-17T00:00:00Z" })) } },
      { name: "prepare_brew_action", input: { type: "NOTE", note: "Review nutrient records before next addition." } },
      "Review this note before confirming it. Nothing has been logged.",
    ]),
    request: { messages: [{ role: "user", content: "Find my Summer brew and review its recorded additions, then propose a note: Review nutrient records before next addition." }] },
    accountReadAdapter: adapter({
      listBrews: async () => ({ rows: [ownedBrew], hasMore: false }),
      getBrew: async (id) => id === brewId ? ownedBrew : null,
      getBrewTimeline: async (input) => {
        if (page++ === 1) assert.ok(input.cursor);
        return { rows: [entry(page === 1 ? brewId : otherId, { name: "Fermaid O", kind: "NUTRIENT", amount: 1.5, unit: "g", opaque: "DO_NOT_LEAK" })], hasMore: page === 1 };
      },
    }),
  });
  assert.equal(page, 2);
  assert.doesNotMatch(JSON.stringify(result.toolResults), /DO_NOT_LEAK/);
  const proposal = result.toolResults.find((tool) => tool.toolName === "prepare_brew_action")!.result as any;
  assert.equal(proposal.status, "ok");
  assert.equal(proposal.result.target.brewId, brewId);
  assert.equal(proposal.result.kind, "create_brew_entry");
});

test("a proposal cannot use an attachment or an unsuccessful read as authorization", async () => {
  for (const steps of [
    [{ name: "prepare_brew_action", input: { type: "NOTE", note: "Test" } }],
    [{ name: "get_brew", input: { id: brewId } }, { name: "get_brew", input: { id: otherId } }, { name: "prepare_brew_action", input: { type: "NOTE", note: "Test" } }],
  ]) {
    const result = await runChatTurn({ ...limits,
      client: scriptedClient([...steps, "The requested brew is unavailable; nothing was changed."]),
      request: { messages: [{ role: "user", content: "Propose a note for my mead brew." }] },
      accountReadAdapter: adapter({ getBrew: async (id) => id === brewId ? ownedBrew : null }),
    });
    const proposal = result.toolResults.find((tool) => tool.toolName === "prepare_brew_action")!.result as any;
    assert.equal(proposal.status, "error");
  }
});


test("first-turn account browsing is in scope without an attachment or prior history", async () => {
  const result = await runChatTurn({ ...limits,
    client: scriptedClient([{ name: "list_brews", input: {} }, "You have no saved brews."]),
    request: { messages: [{ role: "user", content: "Show my brews." }] },
    accountReadAdapter: adapter(),
  });
  assert.equal(result.toolResults[0]?.toolName, "list_brews");
});

test("account tools are omitted when an authenticated read adapter was not supplied", async () => {
  const requests: ChatCompletionRequest[] = [];
  await runChatTurn({ ...limits,
    client: scriptedClient(["I cannot retrieve saved records in this environment."], requests),
    request: { messages: [{ role: "user", content: "Find my saved mead recipe." }] },
  });
  assert.ok(!requests[0].tools?.some((tool) => tool.function.name === "get_recipe"));
});

test("account reads consume the existing tool budget and cannot execute after it is exhausted", async () => {
  let recordReads = 0;
  const result = await runChatTurn({ ...limits, maxToolCalls: 1, maxProviderCalls: 3,
    client: scriptedClient([
      { name: "list_recipes", input: {} },
      { name: "get_recipe", input: { id: 1 } },
      "I reached the tool limit; please continue with a follow-up.",
    ]),
    request: { messages: [{ role: "user", content: "Find my saved mead recipes." }] },
    accountReadAdapter: adapter({ getRecipe: async () => { recordReads++; return null; } }),
  });
  assert.equal(recordReads, 0);
  const blocked = result.toolResults[1].result as { status: string; message: string };
  assert.equal(blocked.status, "error");
  assert.match(blocked.message, /tool-call limit/);
});

test("minimal orchestration retains the current-turn owned-brew requirement for proposals", async () => {
  for (const readFirst of [false, true]) {
    const result = await runChatTurn({ ...limits,
      client: scriptedClient([
        ...(readFirst ? [{ name: "get_brew", input: { id: brewId } }] : []),
        { name: "prepare_brew_action", input: { type: "NOTE", note: "Review readings." } },
        "Nothing was logged; review any available proposal.",
      ]),
      request: { messages: [{ role: "user", content: "Propose a note for my mead brew." }] },
      accountReadAdapter: adapter({ getBrew: async id => id === brewId ? ownedBrew : null }),
    });
    const proposal = result.toolResults.find(t => t.toolName === "prepare_brew_action")!.result as { status: string };
    assert.equal(proposal.status, readFirst ? "ok" : "error");
  }
});

test("model-led lookup repair retains unknown history, measured direction and fetched evidence", async () => {
  const requests: ChatCompletionRequest[] = [];
  const requestedIds: string[] = [];
  const stats = { validCount: 3, minimum: 1, maximum: 1.1, first: 1.1, last: 1,
    firstAt: "2026-10-07T00:00:00Z", lastAt: "2026-10-09T00:00:00Z", range: 0.1, netChange: -0.1 };
  // Distinct interior values can have these identical extrema/endpoints; equality stays unassessed.
  const sensorSummary = { window: { from: stats.firstAt, to: stats.lastAt, basis: "explicit" as const },
    coverage: "all_samples_in_window" as const, sampleCount: 3, firstSampleAt: stats.firstAt, lastSampleAt: stats.lastAt,
    gravityUnit: "SG" as const, measured: stats, deviceCalculated: stats,
    maxGapSeconds: 86400, gapsOverOneHour: 2, repeatedTimestamps: 0,
    correctionProvenance: "stored_device_calculation" as const, stabilityAssessment: "not_assessed" as const };
  const accountReadAdapter = adapter({
    getBrewSensorSummary: async ({ id }) => { requestedIds.push(id); return id === brewId ? sensorSummary : null; },
    getBrewTimeline: async () => ({ hasMore: false, rows: [
      { id: brewId, datetime: stats.firstAt, type: "GRAVITY", title: null, note: null,
        gravity: 1.1, temperature: null, temp_units: null, data: { source: "measured", readingRole: "OG" } },
      { id: otherId, datetime: stats.lastAt, type: "GRAVITY", title: null, note: null,
        gravity: 1.055, temperature: null, temp_units: null, data: { source: "measured" } },
    ] }),
  });
  const steps = [
    { name: "summarize_brew_sensor_history", input: { id: otherId } },
    { name: "summarize_brew_sensor_history", input: { id: brewId } },
    { name: "get_brew_timeline", input: { id: brewId } },
    { name: "fetch_wiki_page", input: { url: "https://wiki.meadtools.com/en/faq/hydrometer" } },
    "Measured gravity decreased from 1.100 to 1.055. The failed lookup leaves the other history unknown. Matching sensor summary statistics do not prove identical readings. Completion is unconfirmed. Source: https://wiki.meadtools.com/en/faq/hydrometer",
  ];
  const result = await runChatTurn({ ...limits, accountReadAdapter,
    client: scriptedClient(steps, requests),
    request: { messages: [{ role: "user", content: "Compare whether my two mead brews are finished and ready to rack." }] },
    wikiFetcher: async url => ({ ok: true, status: 200, url,
      headers: { get: () => "text/html" },
      text: async () => "<title>Using a Hydrometer</title><main>Compare successive gravity readings to assess stability.</main>",
    }),
  });
  assert.ok(requests.every(request => request.toolChoice === "auto"));
  assert.equal(requests.length, 5);
  assert.match(String(requests[0].messages[0].content), /readiness to rack.*not confirmed/);
  const failed = accountReadOutputSchemas.summarize_brew_sensor_history.parse(result.toolResults[0].result);
  assert.equal(failed.status, "not_found");
  if (failed.status === "not_found") {
    assert.equal(failed.dataAvailability, "unknown");
    assert.deepEqual(failed.requestedRecord, { kind: "brew", id: otherId });
  }
  const repaired = accountReadOutputSchemas.summarize_brew_sensor_history.parse(result.toolResults[1].result);
  assert.equal(repaired.status, "ok");
  if (repaired.status === "ok") {
    assert.equal(repaired.result.seriesComparison, "not_assessed");
    assert.equal(repaired.result.brewId, brewId);
  }
  assert.deepEqual(requestedIds, [otherId, brewId]);
  const timeline = accountReadOutputSchemas.get_brew_timeline.parse(result.toolResults[2].result);
  assert.equal(timeline.status, "ok");
  if (timeline.status === "ok") {
    assert.equal(timeline.result.brewId, brewId);
    assert.equal(timeline.result.gravityChange.direction, "decreased");
    assert.equal(timeline.result.gravityChange.activityAssessment, "not_assessed");
  }
  assert.equal((result.toolResults[3].result as { status: string }).status, "ok");
  assert.match(result.answer, /Source: https:\/\/wiki.meadtools.com/);
  assert.deepEqual(result.toolResults[1].result, await executeMcpAgentTool("summarize_brew_sensor_history", { id: brewId }, { accountReadAdapter }));
  assert.deepEqual(result.toolResults[2].result, await executeMcpAgentTool("get_brew_timeline", { id: brewId }, { accountReadAdapter }));
});
