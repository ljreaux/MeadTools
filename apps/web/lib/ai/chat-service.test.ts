import assert from "node:assert/strict";
import test from "node:test";
import { buildRecipeDraft } from "@meadtools/recipe-workflows";
import type { ChatModelClient, FireworksCompletionRequest } from "./fireworks";
import {
  calculatorLinkForProcessMessage,
  chatRequestSchema,
  directRecipeToolAnswer,
  removeUnsupportedSulfurInterventions,
  runChatTurn,
  runDeterministicChatTurn,
} from "./chat-service";
import type { WikiFetcher } from "@meadtools/wiki-knowledge";

const wikiFetcher: WikiFetcher = async (url) => ({
  ok: true,
  status: 200,
  url,
  headers: { get: (name) => (name === "content-type" ? "text/html" : null) },
  text: async () => "<main>Reviewed Modern Meadmaking Wiki guidance.</main>",
});

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

test("process calculator routing prefers dedicated MeadTools calculators", () => {
  assert.deepEqual(
    calculatorLinkForProcessMessage(
      "How much potassium metabisulfite and sorbate do I need?",
    ),
    { label: "Stabilizer calculator", href: "/stabilizers" },
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage("How much priming sugar do I need?"),
    { label: "Priming sugar calculator", href: "/extra-calcs/priming-sugar" },
  );
  assert.equal(
    calculatorLinkForProcessMessage("What is causing a sulfur aroma?"),
    undefined,
  );
});

test("exact calculator requests link to MeadTools without invoking the model", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error(
          "The model should not be called for calculator routing.",
        );
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Can you calculate the exact sulfite amount?",
        },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(result.usage.model, "deterministic-calculator-routing");
  assert.match(
    result.answer,
    /\[Sulfite calculator\]\(\/extra-calcs\/sulfite\)/,
  );
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

test("a process answer follows the required wiki search-to-fetch path", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return completion({
          id: "wiki-search",
          toolCalls: [
            {
              id: "search",
              name: "search_wiki",
              arguments: { query: "stabilizing mead before backsweetening" },
            },
          ],
        });
      }
      if (requests.length === 2) {
        return completion({
          id: "wiki-fetch",
          toolCalls: [
            {
              id: "fetch",
              name: "fetch_wiki_page",
              arguments: {
                url: "https://wiki.meadtools.com/en/faq/stabilization_and_backsweetening",
              },
            },
          ],
        });
      }
      return completion({
        id: "wiki-answer",
        content:
          "## Stabilizing before backsweetening\n\n1. Confirm fermentation is complete.\n\n### Sources\n- [Modern Meadmaking Wiki](https://wiki.meadtools.com/en/faq/stabilization_and_backsweetening)",
      });
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "How do I stabilize mead before backsweetening?",
        },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
    wikiFetcher,
  });

  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["search_wiki", "fetch_wiki_page"],
  );
  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_wiki" },
  });
  assert.deepEqual(requests[1]?.toolChoice, {
    type: "function",
    function: { name: "fetch_wiki_page" },
  });
  assert.match(result.answer, /Modern Meadmaking Wiki/);
  assert.match(result.answer, /stabilization_and_backsweetening/);
});

test("final-gravity explanations require a fetched wiki source", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return completion({
          id: "wiki-search",
          toolCalls: [
            {
              id: "search",
              name: "search_wiki",
              arguments: { query: "final gravity" },
            },
          ],
        });
      }
      if (requests.length === 2) {
        return completion({
          id: "wiki-fetch",
          toolCalls: [
            {
              id: "fetch",
              name: "fetch_wiki_page",
              arguments: {
                url: "https://wiki.meadtools.com/en/basics/hydrometers",
              },
            },
          ],
        });
      }
      return completion({
        id: "wiki-answer",
        content:
          "## Final gravity\n\nFinal gravity describes the mead's specific gravity after fermentation.\n\n### Sources\n- [Modern Meadmaking Wiki](https://wiki.meadtools.com/en/basics/hydrometers)",
      });
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "What does final gravity mean for mead?" },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
    wikiFetcher,
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_wiki" },
  });
  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["search_wiki", "fetch_wiki_page"],
  );
});

test("sulfur guidance does not recommend generic nutrient additions as a fix", () => {
  const answer = removeUnsupportedSulfurInterventions(
    "The sulfur smell can mean the yeast are starved of nitrogen; this often clears when the must gets enough nitrogen, but do not add random fixes yet.",
    chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Why does my mead smell like sulfur, and what should I do?",
        },
      ],
    }),
    "https://wiki.meadtools.com/en/troubleshooting/basic-problems",
  );

  assert.doesNotMatch(answer, /gets enough nitrogen|often clears/i);
  assert.match(answer, /yeast, original gravity, current gravity/i);
  assert.match(answer, /basic-problems/);
});

test("an explicit calculated draft requires a provider-chosen MeadTools tool before it can answer", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      return completion({
        id: "draft",
        toolCalls: [
          {
            id: "draft-tool",
            name: "build_recipe_draft",
            arguments: {
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
          },
        ],
      });
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Make a one gallon dry traditional mead with 71B.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.toolChoice, "required");
  assert.equal(requests[0]?.reasoningEffort, "low");
  assert.ok(
    requests[0]?.tools?.some(
      (tool) => tool.function.name === "search_ingredients",
    ),
  );
  assert.ok(
    requests[0]?.tools?.some(
      (tool) => tool.function.name === "search_additives",
    ),
  );
  assert.ok(
    requests[0]?.tools?.some((tool) => tool.function.name === "search_yeasts"),
  );
  const buildRecipeTool = requests[0]?.tools?.find(
    (tool) => tool.function.name === "build_recipe_draft",
  );
  assert.ok(buildRecipeTool);
  assert.match(
    buildRecipeTool.function.description,
    /nonfermentable flavor or process addition belongs in additives/i,
  );
  assert.match(
    buildRecipeTool.function.description,
    /do not complete the draft/i,
  );
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
});

test("an explicit Fermaid K-only request overrides a generic nutrient schedule in a draft tool call", async () => {
  const client: ChatModelClient = {
    async complete() {
      return completion({
        id: "fermaid-k-only",
        toolCalls: [
          {
            id: "draft-tool",
            name: "build_recipe_draft",
            arguments: {
              batchVolume: { value: 1, unit: "gal" },
              targetAbv: 12,
              fermentationFinalGravity: 0.999,
              ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
              nutrients: {
                enabled: true,
                yeastBrand: "Lalvin",
                yeastStrain: "71B",
                nitrogenRequirement: "Medium",
                schedule: "tbe",
                numberOfAdditions: 3,
                goFermType: "Go-Ferm",
              },
              stabilizers: { enabled: false },
            },
          },
        ],
      });
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a one gallon dry traditional mead at 12% ABV with Lalvin 71B, Fermaid K only, Go-Ferm, and three additions.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(
    result.answer,
    /\*\*Nutrients:\*\* Fermaid K, 3 additions, Go-Ferm/,
  );
  assert.doesNotMatch(result.answer, /Tailored Brix-Eating schedule/);
});

test("explicit no-backsweetening and Fermaid K choices override model draft defaults", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "explicit-dry-fermaid-k-guards",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                targetAbv: 12,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "EC-1118",
                  nitrogenRequirement: "Low",
                  schedule: "tbe",
                  numberOfAdditions: 3,
                  goFermType: "Go-Ferm",
                },
                backsweetening: { targetFinalGravity: 1.01 },
                stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a one gallon traditional mead at 12% ABV with EC-1118, Fermaid K with Go-Ferm, and three nutrient additions. Let it ferment dry and stabilize it; I do not want to backsweeten.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(
    result.answer,
    /\*\*Nutrients:\*\* Fermaid K, 3 additions, Go-Ferm/,
  );
  assert.doesNotMatch(result.answer, /Tailored Brix-Eating schedule/);
  assert.doesNotMatch(result.answer, /Honey \(backsweetening\)/);
  assert.equal(result.recipeDraftInput?.backsweetening, undefined);
  assert.equal(result.recipeDraftInput?.nutrients?.schedule, "justK");
});

