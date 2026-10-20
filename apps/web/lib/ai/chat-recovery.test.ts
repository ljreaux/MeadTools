import assert from "node:assert/strict";
import test from "node:test";
import { runChatTurn, ChatSafetyLimitError } from "./chat-service";
import type { ChatCompletionRequest, ChatModelClient } from "./chat-model";

const limits = { userId: 7, maxOutputTokens: 1000, maxToolCalls: 8 };
const request = { messages: [{ role: "user" as const, content: "Create an unsaved mead draft." }] };
const draft = {
  batchVolume: { value: 1, unit: "gal" }, targetAbv: 10, fermentationFinalGravity: 0.999,
  ingredients: [{ name: "Honey", role: "adjustable_fermentable" }, { name: "Water", role: "fill_liquid" }],
  nutrients: { enabled: true, yeastBrand: "Lalvin", yeastStrain: "71B", nitrogenRequirement: "Low", schedule: "tosna", numberOfAdditions: 4, goFermType: "none" },
  stabilizers: { enabled: false },
};
function scripted(steps: Array<string | { name: string; input: unknown }>, requests: ChatCompletionRequest[]): ChatModelClient {
  let index = 0;
  return { async complete(r) {
    requests.push({ ...r, messages: structuredClone(r.messages) });
    const step = steps[index++];
    assert.ok(step, "Unexpected provider dispatch");
    return { id: `response-${index}`, model: "offline", message: typeof step === "string"
      ? { role: "assistant", content: step }
      : { role: "assistant", content: null, tool_calls: [{ id: `call-${index}`, type: "function", function: { name: step.name, arguments: JSON.stringify(step.input) } }] },
      usage: { inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, totalTokens: 20 } };
  } };
}

test("the model can repair missing yeast and complete a draft without a forced sequence or renderer", async () => {
  const requests: ChatCompletionRequest[] = [];
  const answer = "The unsaved draft is ready for your review.";
  const result = await runChatTurn({ ...limits, request, yeastLookup: async () => [],
    client: scripted([
      { name: "build_recipe_draft", input: { ...draft, nutrients: { enabled: true } } },
      { name: "search_yeasts", input: { query: "71B" } },
      { name: "build_recipe_draft", input: draft }, answer,
    ], requests) });
  const results = result.toolResults as Array<{ result: { result: { status?: string } } }>;
  assert.equal(results[0].result.result.status, "needs_input");
  assert.equal(results[2].result.result.status, "recipe");
  assert.equal(result.answer, answer);
  assert.equal(requests.length, 4);
  assert.ok(requests.every(r => r.toolChoice === "auto"));
});

test("eight tool calls leave room for the model's final answer", async () => {
  const requests: ChatCompletionRequest[] = [];
  const steps = Array.from({ length: 8 }, () => ({ name: "search_yeasts", input: { query: "71B" } }));
  const result = await runChatTurn({ ...limits, request, maxProviderCalls: 10, yeastLookup: async () => [],
    client: scripted([...steps, "Here are the mead yeast findings."], requests) });
  assert.equal(result.usage.toolCalls, 8);
  assert.equal(requests.length, 9);
  assert.equal(requests.at(-1)?.toolChoice, "none");
  assert.equal(result.answer, "Here are the mead yeast findings.");
});

test("combined output and provider-token budgets stop the loop without another dispatch", async () => {
  for (const budget of [{ maxTotalOutputTokens: 128 }, { maxTotalProviderTokens: 20 }]) {
    const requests: ChatCompletionRequest[] = [];
    const client = scripted([{ name: "search_yeasts", input: { query: "71B" } }], requests);
    const result = await runChatTurn({ ...limits, ...budget, request, yeastLookup: async () => [],
      client: { async complete(r) {
        const completion = await client.complete(r);
        if (budget.maxTotalOutputTokens) completion.usage = { inputTokens: 10, cachedInputTokens: 0, outputTokens: 128, totalTokens: 138 };
        return completion;
      } } });
    assert.equal(requests.length, 1);
    assert.match(result.answer, /safe (?:output|provider-token) limit/);
    assert.equal(result.usage.totalTokens, budget.maxTotalOutputTokens ? 138 : 20);
  }
});

test("oversized context fails before any provider dispatch", async () => {
  const requests: ChatCompletionRequest[] = [];
  await assert.rejects(runChatTurn({ ...limits, request, maxProviderInputCharacters: 100,
    client: scripted([], requests) }), ChatSafetyLimitError);
  assert.equal(requests.length, 0);
});

test("a truncated completion does not trigger a hidden retry or expose its partial answer", async () => {
  let calls = 0;
  const result = await runChatTurn({ ...limits, request, client: { async complete() {
    calls++;
    return { id: "truncated", model: "offline", finishReason: "length", message: { role: "assistant", content: "Unfinished draft" }, usage: { inputTokens: 10, cachedInputTokens: 0, outputTokens: 10, totalTokens: 20 } };
  } } });
  assert.equal(calls, 1);
  assert.match(result.answer, /response limit/);
  assert.doesNotMatch(result.answer, /Unfinished draft/);
});

for (const hasPreviousDraft of [false, true]) {
  test(`explanation uses the successful revision from the current turn (prior draft: ${hasPreviousDraft})`, async () => {
    const { buildRecipeDraft } = await import("@meadtools/recipe-workflows");
    const previous = buildRecipeDraft(draft);
    assert.equal(previous.status, "recipe");
    if (previous.status !== "recipe") return;
    const revised = { ...draft, batchVolume: { value: 10, unit: "L" } };
    const result = await runChatTurn({ ...limits,
      request: { ...request, ...(hasPreviousDraft ? { activeRecipeData: previous.recipeData } : {}) },
      client: scripted([
        { name: "build_recipe_draft", input: revised },
        { name: "explain_recipe", input: { topic: "volume" } },
        "The revised mead draft is 10 L.",
      ], []),
    });
    const built = result.toolResults[0].result as { status: string; result: { status: string; derived: unknown } };
    const explained = result.toolResults[1].result as { status: string; result?: { status: string; derived: unknown } };
    assert.equal(built.result.status, "recipe");
    assert.equal(explained.status, "ok");
    assert.equal(explained.result?.status, "recipe");
    assert.deepEqual(explained.result?.derived, built.result.derived);
  });
}

test("an incomplete revision keeps the last successfully calculated draft available for explanation", async () => {
  const result = await runChatTurn({ ...limits, request,
    client: scripted([
      { name: "build_recipe_draft", input: draft },
      { name: "build_recipe_draft", input: { ...draft, nutrients: { enabled: true } } },
      { name: "explain_recipe", input: { topic: "abv" } },
      "The last completed mead draft remains available while we clarify the revision.",
    ], []),
  });
  const built = result.toolResults[0].result as { result: { derived: unknown } };
  const incomplete = result.toolResults[1].result as { result: { status: string } };
  const explained = result.toolResults[2].result as { status: string; result?: { derived: unknown } };
  assert.equal(incomplete.result.status, "needs_input");
  assert.equal(explained.status, "ok");
  assert.deepEqual(explained.result?.derived, built.result.derived);
});
