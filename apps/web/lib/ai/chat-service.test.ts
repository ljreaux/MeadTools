import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateGravityTarget,
  buildRecipeDraft,
  explainRecipe
} from "@meadtools/recipe-workflows";
import type { ChatModelClient, FireworksCompletionRequest } from "./fireworks";
import {
  chatRequestSchema,
  calculatorLinkForProcessMessage,
  directRecipeToolAnswer,
  removeUnrequestedCalculatorDoses,
  removeCompletedRecipeFollowUp,
  runChatTurn
} from "./chat-service";
import type { WikiFetcher } from "@meadtools/wiki-knowledge";

const nutrientPlan = {
  enabled: true as const,
  yeastBrand: "Lalvin",
  yeastStrain: "71B",
  nitrogenRequirement: "Medium",
  schedule: "tosna",
  numberOfAdditions: 4,
  goFermType: "Go-Ferm"
};

const wikiFetcher: WikiFetcher = async (url) => ({
  ok: true,
  status: 200,
  url,
  headers: { get: (name) => (name === "content-type" ? "text/html" : null) },
  text: async () => "<main>Reviewed MeadTools wiki guidance.</main>"
});

test("process calculator routing prefers the dedicated MeadTools calculators", () => {
  assert.deepEqual(
    calculatorLinkForProcessMessage("How much potassium metabisulfite and sorbate do I need?"),
    { label: "Stabilizer calculator", href: "/stabilizers" }
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage("What should I do after I stabilize my mead?"),
    { label: "Stabilizer calculator", href: "/stabilizers" }
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage("How should I calculate a Fermaid K schedule?"),
    { label: "Nutrient calculator", href: "/nute-calc" }
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage("How do I correct a refractometer reading after fermentation?"),
    {
      label: "Refractometer correction calculator",
      href: "/extra-calcs/refractometer-correction"
    }
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage("How much priming sugar do I need for carbonation?"),
    { label: "Priming sugar calculator", href: "/extra-calcs/priming-sugar" }
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage("How much sulfite should I add?"),
    { label: "Sulfite calculator", href: "/extra-calcs/sulfite" }
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage("What is causing a sulfur aroma?"),
    undefined
  );
});

test("exact calculator requests link to MeadTools without invoking the model", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error("The model should not be called for a calculator route.");
      }
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Can you calculate the exact sulfite amount for me?" }]
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6
  });

  assert.equal(result.usage.model, "deterministic-calculator-routing");
  assert.match(result.answer, /\[Sulfite calculator\]\(\/extra-calcs\/sulfite\)/);
});

test("stabilization process answers keep the workflow but remove unsolicited doses", () => {
  const request = chatRequestSchema.parse({
    messages: [{
      role: "user",
      content: "My mead is stable and I want to stabilize it before backsweetening. What should I do next?"
    }]
  });
  const answer = removeUnrequestedCalculatorDoses(
    [
      "1. Confirm fermentation is complete with stable hydrometer readings.",
      "2. Add 2.2 g of potassium metabisulfite (one tablet per gallon).",
      "3. Add 2.5 g of potassium sorbate alongside it.",
      "4. Wait 24 hours before backsweetening."
    ].join("\n\n"),
    request
  );

  assert.match(answer, /Confirm fermentation is complete/);
  assert.match(answer, /Wait 24 hours/);
  assert.doesNotMatch(answer, /2\.2 g|2\.5 g|tablet per gallon/);
});

test("calculator-only brewing vocabulary stays inside the chatbot scope", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error("The model should not be called for a calculator route.");
      }
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "How much priming sugar do I need for carbonation?" }]
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6
  });

  assert.equal(result.usage.model, "deterministic-calculator-routing");
  assert.match(result.answer, /\[Priming sugar calculator\]\(\/extra-calcs\/priming-sugar\)/);
});

test("completed drafts do not end with a conversational follow-up", () => {
  assert.equal(
    removeCompletedRecipeFollowUp(
      "## Blackberry Mead\n\nIngredients\n\n- Honey\n\nLet me know if you'd like to change the amounts."
    ),
    "## Blackberry Mead\n\nIngredients\n\n- Honey"
  );
  assert.equal(
    removeCompletedRecipeFollowUp(
      "## Blueberry Mead\n\nThis is an unsaved draft. If you'd like to save it or adjust any details, let me know."
    ),
    "## Blueberry Mead\n\nThis is an unsaved draft."
  );
});

test("completed recipe answers render the same backsweetening ingredient returned for saving", () => {
  const workflow = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.999,
    backsweetening: { targetFinalGravity: 1.015 },
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    nutrients: nutrientPlan
  });
  const answer = directRecipeToolAnswer("build_recipe_draft", {
    status: "ok",
    result: workflow
  });

  assert.equal(workflow.status, "recipe");
  assert.match(answer ?? "", /Honey \(backsweetening\)/);
  assert.match(answer ?? "", /\*\*Backsweetened FG:\*\* 1\.015/);
  assert.doesNotMatch(answer ?? "", /Let me know if/);
});

test("completed recipe drafts render practical ingredient and additive amounts", () => {
  const workflow = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.999,
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    additives: [{ name: "Pectic Enzyme", amount: 0.4, unit: "tsp" }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });
  const answer = directRecipeToolAnswer("build_recipe_draft", {
    status: "ok",
    result: workflow
  });

  assert.equal(workflow.status, "recipe");
  assert.match(answer ?? "", /\| Honey \| [\d.]+ lb \| Primary \|/);
  assert.match(answer ?? "", /\| Water \| [\d.]+ gal \| Primary \|/);
  assert.match(answer ?? "", /\| Pectic Enzyme \| 0\.4 tsp \|/);
  assert.doesNotMatch(answer ?? "", /\| Honey \| 0\.\d{4,} gal \|/);
});

test("recipe intake groups the workflow questions into at most three prompts", () => {
  const answer = directRecipeToolAnswer("build_recipe_draft", {
    status: "ok",
    result: buildRecipeDraft({})
  });

  assert.match(answer ?? "", /\*\*Batch and targets:\*\*/);
  assert.match(answer ?? "", /\*\*Ingredients:\*\*/);
  assert.match(answer ?? "", /\*\*Yeast, nutrients, and stabilization:\*\*/);
  assert.ok((answer?.match(/^-/gm) ?? []).length <= 3);
});