test("an explicit dry backsweetened mead draft keeps agreed honey and finish defaults when the tool payload omits them", async () => {
  const client: ChatModelClient = {
    async complete() {
      return completion({
        id: "draft-defaults",
        toolCalls: [
          {
            id: "draft-tool",
            name: "build_recipe_draft",
            arguments: {
              batchVolume: { value: 1, unit: "gal" },
              targetAbv: 12,
              ingredients: [{ name: "Wildflower Honey" }],
              nutrients: {
                enabled: true,
                yeastBrand: "Lalvin",
                yeastStrain: "71B",
                nitrogenRequirement: "Medium",
                schedule: "justK",
                numberOfAdditions: 3,
                goFermType: "Go-Ferm",
              },
            },
          },
        ],
      });
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a one gallon mead at 12% ABV. Ferment it dry, then backsweeten it with honey and stabilize it.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /Fermentation FG:\*\* 0\.999/);
  assert.match(result.answer, /Honey \(backsweetening\)/);
  assert.match(result.answer, /### Stabilizers/);
});

test("an explicit backsweetening gravity overrides a model-invented target", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "explicit-backsweetening-target",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                targetAbv: 12,
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                backsweetening: { targetFinalGravity: 1.005 },
                stabilizers: { enabled: true, type: "kmeta" },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a one gallon mead at 12% ABV. Ferment dry, stabilize, then backsweeten to a final gravity of 1.015.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.015,
  );
});

test("the model policy keeps culinary additions out of fermentable calculations and completes explicit drafts", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      return completion({
        id: "policy-check",
        content: "I can help with that recipe.",
      });
    },
  };

  await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a five gallon cherry mead with cocoa nibs and apple cider.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  const policy = requests[0]?.messages[0]?.content ?? "";
  assert.match(policy, /call build_recipe_draft in that turn/i);
  assert.match(
    policy,
    /Treat create, make, build, calculate, draft, or revise a recipe as an explicit draft request/i,
  );
  assert.match(policy, /A yeast-tolerance warning.*not a reason to defer/i);
  assert.match(policy, /never fermentable ingredients/i);
  assert.match(policy, /do not search_ingredients for them, ask for Brix/i);
  assert.match(policy, /search_additives first/i);
  assert.match(policy, /ask for confirmation/i);
  assert.match(
    policy,
    /use search_ingredients to choose the best semantic match/i,
  );
  assert.match(policy, /before making a yeast recommendation/i);
  assert.match(
    policy,
    /use 1\.010 as a clearly labelled medium-sweet planning assumption/i,
  );
  assert.match(
    policy,
    /use the primary honey as the calculated backsweetener/i,
  );
  assert.match(policy, /use 0\.999 as a clearly labelled planning assumption/i);
});

test("an explicit recipe request gets one tool-use repair when the model only offers to draft later", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return completion({
          id: "deferred-plan",
          content:
            "That sounds good. If you want, I can build the calculated recipe draft next.",
        });
      }
      return completion({
        id: "repaired-draft",
        toolCalls: [
          {
            id: "build-after-reminder",
            name: "build_recipe_draft",
            arguments: {
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
          },
        ],
      });
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Create a one gallon traditional mead recipe.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1]?.toolChoice, {
    type: "function",
    function: { name: "build_recipe_draft" },
  });
  assert.match(
    requests[1]?.messages.map((message) => message.content ?? "").join("\n") ??
      "",
    /already explicitly requested a calculated recipe draft/i,
  );
  assert.match(
    requests[1]?.messages.map((message) => message.content ?? "").join("\n") ??
      "",
    /backsweetening\.targetFinalGravity 1\.010/i,
  );
  assert.match(
    requests[1]?.messages.map((message) => message.content ?? "").join("\n") ??
      "",
    /suggest one and ask for confirmation/i,
  );
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
});

test("an explicit draft intake question is repaired through the shared workflow", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return completion({
          id: "reopened-intake",
          content: "Here is a recipe direction I recommend.",
        });
      }
      return completion({
        id: "repaired-draft",
        toolCalls: [
          {
            id: "build-after-intake",
            name: "build_recipe_draft",
            arguments: {
              batchVolume: { value: 1, unit: "gal" },
              targetAbv: 12,
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
            },
          },
        ],
      });
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a one gallon dry traditional mead at 12% ABV with Lalvin 71B and TOSNA.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.equal(requests.length, 2);
  assert.deepEqual(requests[1]?.toolChoice, {
    type: "function",
    function: { name: "build_recipe_draft" },
  });
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
});

test("a missing named-fermentable Brix is resolved through the catalog before user intake", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return completion({
          id: "draft-needs-catalog",
          toolCalls: [
            {
              id: "draft-without-brix",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                targetAbv: 12,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  {
                    name: "Raspberry",
                    amount: { kind: "weight", value: 3, unit: "lb" },
                  },
                ],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "71B",
                  nitrogenRequirement: "Medium",
                  schedule: "tosna",
                  numberOfAdditions: 3,
                  goFermType: "Go-Ferm",
                },
              },
            },
          ],
        });
      }
      if (requests.length === 2) {
        return completion({
          id: "catalog-lookup",
          toolCalls: [
            {
              id: "ingredient-catalog",
              name: "search_ingredients",
              arguments: {},
            },
          ],
        });
      }
      return completion({
        id: "catalog-backed-draft",
        toolCalls: [
          {
            id: "draft-with-catalog-data",
            name: "build_recipe_draft",
            arguments: {
              ingredients: [
                {
                  name: "Raspberries",
                  catalogId: 42,
                  category: "fruit",
                  brix: 10,
                  amount: { kind: "weight", value: 3, unit: "lb" },
                },
              ],
            },
          },
        ],
      });
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Build a one gallon raspberry mead at 12% ABV.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
    ingredientLookup: async () => [
      { id: 42, name: "Raspberries", category: "fruit", brix: 10 },
    ],
  });

  assert.equal(requests.length, 3);
  assert.deepEqual(requests[1]?.toolChoice, {
    type: "function",
    function: { name: "search_ingredients" },
  });
  assert.deepEqual(requests[2]?.toolChoice, {
    type: "function",
    function: { name: "build_recipe_draft" },
  });
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\| Honey \|/);
  assert.doesNotMatch(result.answer, /Brix/i);
});

