import assert from "node:assert/strict";
import test from "node:test";
import type { FireworksCompletionRequest } from "./fireworks";
import {chatRequestSchema,runChatTurn,runDeterministicChatTurn} from "./chat-service";

function completion(options: {
  id: string;
  content?: string | null;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}) {
  return {
    id: options.id,
    model: "test-model",
    message: {
      role: "assistant" as const,
      content: options.content ?? null,
      tool_calls: options.toolCalls?.map((call) => ({
        id: call.id,
        type: "function" as const,
        function: {
          name: call.name,
          arguments: JSON.stringify(call.arguments),
        },
      })),
    },
    usage: {
      inputTokens: 12,
      cachedInputTokens: 2,
      outputTokens: 6,
      totalTokens: 18,
    },
  };
}

test("medium reasoning reaches tool requests and stops when the tool budget is exhausted", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return requests.length === 1
          ? completion({ id: "yeast", toolCalls: [{ id: "lookup", name: "search_yeasts", arguments: { query: "71B" } }] })
          : completion({ id: "answer", content: "Lalvin 71B is available." });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({ messages: [{ role: "user", content: "Which yeast could I use for blueberry mead?" }] }),
    reasoningEffort: "medium",
    maxOutputTokens: 1_000,
    maxToolCalls: 1,
    yeastLookup: async () => [{ id: 3, brand: "Lalvin", name: "71B", nitrogenRequirement: "Low", tolerance: 14, lowTemperature: 59, highTemperature: 86 }],
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[0]?.reasoningEffort, "medium");
  assert.equal(requests[1]?.reasoningEffort, undefined);
  assert.equal(requests[1]?.toolChoice, "none");
  assert.equal(result.usage.toolCalls, 1);
});

test("explicitly unrelated requests are rejected before the model", () => {
  const result = runDeterministicChatTurn({
    provider: "openai",
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "What is Bitcoin trading at?" }],
    }),
  });

  assert.equal(result?.usage.model, "deterministic-scope-check");
  assert.equal(result?.usage.requestIds.length, 0);
});

test("scrapping an active recipe draft clears it without a provider call", () => {
  const result = runDeterministicChatTurn({
    provider: "openai",
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Scrap the recipe draft you currently have." },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: {
          enabled: true,
          yeastBrand: "Lalvin",
          yeastStrain: "71B",
          nitrogenRequirement: "Medium",
          schedule: "tosna",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: false },
      },
    }),
  });

  assert.equal(result?.usage.model, "deterministic-draft-reset");
  assert.equal(result?.clearRecipeDraft, true);
  assert.equal(result?.recipeDraftInput, undefined);
});

test("a provider attempt is durably recorded before every dispatch", async () => {
  let providerCalled = false;

  await assert.rejects(
    runChatTurn({
      client: {
        async complete() {
          providerCalled = true;
          throw new Error("Provider should not run.");
        },
      },
      userId: 7,
      request: chatRequestSchema.parse({
        messages: [
          { role: "user", content: "Help me make a traditional mead." },
        ],
      }),
      maxOutputTokens: 500,
      maxToolCalls: 6,
      onProviderAttempt: () => {
        throw new Error("Unable to record provider attempt");
      },
    }),
    /Unable to record provider attempt/,
  );

  assert.equal(providerCalled, false);
});