test("chat turn executes a wiki search and meters every provider call", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return {
          id: "request-1",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "tool-1",
                type: "function",
                function: { name: "search_wiki", arguments: '{"query":"nutrient schedule"}' }
              }
            ]
          },
          usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110, cachedInputTokens: 20 }
        };
      }
      if (requests.length === 2) {
        return {
          id: "request-2",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "tool-2",
                type: "function",
                function: {
                  name: "fetch_wiki_page",
                  arguments: '{"url":"https://wiki.meadtools.com/en/process/nutrient_schedules"}'
                }
              }
            ]
          },
          usage: { inputTokens: 200, outputTokens: 20, totalTokens: 220, cachedInputTokens: 50 }
        };
      }
      return {
        id: "request-3",
        model: "test-model",
        message: { role: "assistant", content: "🍯 Use the Nutrient Schedules wiki page. ⚠️" },
        usage: { inputTokens: 300, outputTokens: 30, totalTokens: 330, cachedInputTokens: 80 }
      };
    }
  };
  const events: string[] = [];

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "What nutrient schedule should I follow?" }]
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
    wikiFetcher,
    onEvent: (event) => {
      events.push(`${event.type}:${event.toolName}`);
    }
  });

  assert.match(result.answer, /^Use the Nutrient Schedules wiki page\./);
  assert.match(result.answer, /https:\/\/wiki\.meadtools\.com\/en\/process\/nutrient_schedules/);
  assert.deepEqual(result.toolResults.map((tool) => tool.toolName), ["search_wiki", "fetch_wiki_page"]);
  assert.deepEqual(events, [
    "tool_call:search_wiki",
    "tool_result:search_wiki",
    "tool_call:fetch_wiki_page",
    "tool_result:fetch_wiki_page"
  ]);
  assert.deepEqual(result.usage, {
    provider: "fireworks",
    model: "test-model",
    inputTokens: 600,
    outputTokens: 60,
    totalTokens: 660,
    cachedInputTokens: 150,
    requestIds: ["request-1", "request-2", "request-3"],
    toolCalls: 2,
    latencyMs: result.usage.latencyMs
  });
  assert.ok(result.usage.latencyMs >= 0);
  assert.equal(requests[1]?.messages.at(-2)?.role, "tool");
  assert.equal(requests[1]?.messages.at(-1)?.role, "system");
  assert.equal(requests[2]?.messages.at(-2)?.role, "tool");
  assert.equal(requests[2]?.messages.at(-1)?.role, "system");
});

test("a selected account record is loaded through a forced read-only tool", async () => {
  const draft = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.996,
    ingredients: [{ name: "Wildflower Honey", role: "adjustable_fermentable" }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });
  assert.equal(draft.status, "recipe");
  if (draft.status !== "recipe") return;

  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return {
            id: "selected-context-tool",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{
                id: "context-tool-1",
                type: "function",
                function: { name: "get_selected_account_context", arguments: "{}" }
              }]
            },
            usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
          };
        }
        return {
          id: "selected-context-answer",
          model: "test-model",
          message: { role: "assistant", content: "Your selected recipe is a one-gallon traditional." },
          usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20, cachedInputTokens: 0 }
        };
      }
    },
    userId: 7,
    request: {
      ...chatRequestSchema.parse({
        messages: [{ role: "user", content: "What should I adjust in this recipe?" }]
      }),
      selectedAccountContext: {
        kind: "recipe",
        label: "Recipe: Summer Traditional",
        recipe: { id: 42, name: "Summer Traditional", dataV2: draft.recipeData }
      }
    },
    maxOutputTokens: 500,
    maxToolCalls: 6
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "get_selected_account_context" }
  });
  assert.equal(result.toolResults[0]?.toolName, "get_selected_account_context");
  assert.deepEqual(
    (result.toolResults[0]?.result as { result?: { kind?: string } })?.result,
    { kind: "recipe", label: "Recipe: Summer Traditional", recipe: { id: 42, name: "Summer Traditional", dataV2: draft.recipeData } }
  );
  assert.equal(requests[1]?.messages.at(-2)?.role, "tool");
  assert.match(result.answer, /selected recipe/);
});

test("a selected recipe sweetness follow-up retrieves a MeadTools source", async () => {
  const draft = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.996,
    ingredients: [{ name: "Wildflower Honey", role: "adjustable_fermentable" }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });
  assert.equal(draft.status, "recipe");
  if (draft.status !== "recipe") return;

  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return {
            id: "selected-context-tool",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{
                id: "context-tool-1",
                type: "function",
                function: { name: "get_selected_account_context", arguments: "{}" }
              }]
            },
            usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
          };
        }
        if (requests.length === 2) {
          return {
            id: "sweetness-wiki-search",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{
                id: "wiki-search-1",
                type: "function",
                function: { name: "search_wiki", arguments: '{"query":"backsweetening"}' }
              }]
            },
            usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16, cachedInputTokens: 0 }
          };
        }
        if (requests.length === 3) {
          return {
            id: "sweetness-wiki-fetch",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{
                id: "wiki-fetch-1",
                type: "function",
                function: {
                  name: "fetch_wiki_page",
                  arguments: '{"url":"https://wiki.meadtools.com/en/faq/stabilization_and_backsweetening"}'
                }
              }]
            },
            usage: { inputTokens: 14, outputTokens: 4, totalTokens: 18, cachedInputTokens: 0 }
          };
        }
        return {
          id: "selected-context-answer",
          model: "test-model",
          message: { role: "assistant", content: "This recipe finishes dry, so stabilize it before backsweetening." },
          usage: { inputTokens: 14, outputTokens: 8, totalTokens: 22, cachedInputTokens: 0 }
        };
      }
    },
    userId: 7,
    request: {
      ...chatRequestSchema.parse({
        messages: [{ role: "user", content: "What should I adjust if I want this to finish a little sweeter?" }]
      }),
      selectedAccountContext: {
        kind: "recipe",
        label: "Recipe: Summer Traditional",
        recipe: { id: 42, name: "Summer Traditional", dataV2: draft.recipeData }
      }
    },
    maxOutputTokens: 500,
    maxToolCalls: 6,
    wikiFetcher
  });

  assert.deepEqual(requests.map((request) => request.toolChoice), [
    { type: "function", function: { name: "get_selected_account_context" } },
    { type: "function", function: { name: "search_wiki" } },
    { type: "function", function: { name: "fetch_wiki_page" } },
    "auto"
  ]);
  assert.deepEqual(result.toolResults.map((tool) => tool.toolName), [
    "get_selected_account_context",
    "search_wiki",
    "fetch_wiki_page"
  ]);
  assert.match(result.answer, /Source: \[MeadTools wiki\]\(https:\/\/wiki\.meadtools\.com\//);
});

test("a selected brew next-step follow-up retrieves a MeadTools source", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        const toolName = requests.length === 1
          ? "get_selected_account_context"
          : requests.length === 2
            ? "search_wiki"
            : requests.length === 3
              ? "fetch_wiki_page"
              : undefined;
        if (toolName) {
          return {
            id: `next-step-${requests.length}`,
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [{
                id: `next-step-tool-${requests.length}`,
                type: "function",
                function: {
                  name: toolName,
                  arguments: toolName === "search_wiki"
                    ? '{"query":"fermentation"}'
                    : toolName === "fetch_wiki_page"
                      ? '{"url":"https://wiki.meadtools.com/en/process/fermentation"}'
                      : "{}"
                }
              }]
            },
            usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
          };
        }
        return {
          id: "next-step-answer",
          model: "test-model",
          message: { role: "assistant", content: "Continue monitoring gravity and fermentation temperature." },
          usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20, cachedInputTokens: 0 }
        };
      }
    },
    userId: 7,
    request: {
      ...chatRequestSchema.parse({
        messages: [{ role: "user", content: "What should I do next with this batch?" }]
      }),
      selectedAccountContext: {
        kind: "brew",
        label: "Brew: Summer Traditional",
        brew: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Summer Traditional",
          stage: "PRIMARY",
          startDate: "2026-08-01T00:00:00.000Z",
          endDate: null,
          currentVolumeLiters: null,
          latestGravity: null,
          recipeName: null,
          recipeSnapshot: null,
          recentEntries: []
        }
      }
    },
    maxOutputTokens: 500,
    maxToolCalls: 6,
    wikiFetcher
  });

  assert.deepEqual(requests.slice(0, 3).map((request) => request.toolChoice), [
    { type: "function", function: { name: "get_selected_account_context" } },
    { type: "function", function: { name: "search_wiki" } },
    { type: "function", function: { name: "fetch_wiki_page" } }
  ]);
  assert.match(result.answer, /Source: \[MeadTools wiki\]\(https:\/\/wiki\.meadtools\.com\//);
});