test("a malformed draft tool call is repaired by the model instead of surfacing a schema error", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete(request) {
        calls += 1;
        if (calls === 1) {
          return completion({
            id: "invalid-draft-input",
            toolCalls: [
              {
                id: "invalid-build",
                name: "build_recipe_draft",
                arguments: { targetAbv: "twelve" },
              },
            ],
          });
        }
        assert.match(
          request.messages.map((message) => message.content ?? "").join("\n"),
          /The draft arguments were invalid/i,
        );
        return completion({
          id: "repaired-build",
          toolCalls: [
            {
              id: "valid-build",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                targetAbv: 12,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
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
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a one gallon traditional mead." },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.equal(calls, 2);
  assert.doesNotMatch(result.answer, /Recipe intake contains invalid values/i);
});

test("the agent asks a natural follow-up after an incomplete draft instead of a deterministic checklist", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        if (calls === 1) {
          return completion({
            id: "incomplete-draft",
            toolCalls: [
              { id: "draft-tool", name: "build_recipe_draft", arguments: {} },
            ],
          });
        }
        return completion({
          id: "follow-up",
          content:
            "I can start there. What batch size would you like to make, and do you prefer a dry, medium-sweet, or sweet finish?",
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Help me make a traditional mead." }],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.equal(calls, 2);
  assert.match(result.answer, /What batch size/i);
  assert.doesNotMatch(
    result.answer,
    /To finish this draft, I need these high-impact choices/i,
  );
});

test("an explicit draft preserves the workflow's narrow missing-input question", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        return completion({
          id: "explicit-blueberry-draft",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                  {
                    name: "Blueberries",
                    category: "fruit",
                    brix: 10,
                    amount: { kind: "weight", value: 3, unit: "lb" },
                  },
                ],
                targetAbv: 12,
                fermentationFinalGravity: 0.999,
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
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build me a beginner blueberry mead recipe that isn’t too complicated.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.equal(calls, 1);
  assert.match(result.answer, /MeadTools needs one detail first/i);
  assert.match(result.answer, /batch size|batch volume/i);
  assert.doesNotMatch(result.answer, /yeast/i);
  assert.doesNotMatch(result.answer, /sweet/i);
});

test("accepted beginner defaults supply the draft nutrient plan", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "beginner-default-draft",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                targetAbv: 12,
                fermentationFinalGravity: 0.999,
                backsweetening: { targetFinalGravity: 1.01 },
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                  {
                    name: "Blueberries",
                    category: "fruit",
                    brix: 10,
                    amount: { kind: "weight", value: 3, unit: "lb" },
                  },
                ],
                stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build me a beginner blueberry mead recipe that isn’t too complicated.",
        },
        {
          role: "assistant",
          content:
            "I can build that draft, but MeadTools needs one detail first: What finished batch volume should this recipe target?",
        },
        {
          role: "user",
          content:
            "Please use sensible beginner defaults and build the 1-gallon draft now.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\*\*Yeast:\*\* Lalvin 71B/);
  assert.match(result.answer, /\*\*Nutrients:\*\* TOSNA, 3 additions, Go-Ferm/);
});

test("accepted beginner defaults override an unrequested no-Go-Ferm payload", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "beginner-default-go-ferm",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                targetAbv: 12,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "71B",
                  nitrogenRequirement: "Medium",
                  schedule: "tosna",
                  numberOfAdditions: 4,
                  goFermType: "none",
                },
                stabilizers: { enabled: false },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Please use sensible beginner defaults and build a 1-gallon traditional mead draft.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\*\*Nutrients:\*\* TOSNA, 4 additions, Go-Ferm/);
});

test("accepted beginner defaults fill draft targets instead of reopening intake", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "beginner-cyser-default-targets",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                ingredients: [
                  { name: "Apple Juice", role: "fill_liquid", brix: 11 },
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I want to make a cyser with apple juice and honey. Can you make me a simple beginner recipe?",
        },
        {
          role: "assistant",
          content:
            "What finished batch volume do you want, like 1 gallon, 5 gallons, or liters?",
        },
        {
          role: "user",
          content:
            "Please use sensible beginner defaults and build the 1-gallon draft now.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\*\*Backsweetened FG:\*\* 1\.01/);
  assert.match(result.answer, /\*\*Nutrients:\*\* TOSNA, 3 additions, Go-Ferm/);
});

test("accepted beginner recommendation phrases fill target, fruit, additive, and nutrient defaults", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "beginner-recommended-amounts-defaults",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                  { name: "Strawberry", category: "fruit", brix: 7 },
                ],
                additives: [{ name: "Vanilla" }, { name: "Lactose" }],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Can you make something like a dessert mead with vanilla, lactose, and strawberry, but keep it beginner friendly?",
        },
        {
          role: "assistant",
          content:
            "I can do that. What volume should this batch be, and should I use recommended amounts?",
        },
        {
          role: "user",
          content: "Use your recommended amounts and build a 1-gallon draft.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\| Strawberry \| 3 lb \| Primary \|/);
  assert.match(result.answer, /\| Vanilla \| 1 each \|/);
  assert.match(result.answer, /\| Lactose \| 4 oz \|/);
  assert.match(result.answer, /\*\*Nutrients:\*\* TOSNA, 3 additions, Go-Ferm/);
});

test("accepted beginner defaults normalize duplicated fruit and model-invented additive doses", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "beginner-duplicate-fruit-and-dose-guard",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                ingredients: [
                  {
                    name: "Strawberry",
                    category: "fruit",
                    brix: 7,
                  },
                  {
                    name: "Strawberry",
                    category: "fruit",
                    brix: 7,
                    secondary: true,
                  },
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                additives: [
                  { name: "Vanilla", amount: 3, unit: "units" },
                  { name: "Lactose", amount: 1, unit: "lb" },
                ],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Can you make something like a dessert mead with vanilla, lactose, and strawberry, but keep it beginner friendly?",
        },
        {
          role: "assistant",
          content: "I can use recommended amounts in a 1-gallon draft.",
        },
        {
          role: "user",
          content: "Use your recommended amounts and build a 1-gallon draft.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /\| Strawberry \| 1\.5 lb \| Primary \|/);
  assert.match(result.answer, /\| Strawberry \| 1\.5 lb \| Secondary \|/);
  assert.match(result.answer, /\| Vanilla \| 1 each \|/);
  assert.match(result.answer, /\| Lactose \| 4 oz \|/);
});

test("accepted holiday defaults convert an unrequested orange-juice fermentable to zest", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "beginner-orange-juice-guard",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                ingredients: [
                  {
                    name: "Orange Juice",
                    category: "juice",
                    brix: 11,
                    secondary: true,
                  },
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                additives: [
                  { name: "Cinnamon Stick", amount: 4, unit: "units" },
                ],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Help me make a holiday-style spiced mead with cinnamon and orange.",
        },
        {
          role: "assistant",
          content: "I recommend a restrained cinnamon and orange addition.",
        },
        {
          role: "user",
          content:
            "Please use sensible beginner defaults and build the 1-gallon draft now.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.doesNotMatch(result.answer, /\| Orange Juice \|/);
  assert.match(result.answer, /\| Orange Zest \| 1 each \|/);
  assert.match(result.answer, /\| Cinnamon Stick \| 1 each \|/);
});