test("a selected account record does not bypass the off-topic scope gate", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error("The scope guard should not call the model.");
      }
    },
    userId: 7,
    request: {
      ...chatRequestSchema.parse({
        messages: [{ role: "user", content: "What is Bitcoin trading at right now?" }]
      }),
      selectedAccountContext: {
        kind: "brew",
        label: "Brew: Summer Traditional",
        brew: {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Summer Traditional",
          stage: "PRIMARY",
          startDate: "2026-08-01T00:00:00.000Z",
          endDate: null,
          currentVolumeLiters: null,
          latestGravity: null,
          recipeName: null,
          recipeSnapshot: null,
          recentEntries: []
        }
      }
    },
    maxOutputTokens: 500,
    maxToolCalls: 6
  });

  assert.equal(
    result.answer,
    "I can help with MeadTools, mead recipes, and mead-brewing process questions. What would you like to make or troubleshoot?"
  );
  assert.equal(result.usage.model, "deterministic-scope-check");
});

test("chat turn stops before an unbounded provider loop", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        return {
          id: `request-${calls}`,
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: `tool-${calls}`,
                type: "function",
                function: { name: "search_wiki", arguments: '{"query":"nutrients"}' }
              }
            ]
          },
          usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110, cachedInputTokens: 0 }
        };
      }
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "How should I handle a nutrient schedule?" }]
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
    maxProviderCalls: 2,
    maxTotalOutputTokens: 500
  });

  assert.equal(calls, 2);
  assert.equal(result.usage.requestIds.length, 2);
  assert.match(result.answer, /safe provider-call limit/);
});

test("chat turn rejects an oversized provider context before calling the model", async () => {
  let called = false;
  await assert.rejects(
    runChatTurn({
      client: {
        async complete() {
          called = true;
          throw new Error("The provider should not be called.");
        }
      },
      userId: 7,
      request: chatRequestSchema.parse({
        messages: [{ role: "user", content: "How should I stabilize a traditional mead?" }]
      }),
      maxOutputTokens: 500,
      maxToolCalls: 6,
      maxProviderInputCharacters: 20
    }),
    /safe provider-context limit/
  );
  assert.equal(called, false);
});

test("chat requests require the latest message to be from the user", () => {
  assert.equal(
    chatRequestSchema.safeParse({
      messages: [{ role: "assistant", content: "Hello" }]
    }).success,
    false
  );
});

test("unrelated requests are refused before they reach the model", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      throw new Error("The scope guard should not call the model.");
    }
  };

  for (const content of [
    "What is the capital of France?",
    "Can you write my resignation letter?",
    "What is Bitcoin trading at right now?"
  ]) {
    const result = await runChatTurn({
      client,
      userId: 7,
      request: chatRequestSchema.parse({
        messages: [
          { role: "user", content: "How should I stabilize a traditional mead?" },
          { role: "assistant", content: "Take two stable hydrometer readings first." },
          { role: "user", content }
        ]
      }),
      maxOutputTokens: 500,
      maxToolCalls: 6
    });

    assert.equal(
      result.answer,
      "I can help with MeadTools, mead recipes, and mead-brewing process questions. What would you like to make or troubleshoot?"
    );
    assert.equal(result.usage.model, "deterministic-scope-check");
    assert.equal(result.usage.toolCalls, 0);
  }

  assert.equal(requests.length, 0);
});

test("German mead questions stay inside the chatbot scope", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "german-mead-question",
          model: "test-model",
          message: { role: "assistant", content: "Ich helfe dir beim Stabilisieren deines Mets." },
          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
        };
      }
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Wie stabilisiere ich mein Met?" }]
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6
  });

  assert.equal(result.answer, "Ich helfe dir beim Stabilisieren deines Mets.");
  assert.equal(requests.length, 1);
});

test("a catalog correction stays in scope during a mead conversation", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "catalog-correction",
          model: "test-model",
          message: { role: "assistant", content: "I will use the catalog match for the cyser draft." },
          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
        };
      }
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Draft a cyser with apple cider and honey." },
        { role: "assistant", content: "I need to resolve the cider before drafting." },
        { role: "user", content: "I think you have Apple Juice in the catalog; you can use that." }
      ]
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6
  });

  assert.equal(result.answer, "I will use the catalog match for the cyser draft.");
  assert.equal(requests.length, 1);
});

test("a catalog correction still forces lookup of a yeast named earlier in intake", async () => {
  const requests: FireworksCompletionRequest[] = [];
  await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "yeast-after-catalog-correction",
          model: "test-model",
          message: { role: "assistant", content: "I will resolve the named yeast before drafting." },
          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
        };
      }
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Draft a 1 gallon cyser with Apple Juice, Lalvin D47, and Fermaid K." },
        { role: "assistant", content: "I need to resolve the ingredient first." },
        { role: "user", content: "Apple Juice is in the catalog; use that." }
      ],
      recipeDraftInput: { targetOriginalGravity: 1.075, fermentationFinalGravity: 1.01 }
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_yeasts" }
  });
});

test("a catalog correction keeps the earlier finished-volume intake", async () => {
  const result = await runChatTurn({
    client: {
      async complete(request) {
        if (request.messages.some((message) => message.role === "tool")) {
          return {
            id: "catalog-correction-render",
            model: "test-model",
            message: { role: "assistant", content: "I retained the finished batch volume." },
            usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
          };
        }
        return {
          id: "catalog-correction-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "build-after-correction",
              type: "function",
              function: {
                name: "build_recipe_draft",
                arguments: JSON.stringify({
                  ingredients: [
                    {
                      name: "Apple Juice",
                      category: "juice",
                      brix: 11,
                      amount: { kind: "volume", value: 0.75, unit: "gal" }
                    },
                    { name: "Wildflower Honey", role: "adjustable_fermentable" }
                  ],
                  nutrients: nutrientPlan,
                  stabilizers: { enabled: false }
                })
              }
            }]
          },
          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
        };
      }
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Draft a 1 gallon cyser with apple cider, 10% ABV, and Fermaid K." },
        { role: "assistant", content: "I need to resolve the cider first." },
        { role: "user", content: "Apple Juice is in the catalog; use that." }
      ],
      recipeDraftInput: { targetOriginalGravity: 1.075, fermentationFinalGravity: 1.01 }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.deepEqual(result.recipeDraftInput?.batchVolume, { value: 1, unit: "gal" });
});