test("accepted beginner defaults resolve named fruit Brix through the catalog", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return completion({
            id: "beginner-blueberry-missing-brix",
            toolCalls: [
              {
                id: "draft-missing-brix",
                name: "build_recipe_draft",
                arguments: {
                  ingredients: [
                    {
                      name: "Blueberry",
                      amount: { kind: "weight", value: 3, unit: "lb" },
                    },
                    { name: "Honey", role: "adjustable_fermentable" },
                  ],
                },
              },
            ],
          });
        }
        if (requests.length === 2) {
          return completion({
            id: "blueberry-catalog",
            toolCalls: [
              {
                id: "ingredient-catalog",
                name: "search_ingredients",
                arguments: {},
              },
            ],
          });
        }
        return completion({
          id: "beginner-blueberry-repeat-without-brix",
          toolCalls: [
            {
              id: "draft-repeat-missing-brix",
              name: "build_recipe_draft",
              arguments: {
                ingredients: [
                  {
                    name: "Blueberry",
                    amount: { kind: "weight", value: 3, unit: "lb" },
                  },
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build me a beginner blueberry mead recipe that isn’t too complicated.",
        },
        {
          role: "assistant",
          content: "What finished batch volume should this recipe target?",
        },
        {
          role: "user",
          content:
            "Please use sensible beginner defaults and build the 1-gallon draft now.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
    ingredientLookup: async () => [
      { id: 24, name: "Blueberries", category: "fruit", brix: 10 },
    ],
  });

  assert.equal(requests.length, 3);
  assert.deepEqual(requests[1]?.toolChoice, {
    type: "function",
    function: { name: "search_ingredients" },
  });
  assert.deepEqual(requests[2]?.toolChoice, {
    type: "function",
    function: { name: "build_recipe_draft" },
  });
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /Blueberry/);
  assert.doesNotMatch(result.answer, /Brix value/);
});

test("accepted beginner fruit defaults use TOSNA and user-facing secondary sweetness wording", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "beginner-blackberry-secondary",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                ingredients: [
                  {
                    name: "Blackberry",
                    category: "fruit",
                    brix: 10,
                    secondary: true,
                  },
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "71B",
                  nitrogenRequirement: "Medium",
                  schedule: "tbe",
                  numberOfAdditions: 4,
                  goFermType: "Go-Ferm",
                },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Can you make a beginner recipe using wildflower honey and blackberries in secondary?",
        },
        {
          role: "assistant",
          content:
            "I just need the yeast brand and strain so I can finish the nutrient plan.",
        },
        {
          role: "user",
          content:
            "Please use sensible beginner defaults and build the 1-gallon draft now.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\| Blackberry \| 3 lb \| Secondary \|/);
  assert.match(result.answer, /\*\*Nutrients:\*\* TOSNA, 4 additions, Go-Ferm/);
  assert.match(result.answer, /Secondary fruit already contributes/);
  assert.doesNotMatch(result.answer, /Tailored Brix-Eating/i);
  assert.doesNotMatch(result.answer, /fixed secondary additions/i);
});

test("explicit backsweetening drafts default to dry fermentation before intake", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "elderberry-backsweetening-default",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 2, unit: "gal" },
                targetAbv: 12,
                ingredients: [
                  {
                    name: "Elderberry",
                    category: "fruit",
                    brix: 10,
                    amount: { kind: "weight", value: 0.5, unit: "lb" },
                  },
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                backsweetening: { targetFinalGravity: 1.01 },
                stabilizers: {
                  enabled: true,
                  type: "kmeta",
                  phReading: 3.6,
                },
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "71B",
                  nitrogenRequirement: "Medium",
                  schedule: "tbe",
                  numberOfAdditions: 4,
                  goFermType: "Go-Ferm",
                },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Adapt this public MeadTools recipe into a new 2 gallon elderberry mead draft with elderberry. I want to stabilize and backsweeten; assume pH 3.6.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\*\*Fermentation FG:\*\* 0\.999/);
});

test("named yeast nutrients infer nitrogen and DAP-only does not ask for Go-Ferm", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "dap-only-71b",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 10, unit: "L" },
                targetOriginalGravity: 1.106,
                fermentationFinalGravity: 0.996,
                ingredients: [
                  {
                    name: "Tart Cherry",
                    category: "fruit",
                    brix: 14,
                    amount: { kind: "weight", value: 800, unit: "g" },
                  },
                  { name: "Honey", role: "adjustable_fermentable" },
                  { name: "Water", role: "fill_liquid" },
                ],
                stabilizers: { enabled: false },
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "71B",
                  schedule: "dap",
                  numberOfAdditions: 3,
                },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I want a 10 liter dry cherry mead with 2.8 kg honey, tart cherries, and Lalvin 71B with DAP in three additions.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(
    result.answer,
    /\*\*Nutrients:\*\* DAP, 3 additions, no Go-Ferm/,
  );
  assert.doesNotMatch(result.answer, /Go-Ferm type/i);
});

test("named beer yeast nutrients infer nitrogen for fixed-juice drafts", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "belle-saison-cyser",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 5, unit: "gal" },
                targetAbv: 10.5,
                ingredients: [
                  {
                    name: "Apple Juice",
                    category: "juice",
                    brix: 11,
                    role: "fill_liquid",
                  },
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                stabilizers: { enabled: false },
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lallemand",
                  yeastStrain: "Belle Saison",
                  schedule: "justO",
                  numberOfAdditions: 3,
                  goFermType: "Go-Ferm",
                },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I want to adapt an apple-forward cyser for 5 gallons: use 4.5 gallons of fresh-pressed apple juice, 3.5 lb of honey, Belle Saison, Go-Ferm, and Fermaid O. Aim for a dry finish around 10.5% ABV.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /There is no room left|volume|conflict/i);
  assert.doesNotMatch(result.answer, /nitrogen requirement/i);
});

test("unresolved syrup requests ask for label data before drafting", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error("Syrup with no sugar data should not reach the model.");
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 1.25 gallon pear cyser with pear juice in primary, 2 lb honey in primary, and 8 oz honey plus pear syrup in secondary.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.equal(result.usage.model, "deterministic-syrup-intake");
  assert.match(result.answer, /pear syrup/i);
  assert.match(result.answer, /product label|measured sugar/i);
});

test("explicit black tea additions are retained with a practical default dose", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "black-tea-additive-default",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 4.5, unit: "gal" },
                targetAbv: 8,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  {
                    name: "Apple Juice",
                    category: "juice",
                    brix: 11,
                    role: "fill_liquid",
                  },
                  {
                    name: "Honey",
                    amount: { kind: "weight", value: 2.5, unit: "lb" },
                  },
                ],
                backsweetening: { targetFinalGravity: 1.01 },
                stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
                nutrients: {
                  enabled: true,
                  yeastBrand: "Fermentis",
                  yeastStrain: "SafAle US-05",
                  nitrogenRequirement: "Medium",
                  schedule: "tosna",
                  numberOfAdditions: 3,
                  goFermType: "Go-Ferm",
                },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 4.5 gallon fall cyser with fresh apple juice, honey, and black tea.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\| Black Tea \| 2 tsp \|/);
  assert.doesNotMatch(result.answer, /\| Honey \| 11\.5 lb \|/);
});

test("explicit ingredient and additive amounts override model-adjusted values", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "fixed-amount-preservation",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 4.5, unit: "gal" },
                targetAbv: 16,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  {
                    name: "Honey",
                    amount: { kind: "weight", value: 11.5, unit: "lb" },
                  },
                  {
                    name: "Apple Juice",
                    category: "juice",
                    brix: 11,
                    role: "fill_liquid",
                  },
                ],
                additives: [{ name: "Oak Cubes", amount: 2.25, unit: "oz" }],
                backsweetening: { targetFinalGravity: 1.01 },
                stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
                nutrients: {
                  enabled: true,
                  yeastBrand: "Fermentis",
                  yeastStrain: "SafAle US-05",
                  nitrogenRequirement: "Medium",
                  schedule: "tosna",
                  numberOfAdditions: 3,
                  goFermType: "Go-Ferm",
                },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 4.5 gallon fall cyser with fresh apple juice, 2.5 lb honey, and 2.5 oz medium-toast oak cubes.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\| Oak Cubes \| 2\.5 oz \|/);
  assert.doesNotMatch(result.answer, /\| Honey \| 11\.5 lb \|/);
});

test("a staged ingredient correction supersedes amounts from the earlier draft", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "corrected-cranberry-amounts",
          toolCalls: [
            {
              id: "corrected-cranberry-draft",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 5, unit: "gal" },
                targetAbv: 14,
                fermentationFinalGravity: 0.999,
                backsweetening: { targetFinalGravity: 1.005 },
                ingredients: [
                  {
                    name: "Cranberry",
                    category: "fruit",
                    brix: 8,
                    amount: { kind: "weight", value: 8, unit: "lb" },
                  },
                  {
                    name: "Cranberry",
                    category: "fruit",
                    brix: 8,
                    secondary: true,
                    amount: { kind: "weight", value: 8, unit: "lb" },
                  },
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "71B",
                  nitrogenRequirement: "Medium",
                  schedule: "justK",
                  numberOfAdditions: 3,
                  goFermType: "Go-Ferm",
                },
                stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 5 gallon cranberry mead at 14% ABV with 8 lb of cranberry in primary. Finish dry with no backsweetening.",
        },
        {
          role: "assistant",
          content: "I created the initial cranberry draft.",
        },
        {
          role: "user",
          content:
            "Change the cranberry to 5 lb in primary plus 5 lb in secondary, then make it suitable for backsweetening with potassium metabisulfite. I will not take a pH reading.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /\| Cranberry \| 5 lb \| Primary \|/);
  assert.match(result.answer, /\| Cranberry \| 5 lb \| Secondary \|/);
  assert.doesNotMatch(result.answer, /\| Cranberry \| 8 lb \|/);
  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.01,
  );
  assert.equal(result.recipeDraftInput?.stabilizers?.enabled, true);
  assert.equal(result.recipeDraftInput?.stabilizers?.phReading, undefined);
  assert.match(result.answer, /assumed pH of 3\.5/i);
});

test("an evenly split fruit total is divided by stage and operational products stay out of Additives", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "even-fruit-split",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 5, unit: "gal" },
                targetAbv: 16,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  {
                    name: "Blueberry",
                    category: "fruit",
                    brix: 10,
                    amount: { kind: "weight", value: 15, unit: "lb" },
                  },
                  {
                    name: "Blueberry",
                    category: "fruit",
                    brix: 10,
                    secondary: true,
                    amount: { kind: "weight", value: 15, unit: "lb" },
                  },
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                additives: [
                  { name: "Go-Ferm", amount: 1, unit: "g" },
                  { name: "Fermaid K", amount: 1, unit: "g" },
                  {
                    name: "Potassium metabisulfite",
                    amount: 1,
                    unit: "g",
                  },
                ],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "71B",
                  nitrogenRequirement: "Medium",
                  schedule: "justK",
                  numberOfAdditions: 3,
                  goFermType: "Go-Ferm",
                },
                backsweetening: { targetFinalGravity: 1.01 },
                stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 5 gallon blueberry mead recipe. I want it to finish dry and backsweeten, with 15 lb of blueberry split evenly between primary and secondary. Target about 16% ABV. Use Lalvin 71B, Fermaid K only with Go-Ferm, and three nutrient additions. Use potassium metabisulfite; I am not taking a pH reading.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /\| Blueberry \| 7\.5 lb \| Primary \|/);
  assert.match(result.answer, /\| Blueberry \| 7\.5 lb \| Secondary \|/);
  assert.doesNotMatch(result.answer, /### Additives/);
  assert.match(result.answer, /assumed pH of 3\.5/i);
  assert.equal(result.recipeDraftInput?.stabilizers?.phReading, undefined);
  assert.deepEqual(result.recipeDraftInput?.additives, []);
});

test("explicit dry ABV intent overrides an incomplete and sweetened model payload", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "dry-explicit-abv",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                ingredients: [
                  {
                    name: "Apple Juice",
                    category: "juice",
                    brix: 11,
                    role: "fill_liquid",
                  },
                  { name: "Wildflower Honey" },
                ],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "D47",
                  nitrogenRequirement: "Medium",
                  schedule: "justK",
                  numberOfAdditions: 2,
                  goFermType: "Go-Ferm",
                },
                backsweetening: { targetFinalGravity: 1.01 },
                stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 1 gallon mead with fresh apple cider, wildflower honey, and D47. I want it dry at about 10% ABV, with Fermaid K and Go-Ferm in two additions.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.equal(result.recipeDraftInput?.targetAbv, 10);
  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  assert.equal(result.recipeDraftInput?.backsweetening, undefined);
  assert.equal(result.recipeDraftInput?.stabilizers?.enabled, false);
});

test("accepted beginner defaults replace a model-invented strength target", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "beginner-strength-guard",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                targetAbv: 17,
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Help me make a simple beginner bochet.",
        },
        {
          role: "assistant",
          content: "What batch size and strength would you like?",
        },
        {
          role: "user",
          content:
            "Please use sensible beginner defaults and build the 1-gallon draft now.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.equal(result.recipeDraftInput?.targetAbv, 12);
  assert.equal(result.recipeDraftInput?.targetOriginalGravity, undefined);
});

test("accepted beginner defaults preserve a named orange blossom honey", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "orange-blossom-honey-guard",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                targetAbv: 12,
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I want a beginner orange blossom traditional mead that is semi-sweet but not too strong. Can you draft it?",
        },
        {
          role: "assistant",
          content: "What strength should I use?",
        },
        {
          role: "user",
          content:
            "Use a sensible beginner strength and build the 1-gallon draft now.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /\| Orange Blossom Honey \|/);
  assert.equal(
    result.recipeDraftInput?.ingredients.find((ingredient) =>
      /honey/i.test(ingredient.name),
    )?.name,
    "Orange Blossom Honey",
  );
});

test("accepted dry beginner defaults fill strength without backsweetening", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "beginner-dry-default-targets",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I want a dry mead instead of sweet. What would you recommend for my first batch?",
        },
        {
          role: "assistant",
          content: "Do you want it plain traditional, or with fruit?",
        },
        {
          role: "user",
          content:
            "Please use sensible beginner defaults and build the 1-gallon draft now.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\*\*Backsweetened FG:\*\* 0\.999/);
  assert.doesNotMatch(result.answer, /Stabilizers/);
});

test("short accepted-default draft follow-up repairs a deferred dry reply", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        if (calls === 1) {
          return completion({
            id: "deferred-dry-draft",
            content:
              "I can build a 1-gallon beginner dry mead draft, but I need one yeast choice.",
          });
        }
        return completion({
          id: "repaired-dry-draft",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I want a dry mead instead of sweet. What would you recommend for my first batch?",
        },
        {
          role: "assistant",
          content:
            "If you want, I can build you a beginner dry-mead draft next.",
        },
        {
          role: "user",
          content:
            "Please use sensible beginner defaults and build the 1-gallon draft now.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.equal(calls, 2);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\*\*Nutrients:\*\* TOSNA, 3 additions, Go-Ferm/);
});

test("accepted beginner defaults do not treat model-supplied water as fixed volume", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "beginner-strawberry-water-fill",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                ingredients: [
                  {
                    name: "Strawberry",
                    category: "fruit",
                    brix: 7,
                    amount: { kind: "weight", value: 3, unit: "lb" },
                  },
                  { name: "Honey", role: "adjustable_fermentable" },
                  {
                    name: "Water",
                    amount: { kind: "volume", value: 1, unit: "gal" },
                  },
                ],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Can you design a 1-gallon strawberry mead that tastes fruity but not syrupy?",
        },
        {
          role: "assistant",
          content:
            "MeadTools still needs yeast brand and strain and nitrogen requirement.",
        },
        {
          role: "user",
          content:
            "Please use sensible beginner defaults and build the 1-gallon draft now.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /Strawberry/);
  assert.doesNotMatch(result.answer, /There is no room left/);
});