test("intake questions use the constrained conversational renderer while explanations remain deterministic", () => {
  assert.equal(
    directRecipeToolAnswer("build_recipe_draft", {
      status: "ok",
      result: {
        contractVersion: 1,
        operation: "build_recipe_draft",
        status: "needs_input",
        questions: [
          {
            id: "stabilizers",
            field: "stabilizers.enabled",
            prompt: "Should this draft include stabilizer calculations?",
            answerType: "boolean"
          }
        ]
      }
    }),
    undefined
  );

  const draft = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.996,
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });
  assert.equal(draft.status, "recipe");
  if (draft.status !== "recipe") return;

  const explanation = explainRecipe({ activeRecipeData: draft.recipeData, topic: "abv" });
  const answer = directRecipeToolAnswer("explain_recipe", {
    status: "ok",
    result: explanation
  });

  assert.match(answer ?? "", /The authoritative calculation engine derived ABV/);
  assert.match(answer ?? "", /\*\*Alcohol by volume:\*\*/);
  assert.doesNotMatch(answer ?? "", /fermented out/i);

  assert.equal(
    directRecipeToolAnswer("calculate_gravity_target", {
      status: "ok",
      result: calculateGravityTarget({ targetAbv: 16, additionalOgPoints: 10 })
    }),
    "What fermentation final gravity should MeadTools use for the target ABV calculation?"
  );
});

test("a request to build with a named ingredient forces catalog lookup first", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (!request.tools) {
        return {
          id: "recipe-intake-render",
          model: "test-model",
          message: { role: "assistant", content: "What batch size would you like to make?" },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "recipe-intake",
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "tool-1",
              type: "function",
              function: { name: "build_recipe_draft", arguments: "{}" }
            }
          ]
        },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Help me build a blackberry mead recipe." }]
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_ingredients" }
  });
  assert.match(result.answer, /batch (size|volume)/i);
  assert.match(result.answer, /batch and targets/i);
  assert.doesNotMatch(result.answer, /traditional/i);
});

test("a yeast preference forces yeast lookup and keeps catalog details out of the follow-up", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return {
          id: "yeast-search",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "tool-yeast",
              type: "function",
              function: { name: "search_yeasts", arguments: '{"query":"Premier Rouge"}' }
            }]
          },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "yeast-follow-up",
        model: "test-model",
        message: { role: "assistant", content: "What final gravity should MeadTools use?" },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Premier Rouge yeast is fine." }],
      recipeDraftInput: { ingredients: [{ name: "Blackberry", catalogId: 10, category: "fruit", brix: 7.86 }] }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    yeastLookup: async () => [{
      id: 101,
      brand: "Red Star",
      name: "Premier Rouge (Pasteur Red)",
      nitrogenRequirement: "Medium",
      tolerance: 15,
      lowTemperature: 64,
      highTemperature: 86
    }]
  });

  assert.equal(result.answer, "What final gravity should MeadTools use?");
  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_yeasts" }
  });
  assert.ok(
    requests[1]?.messages.some(
      (message) => message.role === "system" && /Do not report catalog IDs/i.test(message.content)
    )
  );
});

test("recipe drafting selects a catalog ingredient before requesting its Brix", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const calls = [
    {
      name: "build_recipe_draft",
      arguments: JSON.stringify({
        batchVolume: { value: 3, unit: "gal" },
        targetOriginalGravity: 1.1,
        fermentationFinalGravity: 1.01,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          { name: "Blackberries", amount: { kind: "weight", value: 6, unit: "lb" } }
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false }
      })
    },
    { name: "search_ingredients", arguments: "{}" },
    {
      name: "build_recipe_draft",
      arguments: JSON.stringify({
        batchVolume: { value: 3, unit: "gal" },
        targetOriginalGravity: 1.1,
        fermentationFinalGravity: 1.01,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          {
            name: "Blackberries",
            catalogId: 42,
            category: "fruit",
            brix: 10,
            amount: { kind: "weight", value: 6, unit: "lb" }
          }
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false }
      })
    }
  ];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      const call = calls.shift();
      if (!call) {
        return {
          id: "final",
          model: "test-model",
          message: { role: "assistant", content: "Your unsaved blackberry draft is ready." },
          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
        };
      }
      return {
        id: `request-${requests.length}`,
        model: "test-model",
        message: {
          role: "assistant",
          content: call ? null : "What fruit amount and yeast would you prefer?",
          tool_calls: [{ id: `tool-${requests.length}`, type: "function", function: call }]
        },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Build a 3 gallon blackberry mead recipe." }]
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    ingredientLookup: async () => [
      { id: 42, name: "Blackberries", category: "fruit", brix: 10 },
      { id: 43, name: "Blueberries", category: "fruit", brix: 12 }
    ]
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /Blackberries/);
  assert.deepEqual(result.toolResults.map((tool) => tool.toolName), [
    "build_recipe_draft",
    "search_ingredients",
    "build_recipe_draft"
  ]);
  assert.deepEqual(requests[2]?.toolChoice, {
    type: "function",
    function: { name: "build_recipe_draft" }
  });
});

test("a gravity calculation continues into recipe drafting during recipe design", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const calls = [
    {
      name: "calculate_gravity_target",
      arguments: '{"targetAbv":16,"fermentationFinalGravity":1.03}'
    },
    { name: "build_recipe_draft", arguments: "{}" }
  ];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      const call = calls.shift();
      if (!call) {
        return {
          id: `request-${requests.length}`,
          model: "test-model",
          message: { role: "assistant", content: "What fruit amount and yeast would you prefer?" },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: `request-${requests.length}`,
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{ id: `tool-${requests.length}`, type: "function", function: call }]
        },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Let's design a blackberry mead recipe." },
        { role: "assistant", content: "What target should we use?" },
        { role: "user", content: "1 gallon, 16% ABV, and 1.030." }
      ]
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.deepEqual(result.toolResults.map((tool) => tool.toolName), [
    "calculate_gravity_target",
    "build_recipe_draft"
  ]);
  assert.ok(
    requests[1]?.messages.some(
      (message) =>
        message.role === "system" && /not the final answer/i.test(message.content)
    )
  );
  assert.match(result.answer, /fruit amount and yeast/i);
});

test("partial recipe intake persists across turns instead of repeating answered questions", async () => {
  let firstCalls = 0;
  const firstClient: ChatModelClient = {
    async complete(request) {
      firstCalls += 1;
      if (!request.tools) {
        return {
          id: "first-render",
          model: "test-model",
          message: { role: "assistant", content: "What fermentation final gravity should we plan for?" },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "first",
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "tool-first",
              type: "function",
              function: {
                name: "build_recipe_draft",
                arguments: JSON.stringify({
                  batchVolume: { value: 5, unit: "gal" },
                  targetOriginalGravity: 1.1,
                  ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
                  nutrients: nutrientPlan,
                  stabilizers: { enabled: false }
                })
              }
            }
          ]
        },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };
  const first = await runChatTurn({
    client: firstClient,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Create a five gallon mead recipe." }]
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });
  assert.match(first.answer, /fermentation final gravity/i);
  assert.equal(first.recipeDraftInput?.batchVolume?.value, 5);

  let calls = 0;
  const secondClient: ChatModelClient = {
    async complete() {
      calls += 1;
      if (calls === 1) {
        return {
          id: "second-tool",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "tool-second",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: '{"fermentationFinalGravity":0.996}'
                }
              }
            ]
          },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "second-final",
        model: "test-model",
        message: { role: "assistant", content: "Your unsaved draft is ready." },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };
  const second = await runChatTurn({
    client: secondClient,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a five gallon mead recipe." },
        { role: "assistant", content: first.answer },
        { role: "user", content: "Use 0.996 as the fermentation final gravity." }
      ],
      recipeDraftInput: first.recipeDraftInput
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });
  assert.match(second.answer, /^## Unsaved MeadTools recipe draft/);
  assert.equal(second.recipeDraftInput?.batchVolume?.value, 5);
  assert.equal(second.recipeDraftInput?.fermentationFinalGravity, 0.996);
});

test("explicit recipe choices survive a provider omission and stay stage-specific", async () => {
  const client: ChatModelClient = {
    async complete(request) {
      if (!request.tools) {
        return {
          id: "intake-hints-render",
          model: "test-model",
          message: { role: "assistant", content: "What yeast would you like to use?" },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "intake-hints",
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "tool-hints",
              type: "function",
              function: { name: "build_recipe_draft", arguments: "{}" }
            }
          ]
        },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a blackberry mead recipe." },
        { role: "assistant", content: "What finished batch volume should this recipe target?" },
        {
          role: "user",
          content:
            "I want to end dry and backsweeten, with fruit in both primary and secondary, around 5 gallons. Use Fermaid K only with Go-Ferm."
        }
      ],
      recipeDraftInput: {
        ingredients: [
          { name: "Blackberry", catalogId: 10, category: "fruit", brix: 7.86 }
        ]
      }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.equal(result.recipeDraftInput?.batchVolume?.value, 5);
  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  assert.equal(result.recipeDraftInput?.nutrients?.schedule, "justK");
  assert.equal(result.recipeDraftInput?.nutrients?.goFermType, "Go-Ferm");
  assert.equal(result.recipeDraftInput?.stabilizers?.enabled, true);
  assert.deepEqual(
    result.recipeDraftInput?.ingredients
      .filter((ingredient) => ingredient.name === "Blackberry")
      .map((ingredient) => ingredient.secondary === true),
    [false, true]
  );
  assert.match(result.answer, /yeast, nutrients, and stabilization/i);
  assert.match(result.answer, /yeast brand and strain/i);
  assert.doesNotMatch(result.answer, /catalog id|justK/i);
});

test("an approximate ABV, exact yeast, qualitative blueberry preference, and no pH reading all advance intake", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const calls = [
    {
      name: "calculate_gravity_target",
      arguments: '{"targetAbv":16,"fermentationFinalGravity":1.03}'
    },
    { name: "search_yeasts", arguments: '{"query":"71B"}' },
    { name: "build_recipe_draft", arguments: "{}" }
  ];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      const call = calls.shift();
      if (!call) {
        return {
          id: "complete-draft",
          model: "test-model",
          message: { role: "assistant", content: "Your unsaved blackberry draft is ready." },
          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
        };
      }
      return {
        id: `request-${requests.length}`,
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{ id: `tool-${requests.length}`, type: "function", function: call }]
        },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a blueberry mead recipe." },
        { role: "assistant", content: "What should we use for the remaining recipe choices?" },
        {
          role: "user",
          content: "About 16%, use heavy blueberry with 71B, and I will not take a pH reading."
        }
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey" },
          {
            name: "Blueberry",
            catalogId: 11,
            category: "fruit",
            brix: 7.86
          },
          {
            name: "Blueberry",
            catalogId: 11,
            category: "fruit",
            brix: 7.86,
            secondary: true
          }
        ],
        nutrients: {
          enabled: true,
          schedule: "justK",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm"
        },
        stabilizers: { enabled: true, type: "kmeta" },
      }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    yeastLookup: async () => [{
      id: 71,
      brand: "Lalvin",
      name: "71B",
      nitrogenRequirement: "Low",
      tolerance: 14,
      lowTemperature: 59,
      highTemperature: 86
    }]
  });

  assert.deepEqual(result.toolResults.map((tool) => tool.toolName), [
    "calculate_gravity_target",
    "search_yeasts",
    "build_recipe_draft"
  ]);
  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  assert.equal(result.recipeDraftInput?.nutrients?.yeastStrain, "71B");
  assert.equal(result.recipeDraftInput?.nutrients?.nitrogenRequirement, "Low");
  assert.equal(result.recipeDraftInput?.stabilizers?.phReading, 3.5);
  assert.deepEqual(
    result.recipeDraftInput?.ingredients
      .filter((ingredient) => ingredient.name === "Blueberry")
      .map((ingredient) => ingredient.amount),
    [undefined, undefined]
  );
  assert.equal(
    result.recipeDraftInput?.assumptions?.some((assumption) => /heavy.*(?:blackberry|blueberry)/i.test(assumption)) ?? false,
    false
  );
  assert.ok(
    result.recipeDraftInput?.assumptions.includes(
      "The stabilizer calculation uses an assumed pH of 3.5 because no pH reading will be taken."
    )
  );
  assert.deepEqual(requests[1]?.toolChoice, {
    type: "function",
    function: { name: "search_yeasts" }
  });
  assert.equal(result.answer, "Your unsaved blackberry draft is ready.");
});

test("a named fruit is looked up before yeast selection and draft construction", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const calls = [
    { name: "calculate_gravity_target", arguments: '{"targetAbv":16,"fermentationFinalGravity":0.999}' },
    { name: "search_ingredients", arguments: '{"query":"blackberry"}' },
    { name: "search_yeasts", arguments: '{"query":"71B"}' }
  ];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      const call = calls.shift();
      if (!call) {
        return {
          id: "complete",
          model: "test-model",
          message: { role: "assistant", content: "I have the details needed to begin the draft." },
          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
        };
      }
      return {
        id: `request-${requests.length}`,
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{ id: `tool-${requests.length}`, type: "function", function: call }]
        },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{
        role: "user",
        content: "Create a 5 gallon heavy blackberry mead at 16% ABV with Lalvin 71B."
      }]
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    ingredientLookup: async () => [{ id: 10, name: "Blackberry", category: "fruit", brix: 7.86 }],
    yeastLookup: async () => [{
      id: 71,
      brand: "Lalvin",
      name: "71B",
      nitrogenRequirement: "Low",
      tolerance: 14,
      lowTemperature: 59,
      highTemperature: 86
    }]
  });

  assert.deepEqual(result.toolResults.map((tool) => tool.toolName), [
    "calculate_gravity_target",
    "search_ingredients",
    "search_yeasts"
  ]);
  assert.deepEqual(requests.slice(1).map((request) => request.toolChoice), [
    { type: "function", function: { name: "search_ingredients" } },
    { type: "function", function: { name: "search_yeasts" } },
    { type: "function", function: { name: "build_recipe_draft" } }
  ]);
});

test("a qualitative fruit preference does not produce a model-invented fruit amount", async () => {
  const client: ChatModelClient = {
    async complete(request) {
      if (request.messages.some((message) => message.role === "tool")) {
        return {
          id: "complete-draft",
          model: "test-model",
          message: { role: "assistant", content: "Your unsaved blackberry draft is ready." },
          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
        };
      }
      return {
        id: "draft",
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "build",
            type: "function",
            function: {
              name: "build_recipe_draft",
              arguments: JSON.stringify({
                ingredients: [
                  { name: "Blackberry", amount: { kind: "weight", value: 25, unit: "lb" } },
                  { name: "Blackberry", secondary: true, amount: { kind: "weight", value: 25, unit: "lb" } }
                ]
              })
            }
          }]
        },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Create a 5 gallon blackberry mead at 16% ABV with heavy fruit split evenly."
        },
        { role: "assistant", content: "I have the recipe details so far." },
        { role: "user", content: "Please create the draft using those details." }
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.126,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey" },
          { name: "Blackberry", catalogId: 10, category: "fruit", brix: 7.86 },
          { name: "Blackberry", catalogId: 10, category: "fruit", brix: 7.86, secondary: true }
        ],
        nutrients: {
          enabled: true,
          yeastId: 71,
          yeastBrand: "Lalvin",
          yeastStrain: "71B",
          nitrogenRequirement: "Low",
          schedule: "justK",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm"
        },
        stabilizers: { enabled: false }
      }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.equal(result.toolResults[0]?.toolName, "build_recipe_draft");
  assert.deepEqual(
    result.recipeDraftInput?.ingredients
      .filter((ingredient) => ingredient.name === "Blackberry")
      .map((ingredient) => ingredient.amount?.value),
    [undefined, undefined]
  );
  assert.equal(result.answer, "Your unsaved blackberry draft is ready.");
});