test("accepted beginner defaults move holiday spices to additives", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "holiday-spice-additives",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                ingredients: [
                  { name: "Cinnamon" },
                  { name: "Clove" },
                  { name: "Orange" },
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Help me make a holiday-style spiced mead with cinnamon, clove, and orange peel.",
        },
        {
          role: "assistant",
          content: "Do you want peel or juice, and what batch volume?",
        },
        {
          role: "user",
          content:
            "Please use sensible beginner defaults and build the 1-gallon draft now.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\| Cinnamon Stick \| 1 each \|/);
  assert.match(result.answer, /\| Clove \| 2 each \|/);
  assert.match(result.answer, /\| Orange Zest \| 1 each \|/);
  assert.doesNotMatch(result.answer, /Brix value/i);
});

test("accepted beginner defaults do not invent holiday flavors for a blackberry cinnamon draft", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "blackberry-cinnamon-no-holiday-extras",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                ingredients: [
                  {
                    name: "Blackberry",
                    category: "fruit",
                    brix: 8,
                    secondary: true,
                    amount: { kind: "weight", value: 3, unit: "lb" },
                  },
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                additives: [
                  { name: "Cinnamon Stick", amount: 1, unit: "units" },
                  { name: "Clove", amount: 2, unit: "units" },
                  { name: "Orange Zest", amount: 1, unit: "units" },
                ],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I have honey, frozen blackberries, cinnamon sticks, and 71B. What beginner-friendly direction would you take this?",
        },
        {
          role: "assistant",
          content: "A blackberry cinnamon melomel would be approachable.",
        },
        {
          role: "user",
          content:
            "That sounds good. Please build it as a 1-gallon beginner draft with sensible defaults.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /\| Cinnamon Stick \| 1 each \|/);
  assert.match(result.answer, /\| Blackberry \| 3 lb \| Primary \|/);
  assert.doesNotMatch(result.answer, /\| Clove \|/);
  assert.doesNotMatch(result.answer, /\| Orange Zest \|/);
});

test("accepted beginner defaults move ginger to an additive", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "lemon-ginger-additive",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                ingredients: [
                  { name: "Ginger" },
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                additives: [{ name: "Lemon Zest" }],
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Create a first-time recipe for a simple lemon ginger mead.",
        },
        {
          role: "assistant",
          content: "I can do that. What batch size?",
        },
        {
          role: "user",
          content:
            "Please use sensible beginner defaults and build the 1-gallon draft now.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\| Ginger \| 0\.5 oz \|/);
  assert.match(result.answer, /\| Lemon Zest \| 1 each \|/);
  assert.doesNotMatch(result.answer, /Brix value/i);
});

test("explicit additive pounds normalize to the workflow additive unit", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "lactose-pound-additive",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 5, unit: "gal" },
                targetAbv: 12,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                additives: [{ name: "Lactose", amount: 1, unit: "lb" }],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "D47",
                  nitrogenRequirement: "Medium",
                  schedule: "tosna",
                  numberOfAdditions: 4,
                  goFermType: "Go-Ferm",
                },
                stabilizers: { enabled: false },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Build a 5 gallon mead with D47, TOSNA, and 1 lb lactose.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\| Lactose \| 1 lb \|/);
});

test("model-invented strength targets are removed when fixed amounts define the draft", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "invented-target-fixed-amounts",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                targetAbv: 18,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  {
                    name: "Honey",
                    amount: { kind: "weight", value: 2, unit: "lb" },
                  },
                  { name: "Water", role: "fill_liquid" },
                ],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "EC-1118",
                  nitrogenRequirement: "Medium",
                  schedule: "tosna",
                  numberOfAdditions: 4,
                  goFermType: "Go-Ferm",
                },
                stabilizers: { enabled: false },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 1 gallon dry traditional mead with 2 lb honey, water to volume, EC-1118, and TOSNA.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.doesNotMatch(
    result.answer,
    /There is no room left|rather than the requested/i,
  );
});

test("explicit yeast and nutrient schedule text fills an omitted nutrient object", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "explicit-yeast-nutrient-inference",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 5, unit: "gal" },
                targetAbv: 12,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                  {
                    name: "Strawberry",
                    category: "fruit",
                    brix: 7,
                    amount: { kind: "weight", value: 15, unit: "lb" },
                    secondary: true,
                  },
                  { name: "Water", role: "fill_liquid" },
                ],
                stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon strawberry mead with EC-1118, Go-Ferm, and TOSNA. Use 15 lb strawberry in secondary.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\*\*Yeast:\*\* Lalvin EC-1118/);
  assert.match(result.answer, /\*\*Nutrients:\*\* TOSNA, 4 additions, Go-Ferm/);
});

test("explicit yeast text fills incomplete nutrient payloads before intake", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "incomplete-nutrients-filled",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 5, unit: "gal" },
                targetAbv: 12,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                nutrients: {
                  enabled: true,
                  yeastStrain: "EC-1118",
                  schedule: "tosna",
                  numberOfAdditions: 4,
                  goFermType: "Go-Ferm",
                },
                stabilizers: { enabled: false },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon dry mead with EC-1118, Go-Ferm, and TOSNA.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\*\*Yeast:\*\* Lalvin EC-1118/);
  assert.match(result.answer, /\*\*Nutrients:\*\* TOSNA, 4 additions, Go-Ferm/);
});

test("detailed 'I want a mead with' requests get draft repair", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        if (calls === 1) {
          return completion({
            id: "deferred-want-mead",
            content:
              "I can draft this, but please confirm whether to calculate it now.",
          });
        }
        return completion({
          id: "repaired-want-mead",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 10, unit: "L" },
                targetOriginalGravity: 1.106,
                fermentationFinalGravity: 0.996,
                ingredients: [
                  {
                    name: "Honey",
                    amount: { kind: "weight", value: 2.8, unit: "kg" },
                  },
                  {
                    name: "Cherry, Sweet",
                    category: "fruit",
                    brix: 13.63,
                    amount: { kind: "weight", value: 2.7, unit: "kg" },
                  },
                  {
                    name: "Cherry, Tart",
                    category: "fruit",
                    brix: 8.2,
                    amount: { kind: "weight", value: 800, unit: "g" },
                  },
                  { name: "Water", role: "fill_liquid" },
                ],
                additives: [
                  { name: "Bentonite", amount: 15.7, unit: "g" },
                  { name: "Oak Chips", amount: 7, unit: "g" },
                ],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "71B",
                  nitrogenRequirement: "Medium",
                  schedule: "dap",
                  numberOfAdditions: 3,
                  goFermType: "none",
                },
                stabilizers: { enabled: false },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I want a 10 liter dry cherry mead with 2.8 kg honey, 2.7 kg sweet cherries, and 800 g tart cherries in primary. Use Lalvin 71B with DAP in three additions. Add 15.7 g bentonite and 7 g oak chips. Target about 1.106 OG and finish near 0.996.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.equal(calls, 2);
});

test("dry named-honey drafts infer fermentation FG and named yeast nutrients", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "dry-named-honey-yeast-inference",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 2, unit: "gal" },
                targetAbv: 12,
                ingredients: [
                  {
                    name: "Orange Blossom Honey",
                    amount: { kind: "weight", value: 6, unit: "lb" },
                  },
                  { name: "Water", role: "fill_liquid" },
                ],
                stabilizers: { enabled: false },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 2 gallon dry traditional with 6 lb of orange blossom honey, Lalvin 71B, Go-Ferm, and Fermaid K in three additions. Target 12% ABV and do not stabilize or backsweeten.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\*\*Fermentation FG:\*\* 0\.999/);
  assert.match(result.answer, /\*\*Yeast:\*\* Lalvin 71B/);
  assert.match(
    result.answer,
    /\*\*Nutrients:\*\* Fermaid K, 3 additions, Go-Ferm/,
  );
});