test("a whole vanilla bean is retained as an additive instead of being asked again", async () => {
  const client: ChatModelClient = {
    async complete(request) {
      if (!request.messages.some((message) => message.role === "tool")) {
        return {
          id: "vanilla-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "vanilla-build",
              type: "function",
              function: {
                name: "build_recipe_draft",
                arguments: JSON.stringify({ ingredients: [{ name: "Vanilla bean", secondary: true }] })
              }
            }]
          },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "vanilla-complete",
        model: "test-model",
        message: { role: "assistant", content: "Your vanilla draft is ready." },
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Use one whole vanilla bean in secondary." }],
      recipeDraftInput: {
        batchVolume: { value: 3, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey" }],
        nutrients: { enabled: true, yeastBrand: "Lalvin", yeastStrain: "EC-1118", nitrogenRequirement: "Low", schedule: "justK", numberOfAdditions: 3, goFermType: "Go-Ferm" },
        stabilizers: { enabled: false }
      }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.deepEqual(
    result.recipeDraftInput?.additives.find((additive) => additive.name === "Vanilla bean"),
    { name: "Vanilla bean", amount: 1, unit: "units", secondary: true }
  );
});

test("countable additive units are normalized and duplicate model lines collapse", async () => {
  const client: ChatModelClient = {
    async complete() {
      return {
        id: "duplicate-additive-draft",
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "duplicate-additive-build",
            type: "function",
            function: {
              name: "build_recipe_draft",
              arguments: JSON.stringify({
                additives: [
                  { name: "Vanilla", amount: 1, unit: "units", secondary: true },
                  { name: "Vanilla Bean", amount: 1, unit: "bean" }
                ]
              })
            }
          }]
        },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Use one vanilla bean in secondary." }],
      recipeDraftInput: {
        batchVolume: { value: 3, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey" }],
        nutrients: { enabled: true, yeastBrand: "Lalvin", yeastStrain: "EC-1118", nitrogenRequirement: "Low", schedule: "justK", numberOfAdditions: 3, goFermType: "Go-Ferm" },
        stabilizers: { enabled: false }
      }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Vanilla Bean", amount: 1, unit: "units", secondary: true }
  ]);
});

test("a complete named catalog additive is still checked against the additive catalog", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const toolCompletion = (name: string, argumentsObject: Record<string, unknown>) => ({
    id: `complete-additive-${name}-${requests.length}`,
    model: "test-model",
    message: {
      role: "assistant" as const,
      content: null,
      tool_calls: [{
        id: `complete-additive-call-${requests.length}`,
        type: "function" as const,
        function: { name, arguments: JSON.stringify(argumentsObject) }
      }]
    },
    usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
  });
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        assert.deepEqual(request.toolChoice, { type: "function", function: { name: "search_additives" } });
        return toolCompletion("search_additives", {});
      }
      assert.deepEqual(request.toolChoice, { type: "function", function: { name: "build_recipe_draft" } });
      return toolCompletion("build_recipe_draft", {
        additives: [{ name: "Bentonite", amount: 1, unit: "g" }]
      });
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Create a traditional mead and include Bentonite." }],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.1,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false }
      }
    }),
    maxOutputTokens: 500,
    maxToolCalls: 5,
    additiveLookup: async () => [
      { id: "bentonite", name: "Bentonite", dosagePerGallon: 6, unit: "g" }
    ]
  });

  assert.deepEqual(result.toolResults.map((tool) => tool.toolName), [
    "search_additives",
    "build_recipe_draft"
  ]);
  assert.deepEqual(result.recipeDraftInput?.additives, [{ name: "Bentonite", amount: 6, unit: "g" }]);
});

test("a catalog additive without a supplied unit is resolved before drafting", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const toolCompletion = (name: string, argumentsObject: Record<string, unknown>) => ({
    id: `additive-${name}`,
    model: "test-model",
    message: {
      role: "assistant" as const,
      content: null,
      tool_calls: [{
        id: `call-${name}-${requests.length}`,
        type: "function" as const,
        function: { name, arguments: JSON.stringify(argumentsObject) }
      }]
    },
    usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
  });
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        assert.deepEqual(request.toolChoice, { type: "function", function: { name: "search_additives" } });
        return toolCompletion("search_additives", {});
      }
      assert.deepEqual(request.toolChoice, { type: "function", function: { name: "build_recipe_draft" } });
      return toolCompletion("build_recipe_draft", {
        additives: [{ name: "Bentonite" }]
      });
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Create a traditional mead and include Bentonite." }],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.1,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false }
      }
    }),
    maxOutputTokens: 500,
    maxToolCalls: 5,
    additiveLookup: async () => [
      { id: "bentonite", name: "Bentonite", dosagePerGallon: 6, unit: "g" }
    ]
  });

  assert.deepEqual(result.toolResults.map((tool) => tool.toolName), [
    "search_additives",
    "build_recipe_draft"
  ]);
  assert.equal(result.recipeDraftInput?.additives[0]?.unit, "g");
  assert.equal(result.recipeDraftInput?.additives[0]?.amount, 6);
  assert.match(result.answer, /\| Bentonite \| 6 g \|/);
});

test("a fixed-fermentable cyser request reaches the generic recipe agent", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "generic-cyser-intake",
          model: "test-model",
          message: {
            role: "assistant",
            content: "I will use MeadTools to evaluate those fixed fermentables before drafting."
          },
          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
        };
      }
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{
        role: "user",
        content: "Draft a 1 gallon cyser with 1 gallon of fresh apple cider and 3 lb of wildflower honey. I want it around 10% ABV, finishing at 1.010. Use Lalvin D47, Fermaid K and Go-Ferm with two additions. I do not plan to backsweeten or stabilize."
      }]
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.equal(result.answer, "I will use MeadTools to evaluate those fixed fermentables before drafting.");
  assert.equal(result.usage.model, "test-model");
  assert.equal(requests.length, 1);
});

test("a no-sulfite correction and fixed ingredient volumes survive a recipe tool call", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "cyser-correction",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "cyser-build",
              type: "function",
              function: {
                name: "build_recipe_draft",
                arguments: JSON.stringify({
                  ingredients: [
                    {
                      name: "Apple Juice",
                      catalogId: 12,
                      category: "juice",
                      brix: 11,
                      amount: { kind: "volume", value: 0.75, unit: "gal" }
                    },
                    { name: "Wildflower Honey", role: "adjustable_fermentable" }
                  ],
                  stabilizers: { enabled: true, type: "kmeta" }
                })
              }
            }]
          },
          usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
        };
      }
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Draft a 1 gallon cyser with 1 gallon of apple juice and 3 lb of wildflower honey at 10% ABV." },
        { role: "assistant", content: "The fixed ingredients need adjustment to meet that target." },
        { role: "user", content: "I do not plan on using sulfite at all and I am not measuring pH. We can reduce the honey to meet the targets." }
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.075,
        fermentationFinalGravity: 1.01,
        ingredients: [
          {
            name: "Apple Juice",
            catalogId: 12,
            category: "juice",
            brix: 11,
            amount: { kind: "volume", value: 1, unit: "gal" }
          },
          { name: "Wildflower Honey", amount: { kind: "weight", value: 3, unit: "lb" } }
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: true, type: "kmeta" }
      }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.equal(result.recipeDraftInput?.stabilizers?.enabled, false);
  assert.deepEqual(
    result.recipeDraftInput?.ingredients.find((ingredient) => ingredient.name === "Apple Juice")?.amount,
    { kind: "volume", value: 1, unit: "gal" }
  );
  const honey = result.recipeDraftInput?.ingredients.find((ingredient) => ingredient.name === "Wildflower Honey");
  assert.equal(honey?.role, "adjustable_fermentable");
  assert.equal(honey?.amount, undefined);
  assert.match(result.answer, /fixed primary ingredient.*Apple Juice/i);
  assert.match(result.answer, /larger batch/i);
});

test("a medium-sweet request requires an explicit sweetness strategy before drafting", async () => {
  const result = await runChatTurn({
    client: { complete: async () => { throw new Error("provider should not be called"); } },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{
        role: "user",
        content: "I want a 2 gallon traditional mead that finishes medium-sweet. Pick a sensible yeast and nutrient plan for me."
      }]
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.match(result.answer, /sweetness strategy/i);
  assert.match(result.answer, /stabilize, and then backsweeten/i);
  assert.match(result.answer, /target ABV/i);
  assert.equal(result.usage.model, "deterministic-intake-check");
});

test("invalid model tool arguments cannot discard established recipe intake", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return {
          id: "invalid-build-call",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "invalid-build-tool",
              type: "function",
              function: {
                name: "build_recipe_draft",
                arguments: '{"nutrients":{"enabled":true,"schedule":"not-a-real-schedule"}}'
              }
            }]
          },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "completed-draft",
        model: "test-model",
        message: { role: "assistant", content: "Your unsaved blackberry draft is ready." },
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a blackberry mead recipe." },
        { role: "assistant", content: "What are the remaining choices?" },
        {
          role: "user",
          content: "Use heavy blackberry, around 5 gallons, target 16%, Lalvin 71B, and no pH reading."
        }
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.119,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey" },
          { name: "Blackberry", catalogId: 10, category: "fruit", brix: 7.86 },
          { name: "Blackberry", catalogId: 10, category: "fruit", brix: 7.86, secondary: true }
        ],
        nutrients: {
          enabled: true,
          yeastId: 71,
          yeastBrand: "Lalvin",
          yeastStrain: "71B",
          nitrogenRequirement: "Low",
          schedule: "justK",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm"
        },
        stabilizers: { enabled: true, type: "kmeta" }
      }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.equal(result.recipeDraftInput?.targetOriginalGravity, 1.119);
  assert.equal(result.recipeDraftInput?.stabilizers?.phReading, 3.5);
  assert.deepEqual(
    result.recipeDraftInput?.ingredients
      .filter((ingredient) => ingredient.name === "Blackberry")
      .map((ingredient) => ingredient.amount?.value),
    [undefined, undefined]
  );
  assert.equal(result.toolResults[0]?.toolName, "build_recipe_draft");
  assert.equal(result.answer, "Your unsaved blackberry draft is ready.");
});

test("a model cannot invent a fixed honey amount when the user chose an OG target", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return {
          id: "invented-honey-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "invented-honey-tool",
              type: "function",
              function: {
                name: "build_recipe_draft",
                arguments: JSON.stringify({
                  ingredients: [
                    { name: "Honey", amount: { kind: "weight", value: 12, unit: "lb" } },
                    {
                      name: "Blackberry",
                      catalogId: 10,
                      category: "fruit",
                      brix: 7.86,
                      amount: { kind: "weight", value: 5, unit: "lb" }
                    }
                  ]
                })
              }
            }]
          },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "invented-honey-final",
        model: "test-model",
        message: { role: "assistant", content: "Your unsaved blackberry draft is ready." },
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a 5 gallon blackberry mead recipe at 16% ABV." }
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.118,
        fermentationFinalGravity: 0.999,
        ingredients: [],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false }
      }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  const honey = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Honey"
  );
  assert.equal(honey?.amount, undefined);
  assert.equal(honey?.role, "adjustable_fermentable");
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
});

test("a traditional backsweetening intake keeps dry fermentation gravity and implied honey", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return {
          id: "traditional-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "traditional-build",
              type: "function",
              function: {
                name: "build_recipe_draft",
                // Simulates the bad completion from the evaluator: it treats
                // the post-backsweetening FG as the fermentation FG and drops
                // the implied primary honey.
                arguments: JSON.stringify({
                  fermentationFinalGravity: 1.015,
                  ingredients: []
                })
              }
            }]
          },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "traditional-render",
        model: "test-model",
        message: { role: "assistant", content: "Your unsaved traditional mead draft is ready." },
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Create a 1 gallon sweet traditional mead at about 14% ABV with TOSNA and Lalvin 71B."
        },
        {
          role: "assistant",
          content: "I can make that as a dry-fermented, stabilized, backsweetened draft."
        },
        {
          role: "user",
          content: "Yes, stabilize and backsweeten to 1.015. Use three nutrient additions, standard Go-Ferm, and the default pH."
        }
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.12,
        ingredients: [],
        nutrients: {
          enabled: true,
          yeastBrand: "Lalvin",
          yeastStrain: "71B",
          nitrogenRequirement: "Low",
          schedule: "tosna",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm"
        },
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 }
      }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.deepEqual(result.toolResults.map((tool) => tool.toolName), ["build_recipe_draft"]);
  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  assert.deepEqual(
    result.recipeDraftInput?.ingredients.find((ingredient) => ingredient.name === "Honey"),
    { name: "Honey", role: "adjustable_fermentable" }
  );
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /Honey \(backsweetening\)/);
  assert.equal(requests.length, 1);
});

test("a gravity-targeted fruit mead restores honey when a model omits its base fermentable", async () => {
  const client: ChatModelClient = {
    async complete(request) {
      if (request.toolChoice !== "none") {
        return {
          id: "missing-honey-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "missing-honey-tool",
              type: "function",
              function: {
                name: "build_recipe_draft",
                arguments: JSON.stringify({
                  ingredients: [{
                    name: "Blackberry",
                    catalogId: 10,
                    category: "fruit",
                    brix: 7.86,
                    amount: { kind: "weight", value: 5, unit: "lb" }
                  }]
                })
              }
            }]
          },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "missing-honey-final",
        model: "test-model",
        message: { role: "assistant", content: "Your unsaved blackberry draft is ready." },
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Create a 5 gallon blackberry mead at 16% ABV." }],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.118,
        fermentationFinalGravity: 0.999,
        ingredients: [],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false }
      }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1
  });

  assert.deepEqual(
    result.recipeDraftInput?.ingredients.find((ingredient) => ingredient.name === "Honey"),
    { name: "Honey", role: "adjustable_fermentable" }
  );
});