test("repeated honey amounts stay attached to their requested stages", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "repeated-honey-stage-amounts",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 5, unit: "gal" },
                fermentationFinalGravity: 0.999,
                ingredients: [
                  {
                    name: "Honey",
                    amount: { kind: "weight", value: 1, unit: "lb" },
                  },
                  {
                    name: "Strawberry",
                    category: "fruit",
                    brix: 7,
                    amount: { kind: "weight", value: 2, unit: "lb" },
                    secondary: true,
                  },
                  {
                    name: "Honey",
                    amount: { kind: "weight", value: 15, unit: "lb" },
                    secondary: true,
                  },
                  { name: "Water", role: "fill_liquid" },
                ],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "EC-1118",
                  nitrogenRequirement: "Medium",
                  schedule: "tosna",
                  numberOfAdditions: 4,
                  goFermType: "Go-Ferm",
                },
                stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon strawberry mead: 12 lb wildflower honey in primary, then 15 lb strawberry and 2 lb honey in secondary. Use EC-1118, Go-Ferm, and TOSNA. I want it dry before the secondary additions and plan to stabilize afterward.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\| Wildflower Honey \| 12 lb \| Primary \|/);
  assert.match(result.answer, /\| Strawberry \| 15 lb \| Secondary \|/);
  assert.match(result.answer, /\| Honey \| 2 lb \| Secondary \|/);
});

test("specific honey names still recover shorthand secondary honey amounts", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "specific-honey-shorthand-secondary-amount",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 3, unit: "gal" },
                fermentationFinalGravity: 0.999,
                backsweetening: { targetFinalGravity: 1.01 },
                ingredients: [
                  {
                    name: "Wildflower Honey",
                    amount: { kind: "weight", value: 6, unit: "lb" },
                  },
                  {
                    name: "Cherry, Tart",
                    category: "fruit",
                    brix: 12,
                    amount: { kind: "weight", value: 6, unit: "lb" },
                    secondary: true,
                  },
                  {
                    name: "Wildflower Honey",
                    amount: { kind: "weight", value: 0.7, unit: "lb" },
                    secondary: true,
                  },
                  { name: "Water", role: "fill_liquid" },
                ],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "71B",
                  nitrogenRequirement: "Medium",
                  schedule: "tosna",
                  numberOfAdditions: 4,
                  goFermType: "Go-Ferm",
                },
                stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 3 gallon cherry mead: 7 lb wildflower honey in primary, 6 lb tart cherries and 12 oz honey in secondary. Use 71B, Go-Ferm, and TOSNA. Ferment dry before secondary, stabilize, then backsweeten.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\| Wildflower Honey \| 7 lb \| Primary \|/);
  assert.match(result.answer, /\| Wildflower Honey \| 12 oz \| Secondary \|/);
});

test("specific culinary additives prevent duplicate generic fallback additives", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return completion({
          id: "specific-additives-no-duplicates",
          toolCalls: [
            {
              id: "draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 1, unit: "gal" },
                targetAbv: 8,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                ],
                additives: [
                  { name: "Madagascar Vanilla", amount: 0.25, unit: "oz" },
                  { name: "Estate Tannin", amount: 1, unit: "g" },
                ],
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
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 1 gallon mead with 0.25 oz Madagascar vanilla and 1 g Estate Tannin.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\| Madagascar Vanilla \| 0\.25 oz \|/);
  assert.match(result.answer, /\| Estate Tannin \| 1 g \|/);
  assert.doesNotMatch(result.answer, /\| Vanilla \|/);
  assert.doesNotMatch(result.answer, /\| Tannin \| 1 g \|/);
});

test("tiny fixed-fermentable gravity warnings are hidden from recipe drafts", () => {
  const workflow = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetAbv: 12,
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
  });
  assert.equal(workflow.status, "recipe");
  const answer = directRecipeToolAnswer("build_recipe_draft", {
    status: "ok",
    result: {
      ...workflow,
      warnings: [
        "The supplied fixed fermentables calculate to an original gravity of 1.0883 rather than the requested 1.089772.",
      ],
    },
  });

  assert.ok(answer);
  assert.doesNotMatch(answer, /rather than the requested/);
});

test("beginner yeast recommendations are grounded with the yeast lookup", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return completion({
            id: "yeast-search",
            toolCalls: [
              {
                id: "yeast-tool",
                name: "search_yeasts",
                arguments: { query: "Lalvin 71B", limit: 3 },
              },
            ],
          });
        }
        return completion({
          id: "yeast-answer",
          content:
            "For a clean, forgiving first mead, I would use Lalvin 71B. MeadTools lists it as a medium-nitrogen yeast, so it pairs well with a simple TOSNA plan.",
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "What yeast should a beginner use for a clean, forgiving first mead?",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
    yeastLookup: async () => [
      {
        id: 71,
        name: "Lalvin 71B",
        brand: "Lalvin",
        strain: "71B",
        nitrogenRequirement: "Medium",
        tolerance: 14,
        lowTemperature: 59,
        highTemperature: 86,
      },
    ],
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_yeasts" },
  });
  assert.equal(result.toolResults[0]?.toolName, "search_yeasts");
  assert.match(result.answer, /Lalvin 71B/);
  assert.doesNotMatch(result.answer, /brand or strain/i);
});

test("catalog yeast tolerance reaches recipe drafts when the model omits the nutrient block", async () => {
  let requestCount = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        requestCount += 1;
        if (requestCount === 1) {
          return completion({
            id: "d47-search",
            toolCalls: [
              {
                id: "d47-search-tool",
                name: "search_yeasts",
                arguments: { query: "D47", limit: 3 },
              },
            ],
          });
        }
        return completion({
          id: "d47-draft",
          toolCalls: [
            {
              id: "d47-draft-tool",
              name: "build_recipe_draft",
              arguments: {
                batchVolume: { value: 2, unit: "gal" },
                fermentationFinalGravity: 0.999,
                backsweetening: { targetFinalGravity: 1.01 },
                ingredients: [
                  {
                    name: "Honey",
                    category: "honey",
                    brix: 81,
                    amount: { kind: "weight", value: 7, unit: "lb" },
                  },
                  {
                    name: "Blueberry",
                    catalogId: 42,
                    category: "fruit",
                    brix: 10,
                    secondary: true,
                    amount: { kind: "weight", value: 6, unit: "lb" },
                  },
                ],
                stabilizers: {
                  enabled: true,
                  type: "kmeta",
                  phReading: 3.5,
                },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 2 gallon blueberry mead with 7 lb honey in primary and 6 lb blueberries in secondary. Use D47, Go-Ferm, and TOSNA. Stabilize and backsweeten after it ferments dry.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
    yeastLookup: async () => [
      {
        id: 47,
        brand: "Lalvin",
        name: "ICV D47",
        nitrogenRequirement: "Medium",
        tolerance: 14,
        lowTemperature: 59,
        highTemperature: 68,
      },
    ],
  });

  assert.equal(requestCount, 2);
  assert.match(result.answer, /catalog alcohol tolerance/i);
  assert.match(result.answer, /Lalvin ICV D47/);
  assert.match(result.answer, /14%/);
});

test("selected recipe adaptation guidance stays conversational unless a draft is requested", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const attachedRecipe = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetAbv: 12,
    fermentationFinalGravity: 0.999,
    ingredients: [
      { name: "Honey", role: "adjustable_fermentable" },
      { name: "Water", role: "fill_liquid" },
    ],
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
  });
  assert.equal(attachedRecipe.status, "recipe");
  await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return completion({
            id: "selected-context",
            toolCalls: [
              {
                id: "context-tool",
                name: "get_selected_account_context",
                arguments: {},
              },
            ],
          });
        }
        if (requests.length === 2) {
          return completion({
            id: "misrouted-adaptation-draft",
            toolCalls: [
              {
                id: "draft-tool",
                name: "build_recipe_draft",
                arguments: {
                  batchVolume: { value: 5, unit: "gal" },
                  targetAbv: 10,
                  fermentationFinalGravity: 0.999,
                  ingredients: [
                    {
                      name: "Water",
                      amount: { kind: "volume", value: 5, unit: "gal" },
                    },
                    { name: "Honey", role: "adjustable_fermentable" },
                  ],
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
              },
            ],
          });
        }
        return completion({
          id: "adapt-answer",
          content:
            "To lower the alcohol while keeping the Key Lime Pie character, keep the lime, vanilla, cinnamon, and creamy finish, but reduce the starting gravity and scale back the honey.",
        });
      },
    },
    userId: 7,
    request: {
      ...chatRequestSchema.parse({
        messages: [
          {
            role: "user",
            content:
              "How could I adapt this attached recipe to be lower alcohol while keeping its character?",
          },
        ],
      }),
      selectedAccountContext: {
        kind: "recipe",
        label: "Recipe: Key Lime Pie",
        recipe: {
          id: 1,
          name: "Key Lime Pie",
          dataV2: attachedRecipe.recipeData,
        },
      },
    },
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  const policy = requests[0]?.messages[0]?.content ?? "";
  assert.match(policy, /answer conversationally/i);
  assert.match(policy, /unless they explicitly ask you to calculate or build/i);
  assert.equal(requests.length, 3);
  assert.equal(requests[2]?.toolChoice, "auto");
});