test("an explicit fruit-wine request does not receive implied honey", async () => {
  const client: ChatModelClient = {
    async complete(request) {
      if (request.tools) {
        return {
          id: "fruit-wine-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "fruit-wine-tool",
              type: "function",
              function: {
                name: "build_recipe_draft",
                arguments: JSON.stringify({
                  ingredients: [{
                    name: "Blackberry",
                    catalogId: 10,
                    category: "fruit",
                    brix: 7.86,
                    amount: { kind: "weight", value: 5, unit: "lb" }
                  }]
                })
              }
            }]
          },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "fruit-wine-question",
        model: "test-model",
        message: { role: "assistant", content: "What batch size would you like?" },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Create a blackberry fruit wine recipe." }]
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1
  });

  assert.equal(
    result.recipeDraftInput?.ingredients.some(
      (ingredient) => ingredient.name.trim().toLowerCase() === "honey"
    ),
    false
  );
});

test("a mead request receives implied honey before a gravity target is known", async () => {
  const client: ChatModelClient = {
    async complete(request) {
      if (request.tools) {
        return {
          id: "mead-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "mead-tool",
              type: "function",
              function: { name: "build_recipe_draft", arguments: "{}" }
            }]
          },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "mead-question",
        model: "test-model",
        message: { role: "assistant", content: "What gravity target should we use?" },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Create a blackberry mead recipe." }],
      recipeDraftInput: {
        ingredients: [{ name: "Blackberry", catalogId: 10, category: "fruit", brix: 7.86 }]
      }
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1
  });

  assert.deepEqual(
    result.recipeDraftInput?.ingredients.find(
      (ingredient) => ingredient.name.trim().toLowerCase() === "honey"
    ),
    { name: "Honey" }
  );
});

test("broad recipe intake avoids a repeated model-rendering turn", async () => {
  const intake = buildRecipeDraft({});
  assert.equal(intake.status, "needs_input");
  if (intake.status !== "needs_input") return;
  const previousAnswer = "What batch size would you like to make?";

  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return {
          id: "repeat-tool",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "repeat-call",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" }
              }
            ]
          },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "repeat-final",
        model: "test-model",
        message: { role: "assistant", content: "I need only the remaining gravity target." },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a blackberry mead recipe." },
        { role: "assistant", content: previousAnswer },
        { role: "user", content: "Keep the other settings unchanged." }
      ]
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.match(result.answer, /batch and targets/i);
  assert.match(result.answer, /yeast, nutrients, and stabilization/i);
  assert.equal(requests.length, 1);
});

test("a truncated model completion is never returned as the chat answer", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return {
          id: "truncated",
          model: "test-model",
          message: { role: "assistant", content: "Internal scratchwork" },
          usage: { inputTokens: 10, outputTokens: 500, totalTokens: 510, cachedInputTokens: 0 },
          finishReason: "length"
        };
      }
      return {
        id: "recovered",
        model: "test-model",
        message: { role: "assistant", content: "What final gravity should MeadTools use?" },
        usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30, cachedInputTokens: 0 },
        finishReason: "stop"
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Help me with a mead recipe." }]
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6
  });

  assert.equal(result.answer, "What final gravity should MeadTools use?");
  assert.equal(requests.length, 2);
  assert.equal(requests[1]?.messages.at(-1)?.role, "system");
});

test("an explicit ABV target forces the MeadTools gravity target tool", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      return {
        id: "gravity-target",
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "tool-1",
              type: "function",
              function: {
                name: "calculate_gravity_target",
                arguments: '{"targetAbv":16,"additionalOgPoints":10}'
              }
            }
          ]
        },
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15, cachedInputTokens: 0 },
        finishReason: "tool_calls"
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Let us target 16% and add an additional 10 points to the OG."
        }
      ]
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "calculate_gravity_target" }
  });
  assert.equal(
    result.answer,
    "What fermentation final gravity should MeadTools use for the target ABV calculation?"
  );
});

test("a rounded model echo cannot replace the authoritative gravity target", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return {
          id: "precise-gravity-target",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "precise-gravity-tool",
              type: "function",
              function: {
                name: "calculate_gravity_target",
                arguments: '{"targetAbv":14,"fermentationFinalGravity":0.999}'
              }
            }]
          },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "rounded-gravity-echo",
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [{
            id: "rounded-gravity-tool",
            type: "function",
            function: {
              name: "build_recipe_draft",
              // Models frequently repeat the displayed three-decimal OG here.
              arguments: '{"targetOriginalGravity":1.104}'
            }
          }]
        },
        usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Create this sweet traditional mead at 14% ABV." }],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        fermentationFinalGravity: 0.999,
        backsweetening: { targetFinalGravity: 1.015 },
        ingredients: [{ name: "Wildflower Honey", role: "adjustable_fermentable" }],
        nutrients: { ...nutrientPlan, numberOfAdditions: 3 }
      }
    }),
    maxOutputTokens: 500,
    maxToolCalls: 4
  });

  assert.deepEqual(requests.map((request) => request.toolChoice), [
    { type: "function", function: { name: "calculate_gravity_target" } },
    { type: "function", function: { name: "build_recipe_draft" } }
  ]);
  assert.ok(result.recipeDraftInput);
  assert.ok(Math.abs((result.recipeDraftInput?.targetOriginalGravity ?? 0) - 1.1044328386135414) < 1e-12);
  const workflow = result.toolResults[1]?.result as { result?: { status?: string; derived?: { alcohol?: { abv?: number } } } };
  assert.equal(workflow.result?.status, "recipe");
  assert.ok(Math.abs((workflow.result?.derived?.alcohol?.abv ?? 0) - 14) < 0.01);
});

test("a dry-finish preference is passed into an initial gravity calculation", async () => {
  const client: ChatModelClient = {
    async complete(request) {
      if (request.toolChoice !== "none") {
        return {
          id: "dry-gravity-target",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{
              id: "dry-gravity-tool",
              type: "function",
              function: {
                name: "calculate_gravity_target",
                arguments: '{"targetAbv":16}'
              }
            }]
          },
          usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
        };
      }
      return {
        id: "dry-gravity-final",
        model: "test-model",
        message: { role: "assistant", content: "Continuing the recipe draft." },
        usage: { inputTokens: 10, outputTokens: 4, totalTokens: 14, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Create a 16% blackberry mead and finish dry." }]
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1
  });

  const execution = result.toolResults[0]?.result as {
    result?: { status?: string; fermentationFinalGravity?: number };
  };
  assert.equal(execution.result?.status, "calculation");
  assert.equal(execution.result?.fermentationFinalGravity, 0.999);
});

test("completed recipe prose never exposes internal recipe labels", async () => {
  const client: ChatModelClient = {
    async complete() {
      return {
        id: "internal-labels",
        model: "test-model",
        message: {
          role: "assistant",
          content:
            "Blackberry (catalog), Honey (adjustable), Fermaid K (justK), and potassium metabisulfite (kmeta)."
        },
        usage: { inputTokens: 10, outputTokens: 8, totalTokens: 18, cachedInputTokens: 0 }
      };
    }
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Show my mead draft." }]
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6
  });

  assert.equal(
    result.answer,
    "Blackberry, Honey, Fermaid K, and potassium metabisulfite."
  );
});