test("the model can use the additive tool without treating a flavor addition as a fermentable", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        if (calls === 1) {
          return completion({
            id: "additive-search",
            toolCalls: [
              {
                id: "additive-tool",
                name: "search_additives",
                arguments: { query: "cocoa nibs" },
              },
            ],
          });
        }
        return completion({
          id: "additive-answer",
          content:
            "Cocoa nibs make sense as an additive. I’ll keep them separate from the fermentable fruit and honey when we build the draft.",
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "I want a cherry chocolate mead with cocoa nibs.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
    additiveLookup: async () => [],
  });

  assert.equal(calls, 2);
  assert.equal(result.toolResults[0]?.toolName, "search_additives");
  assert.match(result.answer, /additive/i);
});

test("an undosed additive is routed to catalog lookup and confirmation, never recipe notes", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return completion({
            id: "undosed-additive-draft",
            toolCalls: [
              {
                id: "draft-tool",
                name: "build_recipe_draft",
                arguments: {
                  batchVolume: { value: 1, unit: "gal" },
                  targetAbv: 12,
                  fermentationFinalGravity: 0.999,
                  ingredients: [
                    { name: "Honey", role: "adjustable_fermentable" },
                  ],
                  additives: [{ name: "Vanilla", secondary: true }],
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
              },
            ],
          });
        }
        if (requests.length === 2) {
          return completion({
            id: "undosed-additive-search",
            toolCalls: [
              {
                id: "additive-search",
                name: "search_additives",
                arguments: { query: "Vanilla" },
              },
            ],
          });
        }
        return completion({
          id: "undosed-additive-confirmation",
          content:
            "Vanilla is not in the MeadTools additive catalog. For this one-gallon batch, I suggest 1 vanilla bean in secondary. That is my suggestion rather than catalog data—would you like to use it?",
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a one gallon traditional mead with vanilla in secondary.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
    additiveLookup: async () => [],
  });

  assert.equal(requests.length, 3);
  assert.deepEqual(requests[1]?.toolChoice, {
    type: "function",
    function: { name: "search_additives" },
  });
  assert.match(
    requests[2]?.messages.at(-1)?.content ?? "",
    /concrete plain-language dose suggestion appropriate/i,
  );
  assert.match(result.answer, /suggest 1 vanilla bean/i);
  assert.match(result.answer, /would you like to use it/i);
  assert.doesNotMatch(result.answer, /Unsaved MeadTools recipe draft/i);
  assert.doesNotMatch(result.answer, /recipe note/i);
});

test("a model-led plan revision replaces removed ingredients and retains additions", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        if (calls === 1) {
          return completion({
            id: "revised-plan",
            toolCalls: [
              {
                id: "record-revision",
                name: "record_recipe_plan",
                arguments: {
                  plan: {
                    batchVolume: { value: 1, unit: "gal" },
                    targetOriginalGravity: 1.09,
                    fermentationFinalGravity: 0.999,
                    ingredients: [
                      { name: "Honey", role: "adjustable_fermentable" },
                    ],
                    additives: [{ name: "Cocoa nibs", amount: 16, unit: "oz" }],
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
                },
              },
            ],
          });
        }
        return completion({
          id: "revision-answer",
          content:
            "I removed the raspberry and kept the cocoa nibs as a separate additive. Tell me when you want the recalculated draft.",
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Remove the raspberry and keep 1 lb cocoa nibs as an additive.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          {
            name: "Raspberry",
            amount: { kind: "weight", value: 3, unit: "lb" },
          },
        ],
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
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.equal(calls, 2);
  assert.deepEqual(
    result.recipeDraftInput?.ingredients.map(({ name }) => name),
    ["Honey"],
  );
  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Cocoa nibs", amount: 16, unit: "oz" },
  ]);
  assert.match(result.answer, /removed the raspberry/i);
});

test("an explicit recipe revision can replace fruit and retain a culinary additive in the completed draft", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        return completion({
          id: "revised-draft",
          toolCalls: [
            {
              id: "build-revised-draft",
              name: "build_recipe_draft",
              arguments: {
                name: "Cherry Chocolate Mead",
                batchVolume: { value: 5, unit: "gal" },
                targetOriginalGravity: 1.11,
                fermentationFinalGravity: 0.999,
                ingredients: [
                  { name: "Honey", role: "adjustable_fermentable" },
                  {
                    name: "Tart Cherry",
                    catalogId: 101,
                    category: "fruit",
                    brix: 14,
                    amount: { kind: "weight", value: 20, unit: "lb" },
                  },
                ],
                additives: [{ name: "Cocoa nibs", amount: 16, unit: "oz" }],
                nutrients: {
                  enabled: true,
                  yeastBrand: "Lalvin",
                  yeastStrain: "71B",
                  nitrogenRequirement: "Medium",
                  schedule: "justK",
                  numberOfAdditions: 3,
                  goFermType: "Go-Ferm",
                },
                stabilizers: { enabled: false },
              },
            },
          ],
        });
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Remove the raspberry, keep one pound of cocoa nibs, and revise the draft.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.11,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          {
            name: "Raspberry",
            catalogId: 102,
            category: "fruit",
            brix: 11,
            amount: { kind: "weight", value: 15, unit: "lb" },
          },
        ],
        nutrients: {
          enabled: true,
          yeastBrand: "Lalvin",
          yeastStrain: "71B",
          nitrogenRequirement: "Medium",
          schedule: "justK",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 6,
  });

  assert.equal(calls, 1);
  assert.deepEqual(
    result.recipeDraftInput?.ingredients.map(({ name }) => name),
    ["Honey", "Tart Cherry"],
  );
  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Cocoa nibs", amount: 16, unit: "oz" },
  ]);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /Cocoa nibs/);
  assert.doesNotMatch(result.answer, /Raspberry/);
});

test("completed MeadTools drafts retain the deterministic save-ready renderer", () => {
  const answer = directRecipeToolAnswer("build_recipe_draft", {
    status: "ok",
    result: buildRecipeDraft({
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
    }),
  });

  assert.match(answer ?? "", /^## Unsaved MeadTools recipe draft/);
});
