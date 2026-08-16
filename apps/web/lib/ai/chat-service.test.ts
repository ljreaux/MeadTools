import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateGravityTarget,
  buildRecipeDraft,
  explainRecipe,
} from "@meadtools/recipe-workflows";
import type { ChatModelClient, FireworksCompletionRequest } from "./fireworks";
import {
  chatRequestSchema,
  calculatorLinkForProcessMessage,
  directRecipeToolAnswer,
  removeGeneralBrewingContextForWikiOnlyRequest,
  removeUnsupportedSulfurInterventions,
  removeUnrequestedCalculatorDoses,
  removeUnsupportedRackingFallback,
  removeUnsupportedProcessThresholds,
  removeCompletedRecipeFollowUp,
  runDeterministicChatTurn,
  runChatTurn,
} from "./chat-service";
import type { WikiFetcher } from "@meadtools/wiki-knowledge";

const nutrientPlan = {
  enabled: true as const,
  yeastBrand: "Lalvin",
  yeastStrain: "71B",
  nitrogenRequirement: "Medium",
  schedule: "tosna",
  numberOfAdditions: 4,
  goFermType: "Go-Ferm",
};

const wikiFetcher: WikiFetcher = async (url) => ({
  ok: true,
  status: 200,
  url,
  headers: { get: (name) => (name === "content-type" ? "text/html" : null) },
  text: async () => "<main>Reviewed MeadTools wiki guidance.</main>",
});

test("process calculator routing prefers the dedicated MeadTools calculators", () => {
  assert.deepEqual(
    calculatorLinkForProcessMessage(
      "How much potassium metabisulfite and sorbate do I need?",
    ),
    { label: "Stabilizer calculator", href: "/stabilizers" },
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage(
      "What should I do after I stabilize my mead?",
    ),
    { label: "Stabilizer calculator", href: "/stabilizers" },
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage(
      "How should I calculate a Fermaid K schedule?",
    ),
    { label: "Nutrient calculator", href: "/nute-calc" },
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage(
      "How do I correct a refractometer reading after fermentation?",
    ),
    {
      label: "Refractometer correction calculator",
      href: "/extra-calcs/refractometer-correction",
    },
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage(
      "How much priming sugar do I need for carbonation?",
    ),
    { label: "Priming sugar calculator", href: "/extra-calcs/priming-sugar" },
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage("How much sulfite should I add?"),
    { label: "Sulfite calculator", href: "/extra-calcs/sulfite" },
  );
  assert.deepEqual(
    calculatorLinkForProcessMessage("What is causing a sulfur aroma?"),
    undefined,
  );
});

test("an empty generic yeast lookup is not presented as a missing user-supplied yeast", () => {
  assert.equal(
    directRecipeToolAnswer("search_yeasts", { status: "ok", result: [] }),
    undefined,
  );
});

test("exact calculator requests link to MeadTools without invoking the model", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error(
          "The model should not be called for a calculator route.",
        );
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Can you calculate the exact sulfite amount for me?",
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

test("deterministic preflight keeps first-turn scope answers provider-free", () => {
  const result = runDeterministicChatTurn({
    provider: "openai",
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "What is Bitcoin trading at?" }],
    }),
  });

  assert.equal(result?.usage.model, "deterministic-scope-check");
  assert.equal(result?.usage.requestIds.length, 0);
});

test("usage progress survives a later provider failure in a tool turn", async () => {
  let completions = 0;
  const checkpoints: Array<{ requestIds: string[]; totalTokens: number }> = [];

  await assert.rejects(
    runChatTurn({
      client: {
        async complete() {
          completions += 1;
          if (completions > 1) throw new Error("second provider call failed");
          return {
            id: "first-completed-provider-call",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "ingredient-search",
                  type: "function",
                  function: {
                    name: "search_ingredients",
                    arguments: '{"query":"wildflower honey"}',
                  },
                },
              ],
            },
            usage: {
              inputTokens: 12,
              cachedInputTokens: 3,
              outputTokens: 4,
              totalTokens: 16,
            },
          };
        },
      },
      userId: 7,
      request: chatRequestSchema.parse({
        messages: [
          {
            role: "user",
            content:
              "Create a one gallon traditional mead with wildflower honey.",
          },
        ],
      }),
      maxOutputTokens: 500,
      maxToolCalls: 6,
      ingredientLookup: async () => [
        { id: 1, name: "Honey", category: "Honey", brix: 80 },
      ],
      onUsage: (usage) => {
        checkpoints.push({
          requestIds: [...usage.requestIds],
          totalTokens: usage.totalTokens,
        });
      },
    }),
    /second provider call failed/,
  );

  assert.deepEqual(checkpoints, [
    { requestIds: ["first-completed-provider-call"], totalTokens: 16 },
  ]);
});

test("a durable provider-attempt write is required before provider dispatch", async () => {
  let providerCalled = false;

  await assert.rejects(
    runChatTurn({
      client: {
        async complete() {
          providerCalled = true;
          throw new Error("The provider must not be reached.");
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

test("a later completion without a durable usage checkpoint remains distinguishable", async () => {
  let providerAttempts = 0;
  const checkpointedCallCounts: number[] = [];
  let completions = 0;

  await assert.rejects(
    runChatTurn({
      client: {
        async complete() {
          completions += 1;
          if (completions === 1) {
            return {
              id: "checkpointed-tool-call",
              model: "test-model",
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "ingredient-search",
                    type: "function",
                    function: {
                      name: "search_ingredients",
                      arguments: '{"query":"wildflower honey"}',
                    },
                  },
                ],
              },
              usage: {
                inputTokens: 12,
                cachedInputTokens: 3,
                outputTokens: 4,
                totalTokens: 16,
              },
            };
          }
          return {
            id: "uncheckpointed-final-call",
            model: "test-model",
            message: { role: "assistant", content: "Here is the result." },
            usage: {
              inputTokens: 8,
              cachedInputTokens: 2,
              outputTokens: 5,
              totalTokens: 13,
            },
          };
        },
      },
      userId: 7,
      request: chatRequestSchema.parse({
        messages: [
          {
            role: "user",
            content:
              "Create a one gallon traditional mead with wildflower honey.",
          },
        ],
      }),
      maxOutputTokens: 500,
      maxToolCalls: 6,
      ingredientLookup: async () => [
        { id: 1, name: "Honey", category: "Honey", brix: 80 },
      ],
      onProviderAttempt: () => {
        providerAttempts += 1;
      },
      onUsage: (usage) => {
        if (usage.requestIds.length === 2) {
          throw new Error("The second usage checkpoint did not persist.");
        }
        checkpointedCallCounts.push(usage.requestIds.length);
      },
    }),
    /second usage checkpoint did not persist/,
  );

  assert.equal(providerAttempts, 2);
  assert.deepEqual(checkpointedCallCounts, [1]);
});

test("a process request with a calculator need returns both sourced guidance and the calculator link", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return {
            id: "stabilizer-wiki-search",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "stabilizer-wiki-search-call",
                  type: "function",
                  function: {
                    name: "search_wiki",
                    arguments: '{"query":"stabilizing backsweetening"}',
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        if (requests.length === 2) {
          return {
            id: "stabilizer-wiki-fetch",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "stabilizer-wiki-fetch-call",
                  type: "function",
                  function: {
                    name: "fetch_wiki_page",
                    arguments:
                      '{"url":"https://wiki.meadtools.com/en/faq/stabilization_and_backsweetening"}',
                  },
                },
              ],
            },
            usage: {
              inputTokens: 12,
              outputTokens: 4,
              totalTokens: 16,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "stabilizer-wiki-answer",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "## Stabilizing before backsweetening\n\n1. Confirm fermentation is complete before changing sweetness.",
          },
          usage: {
            inputTokens: 14,
            outputTokens: 8,
            totalTokens: 22,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "What is the MeadTools process for stabilizing before backsweetening, and where can I calculate the dose?",
        },
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
  assert.match(result.answer, /\[Stabilizer calculator\]\(\/stabilizers\)/);
  assert.match(
    result.answer,
    /\[The Modern Meadmaking Wiki\]\(https:\/\/wiki\.meadtools\.com\/en\/faq\/stabilization_and_backsweetening\)/,
  );
});

test("stabilization process answers keep the workflow but remove unsolicited doses", () => {
  const request = chatRequestSchema.parse({
    messages: [
      {
        role: "user",
        content:
          "My mead is stable and I want to stabilize it before backsweetening. What should I do next?",
      },
    ],
  });
  const answer = removeUnrequestedCalculatorDoses(
    [
      "1. Confirm fermentation is complete with stable hydrometer readings.",
      "2. Add 2.2 g of potassium metabisulfite (one tablet per gallon).",
      "3. Add 2.5 g of potassium sorbate alongside it.",
      "4. Wait 24 hours before backsweetening.",
    ].join("\n\n"),
    request,
  );

  assert.match(answer, /Confirm fermentation is complete/);
  assert.match(answer, /Wait 24 hours/);
  assert.doesNotMatch(answer, /2\.2 g|2\.5 g|tablet per gallon/);
});

test("racking and step-feeding answers do not turn numeric examples into universal thresholds", () => {
  const rackingRequest = chatRequestSchema.parse({
    messages: [
      { role: "user", content: "My mead has lees. Should I rack it now?" },
    ],
  });
  assert.equal(
    removeUnsupportedProcessThresholds(
      "Take two readings 3-5 days apart, then decide from the batch state.",
      rackingRequest,
    ),
    "Take two readings on separate occasions, then decide from the batch state.",
  );
  assert.equal(
    removeUnsupportedProcessThresholds(
      "Take another reading in 3-5 days. If nothing changed over that period, reassess the batch.",
      rackingRequest,
    ),
    "Take another reading later and compare it with the first. If nothing changed between those readings, reassess the batch.",
  );

  const stepFeedRequest = chatRequestSchema.parse({
    messages: [
      {
        role: "user",
        content: "How should I step-feed a high-gravity traditional mead?",
      },
    ],
  });
  assert.equal(
    removeUnsupportedProcessThresholds(
      "Add honey after a 30 gravity points drop.",
      stepFeedRequest,
    ),
    "Add honey after a fixed gravity-point threshold drop.",
  );

  const stabilizationRequest = chatRequestSchema.parse({
    messages: [
      {
        role: "user",
        content: "What should I do before I backsweeten a finished mead?",
      },
    ],
  });
  assert.equal(
    removeUnsupportedProcessThresholds(
      "Take hydrometer readings a few days apart, then wait a few hours or overnight before backsweetening.",
      stabilizationRequest,
      true,
    ),
    "Take hydrometer readings on separate occasions, then wait a few hours or overnight before backsweetening.",
  );
});

test("a process question using the word correct is not routed straight to a calculator", async () => {
  let providerCalls = 0;
  await runChatTurn({
    client: {
      async complete() {
        providerCalls += 1;
        return {
          id: "process-answer",
          model: "test-model",
          message: {
            role: "assistant",
            content: "I need to retrieve the wiki process guidance.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "What is the correct process for stabilizing mead before backsweetening?",
        },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 2,
  });

  assert.equal(providerCalls, 1);
});

test("an explicit medium-sweet draft request applies the revisable dry-fermentation default", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "medium-sweet-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "build-medium-sweet",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    batchVolume: { value: 1, unit: "gal" },
                    targetOriginalGravity: 1.09,
                    ingredients: [
                      { name: "Honey", role: "adjustable_fermentable" },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon medium sweet traditional at 1.090 OG. Make sensible assumptions and give me the recipe.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 3,
    yeastLookup: async () => [
      {
        id: 71,
        name: "71B-1122",
        brand: "Lalvin",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 15,
        highTemperature: 30,
      },
    ],
  });

  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.015,
  );
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
});

test("an explicit draft request completes a structured plan instead of asking for duplicate approval", async () => {
  let providerCalls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        providerCalls += 1;
        if (providerCalls === 1) {
          return {
            id: "retain-medium-sweet-plan",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "retain-plan",
                  type: "function",
                  function: {
                    name: "record_recipe_plan",
                    arguments: JSON.stringify({
                      plan: {
                        batchVolume: { value: 1, unit: "gal" },
                        targetOriginalGravity: 1.09,
                        fermentationFinalGravity: 0.999,
                        backsweetening: { targetFinalGravity: 1.015 },
                        stabilizers: {
                          enabled: true,
                          type: "kmeta",
                          phReading: 3.5,
                        },
                        nutrients: {
                          enabled: true,
                          yeastId: 71,
                          yeastBrand: "Lalvin",
                          yeastStrain: "71B-1122",
                          nitrogenRequirement: "Low",
                          schedule: "tosna",
                          numberOfAdditions: 3,
                          goFermType: "Go-Ferm",
                        },
                        ingredients: [
                          { name: "Honey", role: "adjustable_fermentable" },
                        ],
                      },
                    }),
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 5,
              totalTokens: 15,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "unnecessary-confirmation",
          model: "test-model",
          message: {
            role: "assistant",
            content: "Would you like me to make the full recipe draft?",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon medium sweet traditional at 1.090 OG. Make sensible assumptions and give me the recipe.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 4,
  });

  assert.equal(providerCalls, 2);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.015,
  );
});

test("no-added-backsweetening honey does not become a honey varietal or FG target", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "secondary-fruit-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "build-secondary-fruit",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    batchVolume: { value: 1, unit: "gal" },
                    targetOriginalGravity: 1.09,
                    fermentationFinalGravity: 0.999,
                    backsweetening: { targetFinalGravity: 1.01 },
                    ingredients: [
                      { name: "Honey", role: "adjustable_fermentable" },
                      {
                        name: "Blueberry",
                        category: "fruit",
                        brix: 10,
                        secondary: true,
                        amount: { kind: "weight", value: 3, unit: "lb" },
                      },
                    ],
                    nutrients: nutrientPlan,
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 5,
            totalTokens: 15,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon dry blueberry mead at 1.090 OG with 3 lb blueberry in secondary. Do not add backsweetening honey.",
        },
      ],
    }),
    maxOutputTokens: 1_000,
    maxToolCalls: 3,
  });

  assert.equal(result.recipeDraftInput?.backsweetening, undefined);
  assert.equal(result.recipeDraftInput?.backsweeteningIntent, false);
  assert.doesNotMatch(result.answer, /No Added Backsweetening Honey/i);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
});

test("racking fallback does not present general advice as MeadTools guidance", () => {
  const request = chatRequestSchema.parse({
    messages: [
      {
        role: "user",
        content: "According to the MeadTools wiki, when should I rack my mead?",
      },
    ],
  });

  const answer = removeUnsupportedRackingFallback(
    "The Getting Started page doesn't directly address racking timing, but general best practice is to rack after a week.",
    request,
  );

  assert.match(
    answer,
    /could not find a Modern Meadmaking Wiki page that directly covers racking timing/i,
  );
  assert.doesNotMatch(answer, /general best practice|after a week/i);
});

test("wiki-only requests discard a separately labelled general-brewing section", () => {
  const request = chatRequestSchema.parse({
    messages: [
      {
        role: "user",
        content:
          "When should I rack mead with lees? Please only give guidance that the MeadTools wiki supports.",
      },
    ],
  });
  const answer = removeGeneralBrewingContextForWikiOnlyRequest(
    "The Modern Meadmaking Wiki does not provide a universal racking rule.\n\nGeneral brewing context: Rack after stable gravity and a compact lees layer.\n\nSource: https://wiki.meadtools.com/en/getting_started",
    request,
  );

  assert.equal(
    answer,
    "The Modern Meadmaking Wiki does not provide a universal racking rule.\n\nSource: https://wiki.meadtools.com/en/getting_started",
  );
});

test("sulfur troubleshooting removes an uncited aeration intervention", () => {
  const request = chatRequestSchema.parse({
    messages: [
      {
        role: "user",
        content:
          "My fermenting mead smells like rotten eggs. What should I do first?",
      },
    ],
  });
  const answer = removeUnsupportedSulfurInterventions(
    "With those details, I can help decide whether a simple nutrient addition will resolve the issue, or whether a different approach (like aeration or yeast hulls) is needed.",
    request,
  );

  assert.match(answer, /wiki-listed yeast hulls/i);
  assert.doesNotMatch(answer, /aeration/i);
});

test("sulfur troubleshooting discards a detailed intervention plan that is not source-bound", () => {
  const request = chatRequestSchema.parse({
    messages: [
      {
        role: "user",
        content:
          "My fermenting mead smells like rotten eggs. What should I do first?",
      },
    ],
  });
  const answer = removeUnsupportedSulfurInterventions(
    "Add DAP or Fermaid, degas gently, and wait 24–48 hours. Source: https://wiki.meadtools.com/en/faq/basic_problems",
    request,
    "https://wiki.meadtools.com/en/faq/basic_problems",
  );

  assert.match(
    answer,
    /please share the yeast, original gravity, current gravity/i,
  );
  assert.match(
    answer,
    /Source: \[The Modern Meadmaking Wiki\]\(https:\/\/wiki\.meadtools\.com\/en\/faq\/basic_problems\)/,
  );
  assert.doesNotMatch(answer, /DAP|Fermaid|degas|24/i);
});

test("racking requests explicitly asking for wiki guidance force a wiki lookup", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "racking-wiki-source",
          model: "test-model",
          message: { role: "assistant", content: "No tool call." },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "My mead has lees. Should I rack it now? Please use MeadTools wiki guidance.",
        },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_wiki" },
  });
  assert.match(
    result.answer,
    /could not retrieve the Modern Meadmaking Wiki page/i,
  );
});

test("a racking process answer rejects a recipe-page fetch and cites a selected process page", async () => {
  const fetchedUrls: string[] = [];
  let calls = 0;
  const toolCompletion = (
    id: string,
    name: string,
    argumentsObject: Record<string, unknown>,
  ) => ({
    id,
    model: "test-model",
    message: {
      role: "assistant" as const,
      content: null,
      tool_calls: [
        {
          id: `${id}-call`,
          type: "function" as const,
          function: { name, arguments: JSON.stringify(argumentsObject) },
        },
      ],
    },
    usage: {
      inputTokens: 10,
      outputTokens: 4,
      totalTokens: 14,
      cachedInputTokens: 0,
    },
  });
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        if (calls === 1) {
          return toolCompletion("racking-search", "search_wiki", {
            query: "rack my mead",
          });
        }
        if (calls === 2) {
          return toolCompletion("racking-recipe", "fetch_wiki_page", {
            url: "https://wiki.meadtools.com/en/recipes/beginner/0001",
          });
        }
        if (calls === 3) {
          return toolCompletion("racking-process", "fetch_wiki_page", {
            url: "https://wiki.meadtools.com/en/process/process_summary",
          });
        }
        return {
          id: "racking-answer",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "## Racking\n\n1. Use the batch state and gravity stability to decide whether to rack.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "What does the Modern Meadmaking Wiki say about when I should rack my mead?",
        },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
    wikiFetcher: async (url) => {
      fetchedUrls.push(url);
      return {
        ok: true,
        status: 200,
        url,
        headers: {
          get: (name) => (name === "content-type" ? "text/html" : null),
        },
        text: async () => "<main>Racking process guidance.</main>",
      };
    },
  });

  assert.deepEqual(fetchedUrls, [
    "https://wiki.meadtools.com/en/process/process_summary",
  ]);
  assert.equal(
    (result.toolResults[1]?.result as { status?: string } | undefined)?.status,
    "invalid_input",
  );
  assert.match(
    result.answer,
    /\[The Modern Meadmaking Wiki\]\(https:\/\/wiki\.meadtools\.com\/en\/process\/process_summary\)/,
  );
});

test("calculator-only brewing vocabulary stays inside the chatbot scope", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error(
          "The model should not be called for a calculator route.",
        );
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "How much priming sugar do I need for carbonation?",
        },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(result.usage.model, "deterministic-calculator-routing");
  assert.match(
    result.answer,
    /\[Priming sugar calculator\]\(\/extra-calcs\/priming-sugar\)/,
  );
});

test("completed drafts do not end with a conversational follow-up", () => {
  assert.equal(
    removeCompletedRecipeFollowUp(
      "## Blackberry Mead\n\nIngredients\n\n- Honey\n\nLet me know if you'd like to change the amounts.",
    ),
    "## Blackberry Mead\n\nIngredients\n\n- Honey",
  );
  assert.equal(
    removeCompletedRecipeFollowUp(
      "## Blueberry Mead\n\nThis is an unsaved draft. If you'd like to save it or adjust any details, let me know.",
    ),
    "## Blueberry Mead\n\nThis is an unsaved draft.",
  );
});

test("completed recipe answers render the same backsweetening ingredient returned for saving", () => {
  const workflow = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.999,
    backsweetening: { targetFinalGravity: 1.015 },
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    nutrients: nutrientPlan,
  });
  const answer = directRecipeToolAnswer("build_recipe_draft", {
    status: "ok",
    result: workflow,
  });

  assert.equal(workflow.status, "recipe");
  assert.match(answer ?? "", /Honey \(backsweetening\)/);
  assert.match(answer ?? "", /\*\*Backsweetened FG:\*\* 1\.015/);
  assert.doesNotMatch(answer ?? "", /Let me know if/);
});

test("completed secondary-fruit drafts explain MeadTools' unfermented-secondary convention", () => {
  const workflow = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.999,
    ingredients: [
      { name: "Honey", role: "adjustable_fermentable" },
      {
        name: "Raspberry",
        category: "fruit",
        brix: 8,
        secondary: true,
        amount: { kind: "weight", value: 3, unit: "lb" },
      },
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false },
  });
  const answer = directRecipeToolAnswer(
    "build_recipe_draft",
    {
      status: "ok",
      result: workflow,
    },
    { explainSecondaryFruitSweetness: true },
  );

  assert.equal(workflow.status, "recipe");
  assert.match(answer ?? "", /secondary as unfermented/i);
  assert.match(answer ?? "", /finished-gravity calculation/i);
  assert.doesNotMatch(answer ?? "", /without separate backsweetening honey/i);
});

test("completed recipe drafts render practical ingredient and additive amounts", () => {
  const workflow = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.999,
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    additives: [{ name: "Pectic Enzyme", amount: 0.4, unit: "tsp" }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false },
  });
  const answer = directRecipeToolAnswer("build_recipe_draft", {
    status: "ok",
    result: workflow,
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
    result: buildRecipeDraft({}),
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
                function: {
                  name: "search_wiki",
                  arguments: '{"query":"nutrient schedule"}',
                },
              },
            ],
          },
          usage: {
            inputTokens: 100,
            outputTokens: 10,
            totalTokens: 110,
            cachedInputTokens: 20,
          },
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
                  arguments:
                    '{"url":"https://wiki.meadtools.com/en/process/nutrient_schedules"}',
                },
              },
            ],
          },
          usage: {
            inputTokens: 200,
            outputTokens: 20,
            totalTokens: 220,
            cachedInputTokens: 50,
          },
        };
      }
      return {
        id: "request-3",
        model: "test-model",
        message: {
          role: "assistant",
          content: "🍯 Use the Nutrient Schedules wiki page. ⚠️",
        },
        usage: {
          inputTokens: 300,
          outputTokens: 30,
          totalTokens: 330,
          cachedInputTokens: 80,
        },
      };
    },
  };
  const events: string[] = [];

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "What nutrient schedule should I follow?" },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
    wikiFetcher,
    onEvent: (event) => {
      events.push(`${event.type}:${event.toolName}`);
    },
  });

  assert.match(result.answer, /^Use the Nutrient Schedules wiki page\./);
  assert.match(
    result.answer,
    /https:\/\/wiki\.meadtools\.com\/en\/process\/nutrient_schedules/,
  );
  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["search_wiki", "fetch_wiki_page"],
  );
  assert.deepEqual(events, [
    "tool_call:search_wiki",
    "tool_result:search_wiki",
    "tool_call:fetch_wiki_page",
    "tool_result:fetch_wiki_page",
  ]);
  assert.deepEqual(result.usage, {
    provider: "openai",
    model: "test-model",
    inputTokens: 600,
    outputTokens: 60,
    totalTokens: 660,
    cachedInputTokens: 150,
    requestIds: ["request-1", "request-2", "request-3"],
    toolCalls: 2,
    latencyMs: result.usage.latencyMs,
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
    stabilizers: { enabled: false },
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
              tool_calls: [
                {
                  id: "context-tool-1",
                  type: "function",
                  function: {
                    name: "get_selected_account_context",
                    arguments: "{}",
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "selected-context-answer",
          model: "test-model",
          message: {
            role: "assistant",
            content: "Your selected recipe is a one-gallon traditional.",
          },
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: {
      ...chatRequestSchema.parse({
        messages: [
          { role: "user", content: "What should I adjust in this recipe?" },
        ],
      }),
      selectedAccountContext: {
        kind: "recipe",
        label: "Recipe: Summer Traditional",
        recipe: {
          id: 42,
          name: "Summer Traditional",
          dataV2: draft.recipeData,
        },
      },
    },
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "get_selected_account_context" },
  });
  assert.equal(result.toolResults[0]?.toolName, "get_selected_account_context");
  assert.deepEqual(
    (result.toolResults[0]?.result as { result?: { kind?: string } })?.result,
    {
      kind: "recipe",
      label: "Recipe: Summer Traditional",
      recipe: { id: 42, name: "Summer Traditional", dataV2: draft.recipeData },
    },
  );
  assert.equal(requests[1]?.messages.at(-2)?.role, "tool");
  assert.match(result.answer, /selected recipe/);
});

test("a selected brew action stays an uncommitted target-bound proposal", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return {
            id: "brew-context-tool",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "brew-context-call",
                  type: "function",
                  function: {
                    name: "get_selected_account_context",
                    arguments: "{}",
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        if (requests.length === 2) {
          return {
            id: "brew-action-tool",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "brew-action-call",
                  type: "function",
                  function: {
                    name: "prepare_brew_action",
                    arguments: JSON.stringify({
                      type: "ADDITION",
                      data: {
                        kind: "OTHER",
                        name: "Vanilla bean",
                        amount: 1,
                        unit: "units",
                      },
                    }),
                  },
                },
              ],
            },
            usage: {
              inputTokens: 12,
              outputTokens: 4,
              totalTokens: 16,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "brew-action-answer",
          model: "test-model",
          message: {
            role: "assistant",
            content: "I prepared the addition for your review.",
          },
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: {
      ...chatRequestSchema.parse({
        messages: [
          { role: "user", content: "Log one vanilla bean in this batch." },
        ],
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
          recentEntries: [],
        },
      },
    },
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "get_selected_account_context" },
  });
  assert.equal(result.toolResults[1]?.toolName, "prepare_brew_action");
  const actionResult = result.toolResults[1]?.result as {
    status?: string;
    result?: { target?: { brewId?: string }; entry?: { type?: string } };
  };
  assert.equal(actionResult.status, "ok");
  assert.equal(
    actionResult.result?.target?.brewId,
    "11111111-1111-4111-8111-111111111111",
  );
  assert.equal(actionResult.result?.entry?.type, "ADDITION");
  assert.match(result.answer, /prepared the addition/i);
});

test("a selected recipe sweetness follow-up retrieves a MeadTools source", async () => {
  const draft = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.996,
    ingredients: [{ name: "Wildflower Honey", role: "adjustable_fermentable" }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false },
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
              tool_calls: [
                {
                  id: "context-tool-1",
                  type: "function",
                  function: {
                    name: "get_selected_account_context",
                    arguments: "{}",
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        if (requests.length === 2) {
          return {
            id: "sweetness-wiki-search",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "wiki-search-1",
                  type: "function",
                  function: {
                    name: "search_wiki",
                    arguments: '{"query":"backsweetening"}',
                  },
                },
              ],
            },
            usage: {
              inputTokens: 12,
              outputTokens: 4,
              totalTokens: 16,
              cachedInputTokens: 0,
            },
          };
        }
        if (requests.length === 3) {
          return {
            id: "sweetness-wiki-fetch",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "wiki-fetch-1",
                  type: "function",
                  function: {
                    name: "fetch_wiki_page",
                    arguments:
                      '{"url":"https://wiki.meadtools.com/en/faq/stabilization_and_backsweetening"}',
                  },
                },
              ],
            },
            usage: {
              inputTokens: 14,
              outputTokens: 4,
              totalTokens: 18,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "selected-context-answer",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "This recipe finishes dry, so stabilize it before backsweetening.",
          },
          usage: {
            inputTokens: 14,
            outputTokens: 8,
            totalTokens: 22,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: {
      ...chatRequestSchema.parse({
        messages: [
          {
            role: "user",
            content:
              "What should I adjust if I want this to finish a little sweeter?",
          },
        ],
      }),
      selectedAccountContext: {
        kind: "recipe",
        label: "Recipe: Summer Traditional",
        recipe: {
          id: 42,
          name: "Summer Traditional",
          dataV2: draft.recipeData,
        },
      },
    },
    maxOutputTokens: 500,
    maxToolCalls: 6,
    wikiFetcher,
  });

  assert.deepEqual(
    requests.map((request) => request.toolChoice),
    [
      { type: "function", function: { name: "get_selected_account_context" } },
      { type: "function", function: { name: "search_wiki" } },
      { type: "function", function: { name: "fetch_wiki_page" } },
      "auto",
    ],
  );
  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["get_selected_account_context", "search_wiki", "fetch_wiki_page"],
  );
  assert.match(
    result.answer,
    /Source: \[The Modern Meadmaking Wiki\]\(https:\/\/wiki\.meadtools\.com\//,
  );
});

test("a selected brew next-step follow-up retrieves a MeadTools source", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        const toolName =
          requests.length === 1
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
              tool_calls: [
                {
                  id: `next-step-tool-${requests.length}`,
                  type: "function",
                  function: {
                    name: toolName,
                    arguments:
                      toolName === "search_wiki"
                        ? '{"query":"fermentation"}'
                        : toolName === "fetch_wiki_page"
                          ? '{"url":"https://wiki.meadtools.com/en/process/fermentation"}'
                          : "{}",
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "next-step-answer",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "Continue monitoring gravity and fermentation temperature.",
          },
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: {
      ...chatRequestSchema.parse({
        messages: [
          { role: "user", content: "What should I do next with this batch?" },
        ],
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
          latestGravity: 1.0001,
          recipeName: null,
          recipeSnapshot: null,
          recentEntries: [
            {
              datetime: "2026-08-14T00:00:00.000Z",
              type: "GRAVITY",
              title: null,
              gravity: 1.0001,
              temperature: null,
              temperatureUnit: null,
              untrustedNote: null,
            },
          ],
        },
      },
    },
    maxOutputTokens: 500,
    maxToolCalls: 6,
    wikiFetcher,
  });

  assert.deepEqual(
    requests.slice(0, 3).map((request) => request.toolChoice),
    [
      { type: "function", function: { name: "get_selected_account_context" } },
      { type: "function", function: { name: "search_wiki" } },
      { type: "function", function: { name: "fetch_wiki_page" } },
    ],
  );
  assert.match(
    requests[1]?.messages.find(
      (message) =>
        message.role === "system" &&
        message.content.includes("concrete recorded state"),
    )?.content ?? "",
    /latest gravity 1\.0001/,
  );
  assert.match(
    requests[1]?.messages.find(
      (message) =>
        message.role === "system" &&
        message.content.includes(
          "actual stage, latest gravity, and relevant recent entries",
        ),
    )?.content ?? "",
    /actual stage, latest gravity, and relevant recent entries/,
  );
  assert.match(
    result.answer,
    /Source: \[The Modern Meadmaking Wiki\]\(https:\/\/wiki\.meadtools\.com\//,
  );
});

test("a selected account record does not bypass the off-topic scope gate", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error("The scope guard should not call the model.");
      },
    },
    userId: 7,
    request: {
      ...chatRequestSchema.parse({
        messages: [
          { role: "user", content: "What is Bitcoin trading at right now?" },
        ],
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
          recentEntries: [],
        },
      },
    },
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(
    result.answer,
    "I can help with MeadTools, mead recipes, and mead-brewing process questions. What would you like to make or troubleshoot?",
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
                function: {
                  name: "search_wiki",
                  arguments: '{"query":"nutrients"}',
                },
              },
            ],
          },
          usage: {
            inputTokens: 100,
            outputTokens: 10,
            totalTokens: 110,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "How should I handle a nutrient schedule?" },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
    maxProviderCalls: 2,
    maxTotalOutputTokens: 500,
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
        },
      },
      userId: 7,
      request: chatRequestSchema.parse({
        messages: [
          {
            role: "user",
            content: "How should I stabilize a traditional mead?",
          },
        ],
      }),
      maxOutputTokens: 500,
      maxToolCalls: 6,
      maxProviderInputCharacters: 20,
    }),
    /safe provider-context limit/,
  );
  assert.equal(called, false);
});

test("chat requests require the latest message to be from the user", () => {
  assert.equal(
    chatRequestSchema.safeParse({
      messages: [{ role: "assistant", content: "Hello" }],
    }).success,
    false,
  );
});

test("unrelated requests are refused before they reach the model", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      throw new Error("The scope guard should not call the model.");
    },
  };

  for (const content of [
    "What is the capital of France?",
    "Can you write my resignation letter?",
    "What is Bitcoin trading at right now?",
  ]) {
    const result = await runChatTurn({
      client,
      userId: 7,
      request: chatRequestSchema.parse({
        messages: [
          {
            role: "user",
            content: "How should I stabilize a traditional mead?",
          },
          {
            role: "assistant",
            content: "Take two stable hydrometer readings first.",
          },
          { role: "user", content },
        ],
      }),
      maxOutputTokens: 500,
      maxToolCalls: 6,
    });

    assert.equal(
      result.answer,
      "I can help with MeadTools, mead recipes, and mead-brewing process questions. What would you like to make or troubleshoot?",
    );
    assert.equal(result.usage.model, "deterministic-scope-check");
    assert.equal(result.usage.toolCalls, 0);
  }

  assert.equal(requests.length, 0);
});

test("an ambiguous getting-started opener reaches the conversational agent", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "getting-started",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "I can help you choose a simple first mead. Would you like a traditional or fruit mead?",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 12,
            totalTokens: 22,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "What do I need to get started?" }],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(result.usage.model, "test-model");
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.toolChoice, "auto");
  assert.match(result.answer, /traditional or fruit mead/i);
});

test("generic recipe exploration does not force catalog lookup or a draft", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "fruit-exploration",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "Fruit mead is a great direction. Do you want a berry-forward or stone-fruit profile?",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 12,
            totalTokens: 22,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Yes, let's make a mead recipe with fruit." },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.toolChoice, "auto");
  assert.match(result.answer, /berry-forward or stone-fruit/i);
});

test("a generic yeast recommendation is not treated as a missing named yeast", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "yeast-recommendation",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "For a sweet traditional, I would start by comparing a fruit-forward option with a more neutral one.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 14,
            totalTokens: 24,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I want it sweet and do not have a yeast in mind. What would you recommend?",
        },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.toolChoice, "auto");
  assert.doesNotMatch(result.answer, /could not match the requested yeast/i);
});

test("partial recipe context does not force another draft calculation", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "partial-context",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "Great—one gallon is a very approachable size. Do you have a fruit in mind, or would you like a few suggestions?",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 16,
            totalTokens: 26,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Let's make a fruit mead." },
        { role: "assistant", content: "What batch size sounds right?" },
        { role: "user", content: "One gallon." },
      ],
      recipeDraftInput: { batchVolume: { value: 1, unit: "gal" } },
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.toolChoice, "auto");
  assert.match(result.answer, /fruit in mind/i);
});

test("assistant capability questions use the deterministic product description", async () => {
  let called = false;
  const result = await runChatTurn({
    client: {
      async complete() {
        called = true;
        throw new Error("Capability questions should not reach the provider.");
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "What can you help with?" }],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(called, false);
  assert.equal(result.usage.model, "deterministic-capabilities");
  assert.match(result.answer, /build and refine MeadTools recipe drafts/i);
  assert.match(result.answer, /saved recipes or active brews/i);
});

test("conversational capability questions use the deterministic product description", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error("Capability questions should not reach the provider.");
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "What can you help me do?" }],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(result.usage.model, "deterministic-capabilities");
});

test("conversational gravity readings use the deterministic ABV calculator", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error("ABV calculations should not reach the provider.");
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "My mead went from 1.106 to 1.012. What ABV is that?",
        },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(result.usage.model, "deterministic-abv-calculation");
  assert.match(result.answer, /12\.507% ABV/);
  assert.match(result.answer, /\[ABV calculator\]\(\/extra-calcs\/abv\)/);
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
          message: {
            role: "assistant",
            content: "Ich helfe dir beim Stabilisieren deines Mets.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Wie stabilisiere ich mein Met?" }],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(result.answer, "Ich helfe dir beim Stabilisieren deines Mets.");
  assert.equal(requests.length, 1);
});

test("recipe-style traditional shorthand stays inside the chatbot scope", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "traditional-mead-shorthand",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "What batch size would you like for the avocado blossom traditional?",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 12,
            totalTokens: 22,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Lets make an avocado blossom traditional" },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(result.usage.model, "test-model");
  assert.equal(requests.length, 1);
  assert.match(result.answer, /avocado blossom traditional/i);
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
          message: {
            role: "assistant",
            content: "I will use the catalog match for the cyser draft.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Draft a cyser with apple cider and honey." },
        {
          role: "assistant",
          content: "I need to resolve the cider before drafting.",
        },
        {
          role: "user",
          content:
            "I think you have Apple Juice in the catalog; you can use that.",
        },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(
    result.answer,
    "I will use the catalog match for the cyser draft.",
  );
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
          message: {
            role: "assistant",
            content: "I will resolve the named yeast before drafting.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon cyser with Apple Juice, Lalvin D47, and Fermaid K.",
        },
        {
          role: "assistant",
          content: "I need to resolve the ingredient first.",
        },
        { role: "user", content: "Apple Juice is in the catalog; use that." },
      ],
      recipeDraftInput: {
        targetOriginalGravity: 1.075,
        fermentationFinalGravity: 1.01,
      },
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_yeasts" },
  });
});

test("an initial Lalvin 71B lookup seeds the draft with the catalog yeast details", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return {
            id: "lookup-71b",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "lookup-71b-tool",
                  type: "function",
                  function: {
                    name: "search_yeasts",
                    arguments: '{"query":"Lalvin 71B"}',
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        if (requests.length === 2) {
          return {
            id: "lookup-71b-ingredients",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "lookup-71b-ingredients-tool",
                  type: "function",
                  function: { name: "search_ingredients", arguments: "{}" },
                },
              ],
            },
            usage: {
              inputTokens: 12,
              outputTokens: 4,
              totalTokens: 16,
              cachedInputTokens: 0,
            },
          };
        }
        if (requests.length === 3) {
          return {
            id: "lookup-71b-build",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "lookup-71b-build-tool",
                  type: "function",
                  function: {
                    name: "build_recipe_draft",
                    arguments: JSON.stringify({
                      batchVolume: { value: 1, unit: "gal" },
                      targetOriginalGravity: 1.09,
                      fermentationFinalGravity: 0.999,
                      ingredients: [
                        { name: "Honey", role: "adjustable_fermentable" },
                      ],
                      nutrients: {
                        enabled: true,
                        schedule: "justK",
                        numberOfAdditions: 3,
                        goFermType: "Go-Ferm",
                      },
                      stabilizers: { enabled: false },
                    }),
                  },
                },
              ],
            },
            usage: {
              inputTokens: 14,
              outputTokens: 4,
              totalTokens: 18,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "lookup-71b-answer",
          model: "test-model",
          message: { role: "assistant", content: "Your draft is ready." },
          usage: {
            inputTokens: 12,
            outputTokens: 8,
            totalTokens: 20,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon traditional mead with Lalvin 71B, Fermaid K, Go-Ferm, target OG 1.090, and a dry finish.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B-1122",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 15,
        highTemperature: 30,
      },
    ],
    ingredientLookup: async () => [
      { id: 1, name: "Honey", category: "sugar", brix: 80 },
    ],
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_yeasts" },
  });
  assert.equal(result.recipeDraftInput?.nutrients?.yeastId, 71);
  assert.equal(result.recipeDraftInput?.nutrients?.yeastBrand, "Lalvin");
  assert.equal(result.recipeDraftInput?.nutrients?.yeastStrain, "71B-1122");
  assert.equal(result.recipeDraftInput?.nutrients?.nitrogenRequirement, "Low");
});

test("a broad provider yeast query is narrowed to the brewer-stated strain", async () => {
  let queriedYeast = "";
  const result = await runChatTurn({
    client: {
      async complete(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          return {
            id: "broad-yeast-query",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "broad-yeast-query-call",
                  type: "function",
                  function: {
                    name: "search_yeasts",
                    arguments: '{"query":"Lalvin"}',
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "broad-yeast-query-answer",
          model: "test-model",
          message: { role: "assistant", content: "The yeast is resolved." },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Draft a 1 gallon traditional mead with Lalvin 71B.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: {
          enabled: true,
          schedule: "tosna",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 2,
    yeastLookup: async (query) => {
      queriedYeast = query;
      return [
        {
          id: 71,
          brand: "Lalvin",
          name: "71B",
          nitrogenRequirement: "Low",
          tolerance: 14,
          lowTemperature: 15,
          highTemperature: 30,
        },
      ];
    },
  });

  assert.equal(queriedYeast, "Lalvin 71B");
  assert.equal(result.recipeDraftInput?.nutrients?.nitrogenRequirement, "Low");
});

test("a catalog correction keeps the earlier finished-volume intake", async () => {
  const result = await runChatTurn({
    client: {
      async complete(request) {
        if (request.messages.some((message) => message.role === "tool")) {
          return {
            id: "catalog-correction-render",
            model: "test-model",
            message: {
              role: "assistant",
              content: "I retained the finished batch volume.",
            },
            usage: {
              inputTokens: 10,
              outputTokens: 8,
              totalTokens: 18,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "catalog-correction-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
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
                        amount: { kind: "volume", value: 0.75, unit: "gal" },
                      },
                      {
                        name: "Wildflower Honey",
                        role: "adjustable_fermentable",
                      },
                    ],
                    nutrients: nutrientPlan,
                    stabilizers: { enabled: false },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon cyser with apple cider, 10% ABV, and Fermaid K.",
        },
        { role: "assistant", content: "I need to resolve the cider first." },
        { role: "user", content: "Apple Juice is in the catalog; use that." },
      ],
      recipeDraftInput: {
        targetOriginalGravity: 1.075,
        fermentationFinalGravity: 1.01,
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.deepEqual(result.recipeDraftInput?.batchVolume, {
    value: 1,
    unit: "gal",
  });
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
            answerType: "boolean",
          },
        ],
      },
    }),
    undefined,
  );

  const draft = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.996,
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false },
  });
  assert.equal(draft.status, "recipe");
  if (draft.status !== "recipe") return;

  const explanation = explainRecipe({
    activeRecipeData: draft.recipeData,
    topic: "abv",
  });
  const answer = directRecipeToolAnswer("explain_recipe", {
    status: "ok",
    result: explanation,
  });

  assert.match(
    answer ?? "",
    /The authoritative calculation engine derived ABV/,
  );
  assert.match(answer ?? "", /\*\*Alcohol by volume:\*\*/);
  assert.doesNotMatch(answer ?? "", /fermented out/i);

  assert.equal(
    directRecipeToolAnswer("calculate_gravity_target", {
      status: "ok",
      result: calculateGravityTarget({ targetAbv: 16, additionalOgPoints: 10 }),
    }),
    "What fermentation final gravity should MeadTools use for the target ABV calculation?",
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
          message: {
            role: "assistant",
            content: "What batch size would you like to make?",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
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
              function: {
                name: "build_recipe_draft",
                // The model may attempt to fabricate a target after an
                // earlier same-turn tool call established backsweetening
                // intent. Only the brewer can set this value.
                arguments: '{"backsweetening":{"targetFinalGravity":1.01}}',
              },
            },
          ],
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Help me build a blackberry mead recipe." },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.equal(requests[0]?.toolChoice, "auto");
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
            tool_calls: [
              {
                id: "tool-yeast",
                type: "function",
                function: {
                  name: "search_yeasts",
                  arguments: '{"query":"Premier Rouge"}',
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "yeast-follow-up",
        model: "test-model",
        message: {
          role: "assistant",
          content: "What final gravity should MeadTools use?",
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Premier Rouge yeast is fine." }],
      recipeDraftInput: {
        ingredients: [
          { name: "Blackberry", catalogId: 10, category: "fruit", brix: 7.86 },
        ],
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    yeastLookup: async () => [
      {
        id: 101,
        brand: "Red Star",
        name: "Premier Rouge (Pasteur Red)",
        nitrogenRequirement: "Medium",
        tolerance: 15,
        lowTemperature: 64,
        highTemperature: 86,
      },
    ],
  });

  assert.equal(result.answer, "What final gravity should MeadTools use?");
  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_yeasts" },
  });
  assert.ok(
    requests[1]?.messages.some(
      (message) =>
        message.role === "system" &&
        /Do not report catalog IDs/i.test(message.content),
    ),
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
          {
            name: "Blackberries",
            amount: { kind: "weight", value: 6, unit: "lb" },
          },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      }),
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
            amount: { kind: "weight", value: 6, unit: "lb" },
          },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      }),
    },
  ];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      const call = calls.shift();
      if (!call) {
        return {
          id: "final",
          model: "test-model",
          message: {
            role: "assistant",
            content: "Your unsaved blackberry draft is ready.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: `request-${requests.length}`,
        model: "test-model",
        message: {
          role: "assistant",
          content: call
            ? null
            : "What fruit amount and yeast would you prefer?",
          tool_calls: [
            { id: `tool-${requests.length}`, type: "function", function: call },
          ],
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Build a 3 gallon blackberry mead recipe." },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    ingredientLookup: async () => [
      { id: 42, name: "Blackberries", category: "fruit", brix: 10 },
      { id: 43, name: "Blueberries", category: "fruit", brix: 12 },
    ],
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /Blackberries/);
  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["build_recipe_draft", "search_ingredients", "build_recipe_draft"],
  );
  assert.equal(requests[2]?.toolChoice, "auto");
});

test("a gravity calculation continues into recipe drafting during recipe design", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const calls = [
    {
      name: "calculate_gravity_target",
      arguments: '{"targetAbv":16,"fermentationFinalGravity":1.03}',
    },
    { name: "build_recipe_draft", arguments: "{}" },
  ];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      const call = calls.shift();
      if (!call) {
        return {
          id: `request-${requests.length}`,
          model: "test-model",
          message: {
            role: "assistant",
            content: "What fruit amount and yeast would you prefer?",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: `request-${requests.length}`,
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: `tool-${requests.length}`, type: "function", function: call },
          ],
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Let's design a blackberry mead recipe." },
        { role: "assistant", content: "What target should we use?" },
        { role: "user", content: "1 gallon, 16% ABV, and 1.030." },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["calculate_gravity_target", "build_recipe_draft"],
  );
  assert.ok(
    requests[1]?.messages.some(
      (message) =>
        message.role === "system" &&
        /not the final answer/i.test(message.content),
    ),
  );
  assert.match(result.answer, /^To finish this draft/i);
  assert.match(result.answer, /fermentation final gravity/i);
});

test("partial recipe intake persists across turns instead of repeating answered questions", async () => {
  const firstClient: ChatModelClient = {
    async complete(request) {
      if (!request.tools) {
        return {
          id: "first-render",
          model: "test-model",
          message: {
            role: "assistant",
            content: "What fermentation final gravity should we plan for?",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
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
                  ingredients: [
                    { name: "Honey", role: "adjustable_fermentable" },
                  ],
                  nutrients: nutrientPlan,
                  stabilizers: { enabled: false },
                }),
              },
            },
          ],
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };
  const first = await runChatTurn({
    client: firstClient,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a five gallon mead recipe." },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
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
                  arguments: '{"fermentationFinalGravity":0.996}',
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "second-final",
        model: "test-model",
        message: { role: "assistant", content: "Your unsaved draft is ready." },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };
  const second = await runChatTurn({
    client: secondClient,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a five gallon mead recipe." },
        { role: "assistant", content: first.answer },
        {
          role: "user",
          content: "Use 0.996 as the fermentation final gravity.",
        },
      ],
      recipeDraftInput: first.recipeDraftInput,
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });
  assert.match(second.answer, /^## Unsaved MeadTools recipe draft/);
  assert.equal(second.recipeDraftInput?.batchVolume?.value, 5);
  assert.equal(second.recipeDraftInput?.fermentationFinalGravity, 0.996);
});

test("a recorded conversational recipe plan becomes a saved draft context after the brewer accepts it", async () => {
  let firstCalls = 0;
  const firstClient: ChatModelClient = {
    async complete() {
      firstCalls += 1;
      if (firstCalls === 1) {
        return {
          id: "record-plan",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "tool-record-plan",
                type: "function",
                function: {
                  name: "record_recipe_plan",
                  arguments: JSON.stringify({
                    plan: {
                      name: "Sweet Raspberry Mead",
                      style: "Fruit Mead",
                      batchVolume: { value: 1, unit: "gal" },
                      targetOriginalGravity: 1.1,
                      fermentationFinalGravity: 0.999,
                      backsweetening: { targetFinalGravity: 1.015 },
                      ingredients: [
                        { name: "Honey", role: "adjustable_fermentable" },
                        {
                          name: "Raspberry",
                          catalogId: 11,
                          category: "fruit",
                          brix: 8,
                          amount: { kind: "weight", value: 1.5, unit: "lb" },
                        },
                        {
                          name: "Raspberry",
                          catalogId: 11,
                          category: "fruit",
                          brix: 8,
                          secondary: true,
                          amount: { kind: "weight", value: 1.5, unit: "lb" },
                        },
                      ],
                      nutrients: {
                        enabled: true,
                        yeastBrand: "Lalvin",
                        yeastStrain: "D47",
                        nitrogenRequirement: "Low",
                        schedule: "tosna",
                        numberOfAdditions: 4,
                        goFermType: "Go-Ferm",
                      },
                      assumptions: [
                        "Use 3 lb of raspberry, split evenly between primary and secondary.",
                      ],
                    },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "record-plan-render",
        model: "test-model",
        message: {
          role: "assistant",
          content:
            "Raspberry is a good fit. How much raspberry would you like to use?",
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };
  const initialMessage =
    "Plan a 1 gallon raspberry mead with a target OG of 1.100, finishing dry and backsweeten to 1.015. Use D47 and TOSNA.";
  const first = await runChatTurn({
    client: firstClient,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: initialMessage }],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.deepEqual(
    first.toolResults.map((tool) => tool.toolName),
    ["record_recipe_plan"],
  );
  assert.equal(
    first.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Raspberry",
    ).length,
    2,
  );
  assert.deepEqual(
    first.recipeDraftInput?.ingredients
      .filter((ingredient) => ingredient.name === "Raspberry")
      .map((ingredient) => ingredient.amount),
    [
      { kind: "weight", value: 1.5, unit: "lb" },
      { kind: "weight", value: 1.5, unit: "lb" },
    ],
  );

  const secondClient: ChatModelClient = {
    async complete() {
      return {
        id: "build-recorded-plan",
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "tool-build-recorded-plan",
              type: "function",
              function: {
                name: "build_recipe_draft",
                arguments: "{}",
              },
            },
          ],
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };
  const second = await runChatTurn({
    client: secondClient,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: initialMessage },
        { role: "assistant", content: first.answer },
        {
          role: "user",
          content: "Yes, use the recommended defaults and make the draft.",
        },
      ],
      recipeDraftInput: first.recipeDraftInput,
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.deepEqual(
    second.toolResults.map((tool) => tool.toolName),
    ["build_recipe_draft"],
  );
  assert.match(second.answer, /^## Unsaved MeadTools recipe draft/);
  const raspberries =
    second.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Raspberry",
    ) ?? [];
  assert.deepEqual(
    raspberries.map((ingredient) => ingredient.amount),
    [
      { kind: "weight", value: 1.5, unit: "lb" },
      { kind: "weight", value: 1.5, unit: "lb" },
    ],
  );
});

test("an accepted retained plan uses the documented beginner gravity defaults and drafts immediately", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "accepted-plan-default-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "accepted-plan-build",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Help me make a one gallon medium-sweet traditional mead.",
        },
        {
          role: "assistant",
          content: "I recommend the retained beginner plan.",
        },
        {
          role: "user",
          content: "Yes, use the recommended defaults and make the draft now.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        backsweeteningIntent: true,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: {
          enabled: true,
          yeastBrand: "Lalvin",
          yeastStrain: "ICV D47",
          nitrogenRequirement: "Low",
          schedule: "tosna",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.equal(requests.length, 0);
  assert.equal(result.recipeDraftInput?.targetOriginalGravity, 1.09);
  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.015,
  );
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /medium-strength beginner default of 1\.090 OG/i);
});

test("an explicit default-draft request recovers when the provider missed plan recording", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "missed-plan-default-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "missed-plan-build",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: "{}",
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Help me make a one gallon sweet traditional mead.",
        },
        {
          role: "assistant",
          content: "I recommend 71B and TOSNA for this beginner batch.",
        },
        {
          role: "user",
          content:
            "Use all of your recommended defaults and make the recipe draft now.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 59,
        highTemperature: 86,
      },
    ],
  });

  assert.equal(requests.length, 0);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.equal(result.recipeDraftInput?.targetOriginalGravity, 1.09);
  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  assert.equal(result.recipeDraftInput?.nutrients?.yeastStrain, "71B");
  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.015,
  );
});

test("a delegated beginner traditional request drafts after explicit default acceptance", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error("Explicit acceptance should not reopen the plan.");
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I have never made mead before. I want a simple one-gallon medium-sweet traditional with whatever beginner-friendly yeast and honey you recommend. What should I plan for?",
        },
        {
          role: "assistant",
          content: "I recommend a beginner wildflower traditional plan.",
        },
        {
          role: "user",
          content:
            "Wildflower is fine. Use your recommended defaults and make the draft.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 59,
        highTemperature: 86,
      },
    ],
  });

  assert.equal(result.usage.model, "deterministic-accepted-plan-draft");
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.equal(result.recipeDraftInput?.batchVolume?.value, 1);
  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.015,
  );
  assert.equal(result.recipeDraftInput?.nutrients?.yeastStrain, "71B");
});

test("an accepted fruit plan recovers a catalog fruit and a stated split amount", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        throw new Error(
          "Accepted defaults should build without another provider response.",
        );
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Help me make a 4 L semi-sweet blueberry mead.",
        },
        {
          role: "assistant",
          content: "I recommend a blueberry melomel direction.",
        },
        {
          role: "user",
          content:
            "Use 500 g blueberry split, with reasonable defaults, and make the recipe draft.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    ingredientLookup: async () => [
      { id: 11, name: "Blueberry", category: "Fruit", brix: 7.86 },
    ],
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 59,
        highTemperature: 86,
      },
    ],
  });

  assert.equal(requests.length, 0);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.deepEqual(
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Blueberry",
    ),
    [
      {
        name: "Blueberry",
        catalogId: 11,
        category: "Fruit",
        brix: 7.86,
        amount: { kind: "weight", value: 250, unit: "g" },
      },
      {
        name: "Blueberry",
        catalogId: 11,
        category: "Fruit",
        brix: 7.86,
        amount: { kind: "weight", value: 250, unit: "g" },
        secondary: true,
      },
    ],
  );
});

test("explicit recipe choices survive a provider omission and stay stage-specific", async () => {
  const client: ChatModelClient = {
    async complete(request) {
      if (!request.tools) {
        return {
          id: "intake-hints-render",
          model: "test-model",
          message: {
            role: "assistant",
            content: "What yeast would you like to use?",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
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
              function: { name: "build_recipe_draft", arguments: "{}" },
            },
          ],
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a blackberry mead recipe." },
        {
          role: "assistant",
          content: "What finished batch volume should this recipe target?",
        },
        {
          role: "user",
          content:
            "I want to end dry and backsweeten, with fruit in both primary and secondary, around 5 gallons. Use Fermaid K only with Go-Ferm.",
        },
      ],
      recipeDraftInput: {
        ingredients: [
          { name: "Blackberry", catalogId: 10, category: "fruit", brix: 7.86 },
        ],
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
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
    [false, true],
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
      arguments: '{"targetAbv":16,"fermentationFinalGravity":1.03}',
    },
    { name: "search_yeasts", arguments: '{"query":"71B"}' },
    { name: "build_recipe_draft", arguments: "{}" },
  ];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      const call = calls.shift();
      if (!call) {
        return {
          id: "complete-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: "Your unsaved blackberry draft is ready.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: `request-${requests.length}`,
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: `tool-${requests.length}`, type: "function", function: call },
          ],
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a blueberry mead recipe." },
        {
          role: "assistant",
          content: "What should we use for the remaining recipe choices?",
        },
        {
          role: "user",
          content:
            "About 16%, use heavy blueberry with 71B, and I will not take a pH reading.",
        },
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
            brix: 7.86,
          },
          {
            name: "Blueberry",
            catalogId: 11,
            category: "fruit",
            brix: 7.86,
            secondary: true,
          },
        ],
        nutrients: {
          enabled: true,
          schedule: "justK",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: true, type: "kmeta" },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 59,
        highTemperature: 86,
      },
    ],
  });

  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["calculate_gravity_target", "search_yeasts", "build_recipe_draft"],
  );
  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  assert.equal(result.recipeDraftInput?.nutrients?.yeastStrain, "71B");
  assert.equal(result.recipeDraftInput?.nutrients?.nitrogenRequirement, "Low");
  assert.equal(result.recipeDraftInput?.stabilizers?.phReading, 3.5);
  assert.deepEqual(
    result.recipeDraftInput?.ingredients
      .filter((ingredient) => ingredient.name === "Blueberry")
      .map((ingredient) => ingredient.amount),
    [
      { kind: "weight", value: 10, unit: "lb" },
      { kind: "weight", value: 10, unit: "lb" },
    ],
  );
  assert.equal(
    result.recipeDraftInput?.assumptions?.some((assumption) =>
      /heavy fruit-load assumption of 4 lb per gallon/i.test(assumption),
    ) ?? false,
    true,
  );
  assert.ok(
    result.recipeDraftInput?.assumptions.includes(
      "The stabilizer calculation uses an assumed pH of 3.5 because no pH reading will be taken.",
    ),
  );
  assert.deepEqual(requests[1]?.toolChoice, {
    type: "function",
    function: { name: "search_yeasts" },
  });
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
});

test("a named fruit is looked up before yeast selection and draft construction", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const calls = [
    {
      name: "calculate_gravity_target",
      arguments: '{"targetAbv":16,"fermentationFinalGravity":0.999}',
    },
    { name: "search_ingredients", arguments: '{"query":"blackberry"}' },
    { name: "search_yeasts", arguments: '{"query":"71B"}' },
  ];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      const call = calls.shift();
      if (!call) {
        return {
          id: "complete",
          model: "test-model",
          message: {
            role: "assistant",
            content: "I have the details needed to begin the draft.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: `request-${requests.length}`,
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: `tool-${requests.length}`, type: "function", function: call },
          ],
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
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
            "Create a 5 gallon heavy blackberry mead at 16% ABV with Lalvin 71B.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    ingredientLookup: async () => [
      { id: 10, name: "Blackberry", category: "fruit", brix: 7.86 },
    ],
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 59,
        highTemperature: 86,
      },
    ],
  });

  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["calculate_gravity_target", "search_ingredients", "search_yeasts"],
  );
  assert.deepEqual(
    requests.slice(1).map((request) => request.toolChoice),
    [
      { type: "function", function: { name: "search_yeasts" } },
      "auto",
      "auto",
      { type: "function", function: { name: "build_recipe_draft" } },
    ],
  );
});

test("ingredient-selection requests search the catalog without forcing a recipe draft", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return {
            id: "tart-cherry-search",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "tart-cherry-search-call",
                  type: "function",
                  function: {
                    name: "search_ingredients",
                    arguments: '{"query":"tart cherries"}',
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "tart-cherry-answer",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "The Tart Cherry catalog entry is the best match. I have not calculated a recipe draft yet.",
          },
          usage: {
            inputTokens: 16,
            outputTokens: 8,
            totalTokens: 24,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I want to make a 3 gallon mead with tart cherries. Help me choose the best ingredient match before calculating anything.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    ingredientLookup: async () => [
      { id: 17, name: "Tart Cherry", category: "fruit", brix: 13 },
      { id: 18, name: "Cherry Juice", category: "juice", brix: 12 },
    ],
  });

  assert.deepEqual(
    requests.map((request) => request.toolChoice),
    [{ type: "function", function: { name: "search_ingredients" } }, "auto"],
  );
  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["search_ingredients"],
  );
  assert.match(result.answer, /Tart Cherry catalog entry/);
});

test("a qualitative fruit preference preserves a clearly labelled fruit assumption", async () => {
  const client: ChatModelClient = {
    async complete(request) {
      if (request.messages.some((message) => message.role === "tool")) {
        return {
          id: "complete-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: "Your unsaved blackberry draft is ready.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "draft",
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "build",
              type: "function",
              function: {
                name: "build_recipe_draft",
                arguments: JSON.stringify({
                  ingredients: [
                    {
                      name: "Blackberry",
                      amount: { kind: "weight", value: 7.5, unit: "lb" },
                    },
                    {
                      name: "Blackberry",
                      secondary: true,
                      amount: { kind: "weight", value: 7.5, unit: "lb" },
                    },
                  ],
                }),
              },
            },
          ],
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
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
            "Create a 5 gallon blackberry mead at 16% ABV with heavy fruit split evenly.",
        },
        { role: "assistant", content: "I have the recipe details so far." },
        {
          role: "user",
          content: "Please create the draft using those details.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.126,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey" },
          { name: "Blackberry", catalogId: 10, category: "fruit", brix: 7.86 },
          {
            name: "Blackberry",
            catalogId: 10,
            category: "fruit",
            brix: 7.86,
            secondary: true,
          },
        ],
        nutrients: {
          enabled: true,
          yeastId: 71,
          yeastBrand: "Lalvin",
          yeastStrain: "71B",
          nitrogenRequirement: "Low",
          schedule: "justK",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.equal(result.toolResults[0]?.toolName, "build_recipe_draft");
  assert.deepEqual(
    result.recipeDraftInput?.ingredients
      .filter((ingredient) => ingredient.name === "Blackberry")
      .map((ingredient) => ingredient.amount?.value),
    [10, 10],
  );
  assert.match(
    result.recipeDraftInput?.assumptions.join(" ") ?? "",
    /heavy fruit-load assumption of 4 lb per gallon/i,
  );
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
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
            tool_calls: [
              {
                id: "vanilla-build",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [{ name: "Vanilla bean", secondary: true }],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "vanilla-complete",
        model: "test-model",
        message: { role: "assistant", content: "Your vanilla draft is ready." },
        usage: {
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Use one whole vanilla bean in secondary." },
      ],
      recipeDraftInput: {
        batchVolume: { value: 3, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey" }],
        nutrients: {
          enabled: true,
          yeastBrand: "Lalvin",
          yeastStrain: "EC-1118",
          nitrogenRequirement: "Low",
          schedule: "justK",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.deepEqual(
    result.recipeDraftInput?.additives.find(
      (additive) => additive.name === "Vanilla bean",
    ),
    { name: "Vanilla bean", amount: 1, unit: "units", secondary: true },
  );
});

test("a count of lemon zests is retained as an additive instead of becoming a missing amount", async () => {
  const client: ChatModelClient = {
    async complete(request) {
      if (!request.messages.some((message) => message.role === "tool")) {
        return {
          id: "lemon-zest-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "lemon-zest-build",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [{ name: "Lemon zest", secondary: true }],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "lemon-zest-complete",
        model: "test-model",
        message: {
          role: "assistant",
          content: "Your lemon-mead draft is ready.",
        },
        usage: {
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a lemon mead recipe." },
        { role: "assistant", content: "What additions should it include?" },
        { role: "user", content: "Use 15 lemon zests in secondary." },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.deepEqual(
    result.recipeDraftInput?.additives.find(
      (additive) => additive.name === "Lemon zest",
    ),
    { name: "Lemon zest", amount: 15, unit: "units", secondary: true },
  );
});

test("a generic catalog spice preserves a brewer's countable form", async () => {
  const result = await runChatTurn({
    client: {
      async complete(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          return {
            id: "cinnamon-build",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "cinnamon-build-call",
                  type: "function",
                  function: {
                    name: "build_recipe_draft",
                    arguments: JSON.stringify({
                      additives: [
                        {
                          name: "Cinnamon",
                          amount: 2,
                          unit: "oz",
                          secondary: true,
                        },
                      ],
                    }),
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "cinnamon-complete",
          model: "test-model",
          message: {
            role: "assistant",
            content: "Your cinnamon draft is ready.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a one gallon mead with two cinnamon sticks in secondary.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 4,
    additiveLookup: async () => [
      { id: "cinnamon", name: "Cinnamon", dosagePerGallon: 1, unit: "oz" },
    ],
  });

  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Cinnamon", amount: 2, unit: "units", secondary: true },
  ]);
});

test("omitted culinary additions remain additives with their user-supplied units", async () => {
  const result = await runChatTurn({
    client: {
      async complete(request) {
        if (!request.messages.some((message) => message.role === "tool")) {
          return {
            id: "omitted-culinary-additives",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "omitted-culinary-additives-build",
                  type: "function",
                  function: { name: "build_recipe_draft", arguments: "{}" },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "omitted-culinary-additives-answer",
          model: "test-model",
          message: {
            role: "assistant",
            content: "I need the black tea amount.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 5 gallon spiced mead with 2 cloves, 3 cinnamon sticks, 1 star anise, and black tea.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 2,
    additiveLookup: async () => [],
  });

  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Cloves", amount: 2, unit: "units" },
    { name: "Cinnamon Stick", amount: 3, unit: "units" },
    { name: "Star Anise", amount: 1, unit: "units" },
    { name: "Black Tea", unit: undefined },
  ]);
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
          tool_calls: [
            {
              id: "duplicate-additive-build",
              type: "function",
              function: {
                name: "build_recipe_draft",
                arguments: JSON.stringify({
                  additives: [
                    {
                      name: "Vanilla",
                      amount: 1,
                      unit: "units",
                      secondary: true,
                    },
                    { name: "Vanilla Bean", amount: 1, unit: "bean" },
                  ],
                }),
              },
            },
          ],
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Use one vanilla bean in secondary." },
      ],
      recipeDraftInput: {
        batchVolume: { value: 3, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey" }],
        nutrients: {
          enabled: true,
          yeastBrand: "Lalvin",
          yeastStrain: "EC-1118",
          nitrogenRequirement: "Low",
          schedule: "justK",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Vanilla Bean", amount: 1, unit: "units", secondary: true },
  ]);
});

test("an explicit bean count overrides a catalog ounce default", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        if (calls === 1) {
          return {
            id: "vanilla-catalog-search",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "vanilla-catalog-search-call",
                  type: "function",
                  function: { name: "search_additives", arguments: "{}" },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "vanilla-catalog-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "vanilla-catalog-build-call",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    additives: [
                      { name: "Vanilla Bean", amount: 1, unit: "oz" },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a one gallon mead with one vanilla bean in secondary.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 3,
    additiveLookup: async () => [
      {
        id: "vanilla",
        name: "Vanilla",
        dosagePerGallon: 1,
        unit: "oz",
      },
    ],
  });

  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Vanilla", amount: 1, unit: "units", secondary: true },
  ]);
});

test("an explicit bean count overrides a model-provided ounce unit", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "vanilla-model-ounce",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "vanilla-model-ounce-build",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    additives: [
                      { name: "Vanilla Bean", amount: 1, unit: "oz" },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a one gallon mead with one vanilla bean in secondary.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Vanilla Bean", amount: 1, unit: "units", secondary: true },
  ]);
});

test("user-supplied vanilla variants retain their distinct weights and stage", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "descriptive-vanilla-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "descriptive-vanilla-build-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    additives: [{ name: "Vanilla Bean" }],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a one gallon mead with 3 oz Madagascar vanilla and 2.5 oz Mexican vanilla in secondary.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Madagascar Vanilla", amount: 3, unit: "oz", secondary: true },
    { name: "Mexican Vanilla", amount: 2.5, unit: "oz", secondary: true },
  ]);
});

test("a plural catalog spice name preserves a brewer's stick count", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        return {
          id: `cinnamon-${calls}`,
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: `cinnamon-tool-${calls}`,
                type: "function",
                function:
                  calls === 1
                    ? { name: "search_additives", arguments: "{}" }
                    : {
                        name: "build_recipe_draft",
                        arguments: JSON.stringify({
                          additives: [
                            { name: "Cinnamon Sticks", amount: 2, unit: "oz" },
                          ],
                        }),
                      },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a one gallon mead with two cinnamon sticks in secondary.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 3,
    additiveLookup: async () => [
      {
        id: "cinnamon",
        name: "Cinnamon Sticks",
        dosagePerGallon: 1,
        unit: "oz",
      },
    ],
  });

  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Cinnamon Sticks", amount: 2, unit: "units", secondary: true },
  ]);
});

test("unquantified honey labels collapse to one clean adjustable varietal", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "duplicate-honey-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "duplicate-honey-build-call",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    batchVolume: { value: 1, unit: "gal" },
                    targetOriginalGravity: 1.09,
                    fermentationFinalGravity: 0.999,
                    ingredients: [
                      {
                        name: "ABV Wildflower Honey",
                        amount: { kind: "weight", value: 1, unit: "lb" },
                      },
                      {
                        name: "Enough Wildflower Honey",
                        role: "adjustable_fermentable",
                      },
                    ],
                    nutrients: nutrientPlan,
                    stabilizers: { enabled: false },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a one gallon peach mead at 11% ABV with enough wildflower honey to hit the target.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.deepEqual(
    result.recipeDraftInput?.ingredients.filter((ingredient) =>
      /honey/i.test(ingredient.name),
    ),
    [{ name: "Wildflower Honey", role: "adjustable_fermentable" }],
  );
});

test("a complete named catalog additive is still checked against the additive catalog", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const toolCompletion = (
    name: string,
    argumentsObject: Record<string, unknown>,
  ) => ({
    id: `complete-additive-${name}-${requests.length}`,
    model: "test-model",
    message: {
      role: "assistant" as const,
      content: null,
      tool_calls: [
        {
          id: `complete-additive-call-${requests.length}`,
          type: "function" as const,
          function: { name, arguments: JSON.stringify(argumentsObject) },
        },
      ],
    },
    usage: {
      inputTokens: 10,
      outputTokens: 4,
      totalTokens: 14,
      cachedInputTokens: 0,
    },
  });
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        assert.deepEqual(request.toolChoice, {
          type: "function",
          function: { name: "search_additives" },
        });
        return toolCompletion("search_additives", {});
      }
      assert.equal(request.toolChoice, "auto");
      return toolCompletion("build_recipe_draft", {
        additives: [{ name: "Bentonite", amount: 1, unit: "g" }],
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
          content: "Create a traditional mead and include Bentonite.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.1,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 500,
    maxToolCalls: 5,
    additiveLookup: async () => [
      { id: "bentonite", name: "Bentonite", dosagePerGallon: 6, unit: "g" },
    ],
  });

  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["search_additives", "build_recipe_draft"],
  );
  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Bentonite", amount: 6, unit: "g" },
  ]);
});

test("a catalog additive without a supplied unit is resolved before drafting", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const toolCompletion = (
    name: string,
    argumentsObject: Record<string, unknown>,
  ) => ({
    id: `additive-${name}`,
    model: "test-model",
    message: {
      role: "assistant" as const,
      content: null,
      tool_calls: [
        {
          id: `call-${name}-${requests.length}`,
          type: "function" as const,
          function: { name, arguments: JSON.stringify(argumentsObject) },
        },
      ],
    },
    usage: {
      inputTokens: 10,
      outputTokens: 4,
      totalTokens: 14,
      cachedInputTokens: 0,
    },
  });
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        assert.deepEqual(request.toolChoice, {
          type: "function",
          function: { name: "search_additives" },
        });
        return toolCompletion("search_additives", {});
      }
      assert.equal(request.toolChoice, "auto");
      return toolCompletion("build_recipe_draft", {
        additives: [{ name: "Bentonite" }],
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
          content: "Create a traditional mead and include Bentonite.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.1,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 500,
    maxToolCalls: 5,
    additiveLookup: async () => [
      { id: "bentonite", name: "Bentonite", dosagePerGallon: 6, unit: "g" },
    ],
  });

  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["search_additives", "build_recipe_draft"],
  );
  assert.equal(result.recipeDraftInput?.additives[0]?.unit, "g");
  assert.equal(result.recipeDraftInput?.additives[0]?.amount, 6);
  assert.match(result.answer, /\| Bentonite \| 6 g \|/);
});

test("a brewer-supplied catalog additive amount is not overwritten by its default dose", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        return calls === 1
          ? {
              id: "supplied-additive-search",
              model: "test-model",
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "supplied-additive-search-call",
                    type: "function",
                    function: { name: "search_additives", arguments: "{}" },
                  },
                ],
              },
              usage: {
                inputTokens: 10,
                outputTokens: 4,
                totalTokens: 14,
                cachedInputTokens: 0,
              },
            }
          : {
              id: "supplied-additive-draft",
              model: "test-model",
              message: {
                role: "assistant",
                content: null,
                tool_calls: [
                  {
                    id: "supplied-additive-draft-call",
                    type: "function",
                    function: {
                      name: "build_recipe_draft",
                      arguments: JSON.stringify({
                        additives: [
                          { name: "Estate Tannin", amount: 5, unit: "g" },
                        ],
                      }),
                    },
                  },
                ],
              },
              usage: {
                inputTokens: 10,
                outputTokens: 4,
                totalTokens: 14,
                cachedInputTokens: 0,
              },
            };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Create a 1 gallon mead with 5 g Estate Tannin.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.1,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 500,
    maxToolCalls: 3,
    additiveLookup: async () => [
      {
        id: "estate-tannin",
        name: "Estate Tannin",
        dosagePerGallon: 1.9,
        unit: "g",
      },
    ],
  });

  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Estate Tannin", amount: 5, unit: "g" },
  ]);
});

test("a fixed-fermentable draft request is routed to the shared recipe workflow", async () => {
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
            content:
              "I will use MeadTools to evaluate those fixed fermentables before drafting.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon cyser with 1 gallon fresh apple cider and 3 lb of wildflower honey. I want it around 10% ABV, finishing at 1.010. Use Lalvin D47, Fermaid K and Go-Ferm with two additions. I do not plan to backsweeten or stabilize.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.match(result.answer, /^To finish this draft/i);
  assert.match(result.answer, /Nutrient planning is required/i);
  assert.equal(result.usage.model, "test-model");
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "build_recipe_draft" },
  });
  assert.match(
    String(requests[1]?.messages.at(-1)?.content),
    /must now call build_recipe_draft/i,
  );
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
            tool_calls: [
              {
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
                        amount: { kind: "volume", value: 0.75, unit: "gal" },
                      },
                      {
                        name: "Wildflower Honey",
                        role: "adjustable_fermentable",
                      },
                    ],
                    stabilizers: { enabled: true, type: "kmeta" },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon cyser with 1 gallon of apple juice and 3 lb of wildflower honey at 10% ABV.",
        },
        {
          role: "assistant",
          content: "The fixed ingredients need adjustment to meet that target.",
        },
        {
          role: "user",
          content:
            "I do not plan on using sulfite at all and I am not measuring pH. We can reduce the honey to meet the targets.",
        },
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
            amount: { kind: "volume", value: 1, unit: "gal" },
          },
          {
            name: "Wildflower Honey",
            amount: { kind: "weight", value: 3, unit: "lb" },
          },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: true, type: "kmeta" },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.equal(result.recipeDraftInput?.stabilizers?.enabled, false);
  assert.deepEqual(
    result.recipeDraftInput?.ingredients.find(
      (ingredient) => ingredient.name === "Apple Juice",
    )?.amount,
    { kind: "volume", value: 1, unit: "gal" },
  );
  const honey = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Wildflower Honey",
  );
  assert.equal(honey?.role, "adjustable_fermentable");
  assert.equal(honey?.amount, undefined);
  assert.match(result.answer, /fixed (?:primary )?ingredients?.*Apple Juice/i);
  assert.match(result.answer, /larger batch/i);
});

test("catalog reconciliation maps apple cider without overwriting the distinct honey fermentable", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        const name =
          calls === 1
            ? "build_recipe_draft"
            : calls === 2
              ? "search_ingredients"
              : "build_recipe_draft";
        return {
          id: `cyser-catalog-${calls}`,
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: `cyser-catalog-tool-${calls}`,
                type: "function",
                function: { name, arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon cyser with 1 gallon fresh apple cider and 3 lb wildflower honey at 10% ABV, finishing at 1.010. I will not backsweeten or stabilize.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.075,
        fermentationFinalGravity: 1.01,
        ingredients: [
          {
            name: "Apple Cider",
            amount: { kind: "volume", value: 1, unit: "gal" },
          },
          {
            name: "Wildflower Honey",
            amount: { kind: "weight", value: 3, unit: "lb" },
          },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    ingredientLookup: async () => [
      { id: 12, name: "Apple Juice", category: "juice", brix: 11 },
      { id: 13, name: "Wildflower Honey", category: "honey", brix: 81 },
    ],
  });

  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["build_recipe_draft", "search_ingredients", "build_recipe_draft"],
  );
  assert.deepEqual(
    result.recipeDraftInput?.ingredients.map((ingredient) => ingredient.name),
    ["Apple Juice", "Wildflower Honey"],
  );
  assert.match(result.answer, /fixed (?:primary )?ingredients?.*Apple Juice/i);
  assert.match(result.answer, /Wildflower Honey/i);
});

test("an explicit honey confirmation overrides a stale inferred honey amount", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "confirmed-honey-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "confirmed-honey-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Create a one gallon sweet traditional mead at 14% ABV.",
        },
        {
          role: "assistant",
          content: "Which single fermentable should MeadTools adjust?",
        },
        {
          role: "user",
          content:
            "Honey will be the single fermentable, then adjust the water.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.12,
        fermentationFinalGravity: 0.999,
        // This was suggested by an earlier model response, not supplied by
        // the brewer. The later confirmation must make it adjustable.
        ingredients: [
          {
            name: "Wildflower Honey",
            amount: { kind: "weight", value: 3, unit: "lb" },
          },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  const honey = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Wildflower Honey",
  );
  assert.equal(honey?.role, "adjustable_fermentable");
  assert.equal(honey?.amount, undefined);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.equal(requests.length, 1);
});

test("a medium-sweet beginner request is handled by the conversational agent", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const yeastQueries: string[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return {
            id: "medium-sweet-yeast-search",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "medium-sweet-yeast-search-tool",
                  type: "function",
                  function: {
                    name: "search_yeasts",
                    arguments: JSON.stringify({ query: "D47" }),
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "medium-sweet-exploration",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "A medium-sweet traditional is a good starting point. Do you want a one-gallon batch or something larger?",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 14,
            totalTokens: 24,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I want a 2 gallon traditional mead that finishes medium-sweet. Pick a sensible yeast and nutrient plan for me.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    yeastLookup: async (query) => {
      yeastQueries.push(query);
      return [
        {
          id: 71,
          brand: "Lalvin",
          name: "71B-1122",
          nitrogenRequirement: "Low",
          tolerance: 14,
          lowTemperature: 15,
          highTemperature: 30,
        },
      ];
    },
  });

  assert.equal(result.usage.model, "test-model");
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_yeasts" },
  });
  assert.deepEqual(yeastQueries, ["71B"]);
  assert.equal(result.recipeDraftInput?.nutrients?.yeastStrain, "71B-1122");
  assert.match(result.answer, /medium-sweet traditional/i);
});

test("a beginner recommendation retains the catalog yeast in the proposed plan", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const yeastQueries: string[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return {
            id: "beginner-yeast-search",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "beginner-yeast-search-tool",
                  type: "function",
                  // The service must override a broad or incorrect model query.
                  function: {
                    name: "search_yeasts",
                    arguments: JSON.stringify({ query: "US-05" }),
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        if (requests.length === 2) {
          return {
            id: "beginner-record-plan",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "beginner-record-plan-tool",
                  type: "function",
                  function: {
                    name: "record_recipe_plan",
                    arguments: JSON.stringify({
                      plan: {
                        batchVolume: { value: 1, unit: "gal" },
                        ingredients: [
                          { name: "Honey", role: "adjustable_fermentable" },
                        ],
                        nutrients: {
                          ...nutrientPlan,
                          yeastBrand: "Lalvin",
                          yeastStrain: "71B-1122",
                          nitrogenRequirement: "Low",
                        },
                        assumptions: [
                          "A one-gallon medium-sweet traditional is a sensible first batch.",
                        ],
                      },
                    }),
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "beginner-plan-answer",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "I recommend Lalvin 71B for this approachable traditional. Want me to make the draft with those defaults?",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 10,
            totalTokens: 20,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I am a beginner. Help me make my first one gallon medium-sweet traditional mead and recommend everything.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    yeastLookup: async (query) => {
      yeastQueries.push(query);
      return [
        {
          id: 71,
          brand: "Lalvin",
          name: "71B-1122",
          nitrogenRequirement: "Low",
          tolerance: 14,
          lowTemperature: 15,
          highTemperature: 30,
        },
      ];
    },
  });

  assert.deepEqual(
    requests.map((request) => request.toolChoice),
    [{ type: "function", function: { name: "search_yeasts" } }],
  );
  assert.deepEqual(yeastQueries, ["71B"]);
  assert.equal(result.recipeDraftInput?.nutrients?.yeastId, 71);
  assert.equal(result.recipeDraftInput?.nutrients?.yeastStrain, "71B-1122");
  assert.equal(result.recipeDraftInput?.nutrients?.numberOfAdditions, 3);
  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["search_yeasts", "record_recipe_plan"],
  );
  assert.match(result.answer, /Lalvin 71B-1122/i);
  assert.match(result.answer, /The assumptions I would use are:/i);
  assert.match(result.answer, /medium-strength beginner default of 1\.090 OG/i);
  assert.match(result.answer, /3-addition TOSNA plan/i);
  assert.doesNotMatch(result.answer, /SafAle|DAP|Fermaid O/i);
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
            tool_calls: [
              {
                id: "invalid-build-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments:
                    '{"nutrients":{"enabled":true,"schedule":"not-a-real-schedule"}}',
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "completed-draft",
        model: "test-model",
        message: {
          role: "assistant",
          content: "Your unsaved blackberry draft is ready.",
        },
        usage: {
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
          cachedInputTokens: 0,
        },
      };
    },
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
          content:
            "Use heavy blackberry, around 5 gallons, target 16%, Lalvin 71B, and no pH reading.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.119,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey" },
          { name: "Blackberry", catalogId: 10, category: "fruit", brix: 7.86 },
          {
            name: "Blackberry",
            catalogId: 10,
            category: "fruit",
            brix: 7.86,
            secondary: true,
          },
        ],
        nutrients: {
          enabled: true,
          yeastId: 71,
          yeastBrand: "Lalvin",
          yeastStrain: "71B",
          nitrogenRequirement: "Low",
          schedule: "justK",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: true, type: "kmeta" },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.equal(result.recipeDraftInput?.targetOriginalGravity, 1.119);
  assert.equal(result.recipeDraftInput?.stabilizers?.phReading, 3.5);
  assert.deepEqual(
    result.recipeDraftInput?.ingredients
      .filter((ingredient) => ingredient.name === "Blackberry")
      .map((ingredient) => ingredient.amount?.value),
    [10, 10],
  );
  assert.equal(result.toolResults[0]?.toolName, "build_recipe_draft");
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
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
            tool_calls: [
              {
                id: "invented-honey-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [
                      {
                        name: "Honey",
                        amount: { kind: "weight", value: 12, unit: "lb" },
                      },
                      {
                        name: "Blackberry",
                        catalogId: 10,
                        category: "fruit",
                        brix: 7.86,
                        amount: { kind: "weight", value: 5, unit: "lb" },
                      },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "invented-honey-final",
        model: "test-model",
        message: {
          role: "assistant",
          content: "Your unsaved blackberry draft is ready.",
        },
        usage: {
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Create a 5 gallon blackberry mead recipe at 16% ABV.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.118,
        fermentationFinalGravity: 0.999,
        ingredients: [],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  const honey = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Honey",
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
            tool_calls: [
              {
                id: "traditional-build",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  // Simulates the bad completion from the evaluator: it treats
                  // the post-backsweetening FG as the fermentation FG and drops
                  // the implied primary honey.
                  arguments: JSON.stringify({
                    fermentationFinalGravity: 1.015,
                    ingredients: [],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "traditional-render",
        model: "test-model",
        message: {
          role: "assistant",
          content: "Your unsaved traditional mead draft is ready.",
        },
        usage: {
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
          cachedInputTokens: 0,
        },
      };
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
            "Create a 1 gallon sweet traditional mead at about 14% ABV with TOSNA and Lalvin 71B.",
        },
        {
          role: "assistant",
          content:
            "I can make that as a dry-fermented, stabilized, backsweetened draft.",
        },
        {
          role: "user",
          content:
            "Yes, stabilize and backsweeten to 1.015. Use three nutrient additions, standard Go-Ferm, and the default pH.",
        },
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
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["build_recipe_draft"],
  );
  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  assert.deepEqual(
    result.recipeDraftInput?.ingredients.find(
      (ingredient) => ingredient.name === "Honey",
    ),
    { name: "Honey", role: "adjustable_fermentable" },
  );
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /Honey \(backsweetening\)/);
  assert.equal(requests.length, 1);
});

test("a direct medium-sweet fruit draft keeps its stated finished gravity and uses a labelled medium fruit assumption", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        if (calls === 1) {
          return {
            id: "raspberry-direct-build",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "raspberry-direct-build-tool",
                  type: "function",
                  function: { name: "build_recipe_draft", arguments: "{}" },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "raspberry-direct-render",
          model: "test-model",
          message: {
            role: "assistant",
            content: "Your raspberry recipe draft is ready.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 10 L raspberry mead recipe, medium-sweet at 1.012 by backsweetening.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 10, unit: "L" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          { name: "Raspberry", catalogId: 11, category: "fruit", brix: 8 },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.012,
  );
  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  const raspberryAmount = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Raspberry",
  )?.amount;
  assert.equal(raspberryAmount?.kind, "weight");
  assert.equal(raspberryAmount?.unit, "kg");
  assert.ok(raspberryAmount && Math.abs(raspberryAmount.value - 3.595) < 0.001);
  assert.ok(
    result.recipeDraftInput?.assumptions?.some((assumption) =>
      /medium fruit-load assumption/i.test(assumption),
    ),
  );
});

test("a fully specified draft request continues from the catalog yeast into the shared workflow", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const result = await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        if (requests.length === 1) {
          return {
            id: "orange-blossom-yeast",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "orange-blossom-yeast-tool",
                  type: "function",
                  function: {
                    name: "search_yeasts",
                    arguments: JSON.stringify({ query: "71B" }),
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "orange-blossom-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "orange-blossom-build-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 2 gallon dry traditional with 6 lb of orange blossom honey, Lalvin 71B, Go-Ferm, and Fermaid K in three additions. Target 1.092 OG and do not stabilize or backsweeten.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 2, unit: "gal" },
        targetOriginalGravity: 1.092,
        fermentationFinalGravity: 0.999,
        ingredients: [
          {
            name: "Orange Blossom Honey",
            amount: { kind: "weight", value: 6, unit: "lb" },
          },
        ],
        nutrients: {
          enabled: true,
          schedule: "justK",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B-1122",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 15,
        highTemperature: 30,
      },
    ],
  });

  assert.deepEqual(
    requests.map((request) => request.toolChoice),
    [
      { type: "function", function: { name: "search_yeasts" } },
      { type: "function", function: { name: "build_recipe_draft" } },
    ],
  );
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /Orange Blossom Honey \| 6 lb/);
});

test("an explicit plural fruit quantity overrides an earlier assumed amount", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "raspberry-quantity-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "raspberry-quantity-build-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 3 gallon raspberry mead at 12% ABV with EC-1118, Fermaid K, Go-Ferm, and three nutrient additions.",
        },
        {
          role: "assistant",
          content:
            "I can use a medium fruit load unless you have a quantity in mind.",
        },
        {
          role: "user",
          content:
            "Use 6 lb of raspberries in secondary and do not backsweeten.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 3, unit: "gal" },
        targetOriginalGravity: 1.092,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          {
            name: "Raspberry",
            catalogId: 11,
            category: "fruit",
            brix: 8,
            secondary: true,
            amount: { kind: "weight", value: 9, unit: "lb" },
          },
        ],
        nutrients: {
          enabled: true,
          yeastId: 1,
          yeastBrand: "Lalvin",
          yeastStrain: "EC-1118",
          nitrogenRequirement: "Low",
          schedule: "justK",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  const raspberry = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Raspberry",
  );
  assert.deepEqual(raspberry?.amount, { kind: "weight", value: 6, unit: "lb" });
  assert.match(result.answer, /Raspberry \| 6 lb \| Secondary/);
});

test("a distinctive named yeast resolves without requiring its manufacturer", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "belle-saison-search",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "belle-saison-search-tool",
                type: "function",
                function: {
                  name: "search_yeasts",
                  arguments: JSON.stringify({ query: "Belle Saison" }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Help me plan a 5 gallon cyser with Belle Saison.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        ingredients: [{ name: "Honey" }],
        nutrients: {
          enabled: true,
          schedule: "tosna",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 2,
    yeastLookup: async () => [
      {
        id: 99,
        brand: "Lallemand",
        name: "Belle Saison",
        nitrogenRequirement: "Medium",
        tolerance: 15,
        lowTemperature: 18,
        highTemperature: 30,
      },
    ],
  });

  assert.equal(result.recipeDraftInput?.nutrients?.yeastId, 99);
  assert.equal(result.recipeDraftInput?.nutrients?.yeastBrand, "Lallemand");
  assert.equal(result.recipeDraftInput?.nutrients?.yeastStrain, "Belle Saison");
});

test("a new recipe request with an unknown syrup asks for its sugar data before a provider call", async () => {
  let providerCalls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        providerCalls += 1;
        throw new Error(
          "The provider should not be called before the syrup data is known.",
        );
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 1.25 gallon pear cyser with pear juice and 2 lb honey in primary, plus 8 oz honey and pear syrup in secondary. I do not know the syrup's sugar content.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.equal(providerCalls, 0);
  assert.match(
    result.answer,
    /product label or a measured sugar reading for pear syrup/i,
  );
  assert.doesNotMatch(result.answer, /honey plus pear syrup/i);
  assert.equal(result.usage.model, "deterministic-ingredient-intake");
});

test("an ICV D47 name uses the catalog's canonical D47 lookup", async () => {
  const yeastQueries: string[] = [];
  let providerCalls = 0;
  await runChatTurn({
    client: {
      async complete() {
        providerCalls += 1;
        if (providerCalls === 1) {
          return {
            id: "icv-d47-search",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "icv-d47-search-tool",
                  type: "function",
                  function: {
                    name: "search_yeasts",
                    arguments: JSON.stringify({ query: "Lalvin ICV D47" }),
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "icv-d47-answer",
          model: "test-model",
          message: {
            role: "assistant",
            content: "The selected yeast is ready for the draft.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a one gallon traditional mead with Lalvin ICV D47 and TOSNA.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 2,
    yeastLookup: async (query) => {
      yeastQueries.push(query);
      return [
        {
          id: 47,
          brand: "Lalvin",
          name: "D47",
          nitrogenRequirement: "Low",
          tolerance: 14,
          lowTemperature: 15,
          highTemperature: 25,
        },
      ];
    },
  });

  assert.deepEqual(yeastQueries, ["D47"]);
});

test("an ingredient missing from the catalog asks for its product sugar data after one lookup", async () => {
  let providerCalls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        providerCalls += 1;
        const functionName =
          providerCalls === 1
            ? "search_yeasts"
            : providerCalls === 2 || providerCalls === 4
              ? "build_recipe_draft"
              : "search_ingredients";
        return {
          id: `pear-syrup-${providerCalls}`,
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: `pear-syrup-tool-${providerCalls}`,
                type: "function",
                function: {
                  name: functionName,
                  arguments:
                    functionName === "search_yeasts"
                      ? JSON.stringify({ query: "DV10" })
                      : functionName === "search_ingredients"
                        ? JSON.stringify({ query: "pear syrup" })
                        : "{}",
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 1.25 gallon pear cyser with pear juice and 2 lb honey in primary, plus pear syrup in secondary. Use Lalvin DV10, Go-Ferm, and an O-and-K nutrient plan with three additions. I want it dry before secondary, then stabilized and backsweetened.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1.25, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [
          {
            name: "Pear Juice",
            catalogId: 22,
            category: "juice",
            brix: 10,
            role: "fill_liquid",
          },
          { name: "Honey", amount: { kind: "weight", value: 2, unit: "lb" } },
          { name: "Pear Syrup", category: "fruit", secondary: true },
        ],
        nutrients: {
          enabled: true,
          schedule: "oAndk",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    ingredientLookup: async () => [
      { id: 22, name: "Pear Juice", category: "juice", brix: 10 },
    ],
    yeastLookup: async () => [
      {
        id: 10,
        brand: "Lalvin",
        name: "DV10",
        nitrogenRequirement: "Low",
        tolerance: 17,
        lowTemperature: 10,
        highTemperature: 35,
      },
    ],
  });

  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    [
      "search_yeasts",
      "build_recipe_draft",
      "search_ingredients",
      "build_recipe_draft",
    ],
  );
  assert.match(result.answer, /product label or a measured sugar reading/i);
  assert.doesNotMatch(result.answer, /^## Unsaved MeadTools recipe draft/);
});

test("same-stage fruit duplicates are collapsed before the MeadTools workflow", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "duplicate-raspberry-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "duplicate-raspberry-build-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Make a five gallon raspberry mead with 3 lb raspberry in primary and 1 lb raspberry in secondary.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          {
            name: "Raspberry",
            catalogId: 11,
            category: "fruit",
            brix: 8,
            secondary: false,
            amount: { kind: "weight", value: 3, unit: "lb" },
          },
          {
            name: "Raspberry",
            catalogId: 11,
            category: "fruit",
            brix: 8,
            amount: { kind: "weight", value: 3, unit: "lb" },
          },
          {
            name: "Raspberry",
            catalogId: 11,
            category: "fruit",
            brix: 8,
            secondary: true,
            amount: { kind: "weight", value: 1, unit: "lb" },
          },
        ],
        nutrients: {
          enabled: true,
          yeastId: 1,
          yeastBrand: "Lalvin",
          yeastStrain: "71B",
          nitrogenRequirement: "Low",
          schedule: "tosna",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const raspberries =
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Raspberry",
    ) ?? [];
  assert.deepEqual(
    raspberries.map((ingredient) => [
      ingredient.secondary === true,
      ingredient.amount,
    ]),
    [
      [false, { kind: "weight", value: 3, unit: "lb" }],
      [true, { kind: "weight", value: 1, unit: "lb" }],
    ],
  );
});

test("a completed recipe keeps the deterministic renderer after a later provider prose response", async () => {
  let providerCalls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        providerCalls += 1;
        if (providerCalls === 1) {
          return {
            id: "renderer-build",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "renderer-build-tool",
                  type: "function",
                  function: { name: "build_recipe_draft", arguments: "{}" },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        if (providerCalls === 2) {
          return {
            id: "renderer-additive-search",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "renderer-additive-search-tool",
                  type: "function",
                  function: {
                    name: "search_additives",
                    arguments: JSON.stringify({ query: "pectic enzyme" }),
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "renderer-freeform",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "## Draft\n\nHoney: 14.258096 lb\n\nPotassium metabisulfite: 2.600001 units",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 12,
            totalTokens: 22,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a one gallon dry traditional mead at 1.090 OG with Lalvin 71B, Fermaid K, Go-Ferm, three nutrient additions, and pectic enzyme. Do not stabilize or backsweeten.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        additives: [{ name: "Pectic Enzyme", amount: 0.4, unit: "tsp" }],
        nutrients: {
          enabled: true,
          yeastId: 71,
          yeastBrand: "Lalvin",
          yeastStrain: "71B-1122",
          nitrogenRequirement: "Low",
          schedule: "justK",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
    additiveLookup: async () => [
      {
        id: "pectic-enzyme",
        name: "Pectic Enzyme",
        dosagePerGallon: 0.4,
        unit: "tsp",
      },
    ],
  });

  assert.equal(providerCalls, 4);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /\| Pectic Enzyme \| 0\.4 tsp \|/);
  assert.doesNotMatch(result.answer, /14\.258096|2\.600001|## Draft/);
});

test("a dry draft phrased as finishes dry defaults to no stabilizer calculation", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "finishes-dry-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "finishes-dry-build-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Make this 3 gallon blueberry mead. It finishes dry and does not include backsweetening.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 3, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          {
            name: "Blueberry",
            catalogId: 10,
            category: "fruit",
            brix: 8,
            amount: { kind: "weight", value: 6, unit: "lb" },
          },
        ],
        nutrients: nutrientPlan,
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.equal(result.recipeDraftInput?.stabilizers?.enabled, false);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.doesNotMatch(
    result.answer,
    /Should this draft include stabilizer calculations/i,
  );
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
            tool_calls: [
              {
                id: "missing-honey-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [
                      {
                        name: "Blackberry",
                        catalogId: 10,
                        category: "fruit",
                        brix: 7.86,
                        amount: { kind: "weight", value: 5, unit: "lb" },
                      },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "missing-honey-final",
        model: "test-model",
        message: {
          role: "assistant",
          content: "Your unsaved blackberry draft is ready.",
        },
        usage: {
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Create a 5 gallon blackberry mead at 16% ABV.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.118,
        fermentationFinalGravity: 0.999,
        ingredients: [],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.deepEqual(
    result.recipeDraftInput?.ingredients.find(
      (ingredient) => ingredient.name === "Honey",
    ),
    { name: "Honey", role: "adjustable_fermentable" },
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
            tool_calls: [
              {
                id: "fruit-wine-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [
                      {
                        name: "Blackberry",
                        catalogId: 10,
                        category: "fruit",
                        brix: 7.86,
                        amount: { kind: "weight", value: 5, unit: "lb" },
                      },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "fruit-wine-question",
        model: "test-model",
        message: {
          role: "assistant",
          content: "What batch size would you like?",
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a blackberry fruit wine recipe." },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.equal(
    result.recipeDraftInput?.ingredients.some(
      (ingredient) => ingredient.name.trim().toLowerCase() === "honey",
    ),
    false,
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
            tool_calls: [
              {
                id: "mead-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "mead-question",
        model: "test-model",
        message: {
          role: "assistant",
          content: "What gravity target should we use?",
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Create a blackberry mead recipe." }],
      recipeDraftInput: {
        ingredients: [
          { name: "Blackberry", catalogId: 10, category: "fruit", brix: 7.86 },
        ],
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.deepEqual(
    result.recipeDraftInput?.ingredients.find(
      (ingredient) => ingredient.name.trim().toLowerCase() === "honey",
    ),
    { name: "Honey" },
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
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "repeat-final",
        model: "test-model",
        message: {
          role: "assistant",
          content: "I need only the remaining gravity target.",
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create a blackberry mead recipe." },
        { role: "assistant", content: previousAnswer },
        { role: "user", content: "Keep the other settings unchanged." },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
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
          usage: {
            inputTokens: 10,
            outputTokens: 500,
            totalTokens: 510,
            cachedInputTokens: 0,
          },
          finishReason: "length",
        };
      }
      return {
        id: "recovered",
        model: "test-model",
        message: {
          role: "assistant",
          content: "What final gravity should MeadTools use?",
        },
        usage: {
          inputTokens: 20,
          outputTokens: 10,
          totalTokens: 30,
          cachedInputTokens: 0,
        },
        finishReason: "stop",
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Help me with a mead recipe." }],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
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
                arguments: '{"targetAbv":16,"additionalOgPoints":10}',
              },
            },
          ],
        },
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          totalTokens: 15,
          cachedInputTokens: 0,
        },
        finishReason: "tool_calls",
      };
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
            "Let us target 16% and add an additional 10 points to the OG.",
        },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "calculate_gravity_target" },
  });
  assert.equal(
    result.answer,
    "What fermentation final gravity should MeadTools use for the target ABV calculation?",
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
            tool_calls: [
              {
                id: "precise-gravity-tool",
                type: "function",
                function: {
                  name: "calculate_gravity_target",
                  arguments:
                    '{"targetAbv":14,"fermentationFinalGravity":0.999}',
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "rounded-gravity-echo",
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "rounded-gravity-tool",
              type: "function",
              function: {
                name: "build_recipe_draft",
                // Models frequently repeat the displayed three-decimal OG here.
                arguments: '{"targetOriginalGravity":1.104}',
              },
            },
          ],
        },
        usage: {
          inputTokens: 12,
          outputTokens: 4,
          totalTokens: 16,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Create this sweet traditional mead at 14% ABV.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        fermentationFinalGravity: 0.999,
        backsweetening: { targetFinalGravity: 1.015 },
        ingredients: [
          { name: "Wildflower Honey", role: "adjustable_fermentable" },
        ],
        nutrients: { ...nutrientPlan, numberOfAdditions: 3 },
      },
    }),
    maxOutputTokens: 500,
    maxToolCalls: 4,
  });

  assert.deepEqual(
    requests.map((request) => request.toolChoice),
    [
      { type: "function", function: { name: "calculate_gravity_target" } },
      "auto",
    ],
  );
  assert.ok(result.recipeDraftInput);
  assert.ok(
    Math.abs(
      (result.recipeDraftInput?.targetOriginalGravity ?? 0) -
        1.1044328386135414,
    ) < 1e-12,
  );
  const workflow = result.toolResults[1]?.result as {
    result?: { status?: string; derived?: { alcohol?: { abv?: number } } };
  };
  assert.equal(workflow.result?.status, "recipe");
  assert.ok(
    Math.abs((workflow.result?.derived?.alcohol?.abv ?? 0) - 14) < 0.01,
  );
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
            tool_calls: [
              {
                id: "dry-gravity-tool",
                type: "function",
                function: {
                  name: "calculate_gravity_target",
                  arguments: '{"targetAbv":16}',
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "dry-gravity-final",
        model: "test-model",
        message: { role: "assistant", content: "Continuing the recipe draft." },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Create a 16% blackberry mead and finish dry.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
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
            "Blackberry (catalog), Honey (adjustable), Fermaid K (justK), and potassium metabisulfite (kmeta).",
        },
        usage: {
          inputTokens: 10,
          outputTokens: 8,
          totalTokens: 18,
          cachedInputTokens: 0,
        },
      };
    },
  };

  const result = await runChatTurn({
    client,
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Show my mead draft." }],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 6,
  });

  assert.equal(
    result.answer,
    "Blackberry, Honey, Fermaid K, and potassium metabisulfite.",
  );
});

test("an affirmative honey reply resolves a stale traditional honey amount without another confirmation", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "traditional-honey-confirmation",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "traditional-honey-build",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Create a one gallon sweet traditional mead at 14% ABV.",
        },
        {
          role: "assistant",
          content: "Should I use the wildflower honey to hit the target?",
        },
        { role: "user", content: "Yes, use honey to hit the target." },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.12,
        fermentationFinalGravity: 0.999,
        ingredients: [
          {
            name: "Wildflower Honey",
            amount: { kind: "weight", value: 3, unit: "lb" },
          },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const honey = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Wildflower Honey",
  );
  assert.equal(honey?.role, "adjustable_fermentable");
  assert.equal(honey?.amount, undefined);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.ok(!/which single primary fermentable/i.test(result.answer));
});

test("a named honey-only reply resolves the adjustable fermentable without repeating the question", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "raspberry-blossom-honey-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "raspberry-blossom-honey-build-call",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Help me make a traditional mead recipe with raspberry blossom honey.",
        },
        {
          role: "assistant",
          content: "Which honey should MeadTools adjust to hit the target OG?",
        },
        {
          role: "user",
          content: "I only want to include raspberry blossom honey.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.097,
        fermentationFinalGravity: 0.999,
        backsweetening: { targetFinalGravity: 1.015 },
        ingredients: [{ name: "Honey" }],
        nutrients: {
          enabled: true,
          yeastBrand: "Lalvin",
          yeastStrain: "DV10",
          nitrogenRequirement: "Low",
          schedule: "tosna",
          numberOfAdditions: 3,
          goFermType: "none",
        },
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const honey = result.recipeDraftInput?.ingredients.find(
    (ingredient) =>
      ingredient.secondary !== true && /honey/i.test(ingredient.name),
  );
  assert.equal(honey?.name, "Raspberry Blossom Honey");
  assert.equal(honey?.role, "adjustable_fermentable");
  assert.equal(honey?.amount, undefined);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.doesNotMatch(result.answer, /which honey/i);
});

test("an explicit no-secondary-fruit choice removes a stale secondary ingredient instead of asking for zero", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "no-secondary-raspberry",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "no-secondary-raspberry-build",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content: "Create a five gallon raspberry mead at 14% ABV.",
        },
        {
          role: "assistant",
          content:
            "Should the raspberry be split across primary and secondary?",
        },
        {
          role: "user",
          content: "Use 10 lb raspberry in primary and no secondary raspberry.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.104,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          {
            name: "Raspberry",
            catalogId: 11,
            category: "fruit",
            brix: 7,
            amount: { kind: "weight", value: 10, unit: "lb" },
          },
          {
            name: "Raspberry",
            catalogId: 11,
            category: "fruit",
            brix: 7,
            secondary: true,
          },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const raspberries =
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Raspberry",
    ) ?? [];
  assert.deepEqual(raspberries, [
    {
      name: "Raspberry",
      catalogId: 11,
      category: "fruit",
      brix: 7,
      amount: { kind: "weight", value: 10, unit: "lb" },
    },
  ]);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.ok(!/amount and unit.*secondary/i.test(result.answer));
});

test("refractometer correction routes directly to the MeadTools calculator", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error(
          "The provider must not be called for calculator routing.",
        );
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "How do I correct a refractometer reading after fermentation?",
        },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
  });

  assert.equal(result.usage.model, "deterministic-calculator-routing");
  assert.match(result.answer, /refractometer correction calculator/i);
});

test("bench trials are treated as a mead process question rather than rejected by scope", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        if (calls === 1) {
          return {
            id: "bench-trials-search",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "bench-trials-search-call",
                  type: "function",
                  function: {
                    name: "search_wiki",
                    arguments: '{"query":"mead bench trials"}',
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        if (calls === 2) {
          return {
            id: "bench-trials-fetch",
            model: "test-model",
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "bench-trials-fetch-call",
                  type: "function",
                  function: {
                    name: "fetch_wiki_page",
                    arguments:
                      '{"url":"https://wiki.meadtools.com/en/process/bench_trials"}',
                  },
                },
              ],
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "bench-trials-process",
          model: "test-model",
          message: {
            role: "assistant",
            content:
              "Use a small set of measured bench trials before changing the full batch.",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 8,
            totalTokens: 18,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I have a dry 5 gallon traditional and want to compare different sweetness levels before committing. How should I run bench trials?",
        },
      ],
    }),
    maxOutputTokens: 500,
    maxToolCalls: 6,
    wikiFetcher,
  });

  assert.equal(result.usage.model, "test-model");
  assert.match(result.answer, /bench trials/i);
});

test("traditional recipe requests continue from gravity targeting into recipe drafting", async () => {
  const requests: FireworksCompletionRequest[] = [];
  const client: ChatModelClient = {
    async complete(request) {
      requests.push(request);
      if (requests.length === 1) {
        return {
          id: "traditional-gravity",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "traditional-gravity-call",
                type: "function",
                function: {
                  name: "calculate_gravity_target",
                  arguments:
                    '{"targetAbv":12,"fermentationFinalGravity":0.999}',
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      if (requests.length === 2) {
        return {
          id: "traditional-ingredient-search",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "traditional-ingredient-search-call",
                type: "function",
                function: {
                  name: "search_ingredients",
                  arguments: '{"query":"orange blossom honey"}',
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      if (requests.length === 3) {
        return {
          id: "traditional-yeast-search",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "traditional-yeast-search-call",
                type: "function",
                function: {
                  name: "search_yeasts",
                  arguments: '{"query":"Lalvin 71B"}',
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      }
      return {
        id: "traditional-draft",
        model: "test-model",
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            {
              id: "traditional-draft-call",
              type: "function",
              function: {
                name: "build_recipe_draft",
                arguments:
                  '{"batchVolume":{"value":2,"unit":"gal"},"fermentationFinalGravity":0.999,"ingredients":[{"name":"Orange Blossom Honey","amount":{"kind":"weight","value":6,"unit":"lb"}}],"nutrients":{"enabled":true,"yeastBrand":"Lalvin","yeastStrain":"71B","nitrogenRequirement":"Medium","schedule":"justK","numberOfAdditions":3,"goFermType":"Go-Ferm"},"stabilizers":{"enabled":false}}',
              },
            },
          ],
        },
        usage: {
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          cachedInputTokens: 0,
        },
      };
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
            "Create a 2 gallon dry traditional with 6 lb of orange blossom honey, Lalvin 71B, Go-Ferm, and Fermaid K in three additions. Target 12% ABV and do not stabilize or backsweeten.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 4,
    ingredientLookup: async () => [
      {
        id: 1,
        name: "Orange Blossom Honey",
        category: "honey",
        brix: 81,
      },
    ],
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B-1122",
        nitrogenRequirement: "Medium",
        tolerance: 14,
        lowTemperature: 15,
        highTemperature: 30,
      },
    ],
  });

  assert.deepEqual(
    requests
      .map((request) => request.toolChoice)
      .filter((choice) => choice !== "none"),
    [
      { type: "function", function: { name: "calculate_gravity_target" } },
      { type: "function", function: { name: "search_yeasts" } },
      { type: "function", function: { name: "search_yeasts" } },
      { type: "function", function: { name: "build_recipe_draft" } },
    ],
  );
});

test("fixed cider and honey quantities stay fixed so the workflow returns the volume conflict", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "fixed-cyser-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "fixed-cyser-build",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [
                      { name: "Honey", role: "adjustable_fermentable" },
                      {
                        name: "Wildflower Honey",
                        role: "adjustable_fermentable",
                      },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon cyser with 1 gallon fresh apple cider and 3 lb of wildflower honey. I want it around 10% ABV, finishing at 1.010. Use Lalvin D47, Fermaid K and Go-Ferm with two additions. I do not plan to backsweeten or stabilize.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.075,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Apple Juice", category: "juice", brix: 11 },
          { name: "Wildflower Honey", role: "adjustable_fermentable" },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const honey = result.recipeDraftInput?.ingredients.find((ingredient) =>
    /honey/i.test(ingredient.name),
  );
  const juice = result.recipeDraftInput?.ingredients.find((ingredient) =>
    /apple juice/i.test(ingredient.name),
  );
  assert.equal(honey?.name, "Wildflower Honey");
  assert.deepEqual(honey?.amount, { kind: "weight", value: 3, unit: "lb" });
  assert.equal(honey?.role, "fixed");
  assert.equal(
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) =>
        ingredient.secondary !== true && ingredient.name === "Wildflower Honey",
    ).length,
    1,
  );
  assert.deepEqual(juice?.amount, { kind: "volume", value: 1, unit: "gal" });
  assert.match(result.answer, /fixed ingredients/i);
  assert.doesNotMatch(
    result.answer,
    /Wildflower Honey, [^\n]*Wildflower Honey/i,
  );
});

test("a measured cider phrased with 'of' remains fixed before the workflow checks batch-volume feasibility", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "fixed-cyser-with-of-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "fixed-cyser-with-of-build",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  // Mirrors the provider failure: it converted the stated
                  // cider volume to a calculated weight before reconciliation.
                  arguments: JSON.stringify({
                    batchVolume: { value: 1, unit: "gal" },
                    targetOriginalGravity: 1.075,
                    fermentationFinalGravity: 0.999,
                    ingredients: [
                      {
                        name: "Apple Juice",
                        category: "juice",
                        brix: 11,
                        amount: { kind: "weight", value: 6.48, unit: "lb" },
                      },
                      {
                        name: "Wildflower Honey",
                        category: "honey",
                        brix: 81,
                        amount: { kind: "weight", value: 3, unit: "lb" },
                      },
                    ],
                    nutrients: nutrientPlan,
                    stabilizers: { enabled: false },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon cyser with 1 gallon of fresh apple cider and 3 lb of wildflower honey. I want it around 10% ABV, finishing at 1.010. Use Lalvin D47, Fermaid K and Go-Ferm with two additions. I do not plan to backsweeten or stabilize.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const cider = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Apple Juice",
  );
  assert.deepEqual(cider?.amount, { kind: "volume", value: 1, unit: "gal" });
  assert.match(result.answer, /no room left|already use the requested/i);
  assert.doesNotMatch(result.answer, /18\.410|1\.423273/);
});

test("a measured named honey keeps its varietal without absorbing the measurement unit", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "measured-varietal-honey",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "measured-varietal-honey-build",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 2 gallon traditional with 3 lb of wildflower honey at 12% ABV.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 2, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const honey = result.recipeDraftInput?.ingredients.find((ingredient) =>
    /honey/i.test(ingredient.name),
  );
  assert.equal(honey?.name, "Wildflower Honey");
  assert.deepEqual(honey?.amount, { kind: "weight", value: 3, unit: "lb" });
  assert.equal(honey?.role, "fixed");
});

test("a shared fruit amount split evenly across singular and plural stage labels is divided once", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "equal-fruit-split",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "equal-fruit-split-build",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 5 gallon strawberry mead. Use 15 lb of strawberry split evenly between primary and secondary.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.1,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          { name: "Strawberry", category: "fruit", brix: 7.5 },
          {
            name: "Strawberries",
            category: "fruit",
            brix: 7.5,
            secondary: true,
          },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.deepEqual(
    result.recipeDraftInput?.ingredients
      .filter((ingredient) => /strawberr(?:y|ies)/i.test(ingredient.name))
      .map((ingredient) => ingredient.amount),
    [
      { kind: "weight", value: 7.5, unit: "lb" },
      { kind: "weight", value: 7.5, unit: "lb" },
    ],
  );
});

test("a shared metric fruit amount creates both stages before calculation", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "metric-fruit-split-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "metric-fruit-split-build-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Make a 10 L blueberry mead at 12% ABV. Use 10 kg blueberries split evenly between primary and secondary, Lalvin 71B, TOSNA with Go-Ferm and four nutrient additions.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 10, unit: "L" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          {
            name: "Blueberry",
            category: "fruit",
            brix: 10,
            amount: { kind: "weight", value: 10, unit: "kg" },
          },
        ],
        nutrients: {
          enabled: true,
          yeastId: 71,
          yeastBrand: "Lalvin",
          yeastStrain: "71B",
          nitrogenRequirement: "Low",
          schedule: "tosna",
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.deepEqual(
    result.recipeDraftInput?.ingredients
      .filter((ingredient) => ingredient.name === "Blueberry")
      .map((ingredient) => ({
        amount: ingredient.amount,
        secondary: ingredient.secondary,
      })),
    [
      {
        amount: { kind: "weight", value: 5, unit: "kg" },
        secondary: undefined,
      },
      { amount: { kind: "weight", value: 5, unit: "kg" }, secondary: true },
    ],
  );
  assert.equal(result.recipeDraftInput?.nutrients?.numberOfAdditions, 4);
  assert.match(result.answer, /stated primary fruit load/i);
  assert.match(
    result.answer,
    /fruit mass as fruit, not as a liquid measurement/i,
  );
});

test("an accepted fruit plan retains an explicit secondary-only fruit amount", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        throw new Error("An accepted plan should draft directly.");
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Make a one gallon sweet raspberry mead." },
        {
          role: "assistant",
          content:
            "I can use beginner defaults and calculate a draft. Shall I continue?",
        },
        {
          role: "user",
          content:
            "Yes. Use 3 lb of raspberry in secondary and make the draft.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
      },
    }),
    ingredientLookup: async () => [
      { id: 1, name: "Raspberry", category: "fruit", brix: 8 },
    ],
    yeastLookup: async () => [
      {
        id: 2,
        brand: "Lalvin",
        name: "71B",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 59,
        highTemperature: 86,
      },
    ],
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const raspberry = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Raspberry",
  );
  assert.equal(raspberry?.secondary, true);
  assert.deepEqual(raspberry?.amount, { kind: "weight", value: 3, unit: "lb" });
});

test("a generic fruit-in-secondary instruction moves a sparse fruit payload without inventing additives", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "secondary-fruit-and-additive-reconciliation",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "secondary-fruit-and-additive-reconciliation-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    batchVolume: { value: 3, unit: "gal" },
                    targetOriginalGravity: 1.1,
                    fermentationFinalGravity: 0.999,
                    ingredients: [
                      { name: "Honey", role: "adjustable_fermentable" },
                      { name: "Raspberry", category: "fruit", brix: 8 },
                    ],
                    additives: [
                      { name: "Vanilla Bean", amount: 1, unit: "units" },
                      { name: "Pectic Enzyme", amount: 1, unit: "g" },
                      { name: "Oak Cubes", amount: 1, unit: "oz" },
                    ],
                    nutrients: nutrientPlan,
                    stabilizers: {
                      enabled: true,
                      type: "kmeta",
                      phReading: 3.5,
                    },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 3 gallon raspberry-vanilla mead at 12% ABV. Use fruit in secondary, Lalvin 71B, TOSNA with Go-Ferm and three additions. Stabilize and backsweeten.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    ingredientLookup: async () => [
      { id: 1, name: "Raspberry", category: "fruit", brix: 8 },
    ],
    additiveLookup: async () => [],
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 15,
        highTemperature: 30,
      },
    ],
  });

  const raspberries =
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Raspberry",
    ) ?? [];
  assert.equal(raspberries.length, 1);
  assert.equal(raspberries[0]?.secondary, true);
  assert.deepEqual(
    result.recipeDraftInput?.additives.map((additive) => additive.name),
    ["Vanilla Bean"],
  );
  assert.equal(result.recipeDraftInput?.additives[0]?.amount, undefined);
});

test("a progressive draft keeps the default backsweetening target from the earlier direct request", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "progressive-backsweetening-default",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "progressive-backsweetening-default-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    backsweetening: { targetFinalGravity: 1.01 },
                    ingredients: [
                      {
                        name: "Strawberry",
                        category: "fruit",
                        brix: 8,
                        amount: { kind: "weight", value: 15, unit: "lb" },
                      },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create me a strawberry mead recipe." },
        {
          role: "assistant",
          content: "What batch size, ABV, and process choices would you like?",
        },
        {
          role: "user",
          content:
            "Make it 5 gallons, finish dry and backsweeten, and put strawberry in both primary and secondary. Use Fermaid K only with Go-Ferm.",
        },
        {
          role: "assistant",
          content: "What fruit amount and yeast would you like?",
        },
        {
          role: "user",
          content:
            "Target 14% ABV. Use Lalvin 71B, 15 lb of strawberry split evenly, three nutrient additions, potassium metabisulfite, and assume pH 3.5.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.11,
        fermentationFinalGravity: 0.999,
        backsweeteningIntent: true,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          { name: "Strawberry", category: "fruit", brix: 8 },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.015,
  );
  assert.deepEqual(
    result.recipeDraftInput?.ingredients
      .filter((ingredient) => ingredient.name === "Strawberry")
      .map((ingredient) => ({
        amount: ingredient.amount,
        secondary: ingredient.secondary,
      })),
    [
      {
        amount: { kind: "weight", value: 7.5, unit: "lb" },
        secondary: undefined,
      },
      { amount: { kind: "weight", value: 7.5, unit: "lb" }, secondary: true },
    ],
  );
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
});

test("a progressive shared fruit amount restores both stages when a provider returns a zero secondary line", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "progressive-zero-secondary",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "progressive-zero-secondary-build",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [
                      {
                        name: "Strawberry",
                        category: "fruit",
                        brix: 8,
                        amount: { kind: "weight", value: 7.5, unit: "lb" },
                      },
                      {
                        name: "Strawberry",
                        category: "fruit",
                        brix: 8,
                        secondary: true,
                        amount: { kind: "weight", value: 0, unit: "lb" },
                      },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Create me a strawberry mead recipe." },
        {
          role: "assistant",
          content: "What batch size and stages would you like?",
        },
        {
          role: "user",
          content:
            "Make it 5 gallons and put strawberry in both primary and secondary.",
        },
        {
          role: "assistant",
          content: "What fruit amount and targets should I use?",
        },
        {
          role: "user",
          content:
            "Target 14% ABV. Use 15 lb of strawberry split evenly, Lalvin 71B, Fermaid K with Go-Ferm, and three nutrient additions.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.11,
        fermentationFinalGravity: 0.999,
        backsweeteningIntent: true,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          { name: "Strawberry", category: "fruit", brix: 8 },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.deepEqual(
    result.recipeDraftInput?.ingredients
      .filter((ingredient) => ingredient.name === "Strawberry")
      .map((ingredient) => ({
        amount: ingredient.amount,
        secondary: ingredient.secondary,
      })),
    [
      {
        amount: { kind: "weight", value: 7.5, unit: "lb" },
        secondary: undefined,
      },
      { amount: { kind: "weight", value: 7.5, unit: "lb" }, secondary: true },
    ],
  );
});

test("an empty provider recipe response recovers through the shared draft workflow", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "empty-provider-recipe-response",
          model: "test-model",
          message: { role: "assistant", content: null },
          usage: {
            inputTokens: 10,
            outputTokens: 0,
            totalTokens: 10,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 1 gallon traditional mead at 12% ABV with Lalvin 71B, Go-Ferm, and TOSNA with three additions. Finish dry.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.doesNotMatch(result.answer, /could not produce a response/i);
  assert.equal(result.toolResults.at(-1)?.toolName, "build_recipe_draft");
});

test("a dry DAP recipe overrides model-invented stabilization and nutrient schedule", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "dry-dap-reconciliation",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "dry-dap-reconciliation-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    nutrients: { ...nutrientPlan, schedule: "oAndDap" },
                    additives: [{ name: "DAP", amount: 1, unit: "g" }],
                    stabilizers: {
                      enabled: true,
                      type: "kmeta",
                      phReading: 3.5,
                    },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 1 gallon dry traditional mead at 12% ABV with Lalvin 71B and DAP in three additions.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.equal(result.recipeDraftInput?.nutrients?.schedule, "dap");
  assert.equal(result.recipeDraftInput?.nutrients?.goFermType, "none");
  assert.equal(result.recipeDraftInput?.stabilizers?.enabled, false);
  assert.deepEqual(result.recipeDraftInput?.additives, []);
  assert.doesNotMatch(result.answer, /### Stabilizers/);
});

test("sweet-cherry ingredient wording does not turn a dry draft into a sweet stabilized recipe", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "dry-sweet-cherry-reconciliation",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "dry-sweet-cherry-reconciliation-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    stabilizers: {
                      enabled: true,
                      type: "kmeta",
                      phReading: 3.5,
                    },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
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
      recipeDraftInput: {
        batchVolume: { value: 10, unit: "L" },
        targetOriginalGravity: 1.106,
        fermentationFinalGravity: 0.996,
        ingredients: [
          {
            name: "Honey",
            role: "adjustable_fermentable",
            amount: { kind: "weight", value: 2.8, unit: "kg" },
          },
          {
            name: "Cherry, Sweet",
            catalogId: 1,
            category: "fruit",
            brix: 16,
            amount: { kind: "weight", value: 2.7, unit: "kg" },
          },
          {
            name: "Cherry, Tart",
            catalogId: 2,
            category: "fruit",
            brix: 12,
            amount: { kind: "weight", value: 800, unit: "g" },
          },
        ],
        additives: [
          { name: "Bentonite", amount: 15.7, unit: "g" },
          { name: "Oak Chips", amount: 7, unit: "g" },
        ],
        nutrients: {
          ...nutrientPlan,
          schedule: "dap",
          goFermType: "none",
          numberOfAdditions: 3,
        },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.equal(result.recipeDraftInput?.stabilizers?.enabled, false);
  assert.doesNotMatch(result.answer, /### Stabilizers/);
});

test("a stabilization request survives a later no-backsweetening clarification and sparse tool call", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "single-stage-fruit-followup",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "single-stage-fruit-followup-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    stabilizers: { enabled: false },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 3 gallon raspberry-vanilla mead at 12% ABV. Use fruit in secondary, EC-1118, Fermaid K with Go-Ferm, and three nutrient additions. Let it ferment dry after the secondary fruit, then stabilize it; I do not want to backsweeten.",
        },
        {
          role: "assistant",
          content:
            "What amount should the draft include for Vanilla in secondary?",
        },
        {
          role: "user",
          content:
            "Use 6 lb of raspberries. I want one whole vanilla bean in secondary. I am not taking a pH reading; use the default estimate.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 3, unit: "gal" },
        targetOriginalGravity: 1.095,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          {
            name: "Raspberry",
            category: "fruit",
            brix: 8,
            secondary: true,
            amount: { kind: "weight", value: 9, unit: "lb" },
          },
        ],
        additives: [{ name: "Vanilla Bean" }],
        nutrients: { ...nutrientPlan, yeastStrain: "EC-1118" },
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const raspberry = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Raspberry",
  );
  assert.equal(raspberry?.secondary, true);
  assert.deepEqual(raspberry?.amount, { kind: "weight", value: 6, unit: "lb" });
  assert.deepEqual(result.recipeDraftInput?.stabilizers, {
    enabled: true,
    type: "kmeta",
    phReading: 3.5,
  });
  assert.ok(
    !result.recipeDraftInput?.assumptions.some((assumption) =>
      /fruit-load assumption/i.test(assumption),
    ),
  );
});

test("a total honey amount with a reserved backsweetening portion is split once", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "reserved-honey-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "reserved-honey-build-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon hydromel at 1.060 OG with 10.5 lb orange blossom honey total, with 2 lb reserved for backsweetening. Use Lalvin 71B, TOSNA with Go-Ferm and three additions.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.06,
        fermentationFinalGravity: 0.999,
        ingredients: [
          {
            name: "Orange Blossom Honey",
            category: "honey",
            brix: 80,
            amount: { kind: "weight", value: 10.5, unit: "lb" },
          },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const honeys =
    result.recipeDraftInput?.ingredients.filter((ingredient) =>
      /honey/i.test(ingredient.name),
    ) ?? [];
  assert.deepEqual(
    honeys.map((ingredient) => [
      ingredient.secondary === true,
      ingredient.amount,
    ]),
    [
      [false, { kind: "weight", value: 8.5, unit: "lb" }],
      [true, { kind: "weight", value: 2, unit: "lb" }],
    ],
  );
  assert.equal(result.recipeDraftInput?.backsweetening, undefined);
});

test("a sweet carbonated draft without a packaging strategy stops before the provider", async () => {
  let providerCalls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        providerCalls += 1;
        throw new Error(
          "The provider should not be called for an unsafe sweet carbonated draft.",
        );
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon sparkling hydromel around 1.060 OG, semi-sweet at 2.5 volumes carbonation. Use 10.5 lb orange blossom honey total, with 2 lb reserved for backsweetening.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 4,
  });

  assert.equal(providerCalls, 0);
  assert.equal(result.usage.model, "deterministic-sparkling-safety-check");
  assert.match(result.answer, /packaging strategy/i);
  assert.match(result.answer, /force-carbonate/i);
});

test("catalog additives named in a long request survive a model omission", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "omitted-additives",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "omitted-additives-build",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Make a 1 gallon mead with one vanilla bean in secondary and 2 g Estate Tannin.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    additiveLookup: async () => [
      {
        id: "vanilla-bean",
        name: "Vanilla Bean",
        dosagePerGallon: 1,
        unit: "units",
      },
      {
        id: "estate-tannin",
        name: "Estate Tannin",
        dosagePerGallon: 1.9,
        unit: "g",
      },
    ],
  });

  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Vanilla Bean", amount: 1, unit: "units", secondary: true },
    { name: "Estate Tannin", amount: 2, unit: "g" },
  ]);
});

test("a partial yeast name still forces catalog lookup until a yeast ID is present", async () => {
  const requests: FireworksCompletionRequest[] = [];
  await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "partial-yeast",
          model: "test-model",
          message: {
            role: "assistant",
            content: "What batch volume should MeadTools use?",
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [{ role: "user", content: "Use Lalvin 71B for this mead." }],
      recipeDraftInput: {
        ingredients: [{ name: "Honey" }],
        nutrients: {
          enabled: true,
          yeastBrand: "Lalvin",
          yeastStrain: "71B",
          schedule: "tosna",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 2,
    yeastLookup: async () => [],
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_yeasts" },
  });
});

test("an unlisted named yeast asks for a specific replacement detail instead of a generic nutrient checklist", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "unlisted-yeast",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "unlisted-yeast-call",
                type: "function",
                function: {
                  name: "search_yeasts",
                  arguments: '{"query":"Belle Saison"}',
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        { role: "user", content: "Draft a 5 gallon cyser with Belle Saison." },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", amount: { kind: "weight", value: 10, unit: "lb" } },
        ],
        nutrients: {
          enabled: true,
          schedule: "tosna",
          numberOfAdditions: 3,
          goFermType: "Go-Ferm",
        },
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 2,
    yeastLookup: async () => [],
  });

  assert.match(result.answer, /could not match the requested yeast/i);
  assert.match(result.answer, /nitrogen requirement/i);
  assert.doesNotMatch(result.answer, /still needs yeast brand and strain/i);
});

test("a direct draft build reconciles a named catalog yeast when the model omits its nutrient metadata", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "d47-build-without-metadata",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "d47-build-without-metadata-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 1 gallon traditional mead with 3 lb honey. Use Lalvin ICV D47, Go-Ferm, and TOSNA with three additions. It should ferment dry and not use stabilizers.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    yeastLookup: async () => [
      {
        id: 47,
        brand: "Lalvin",
        name: "ICV D47",
        nitrogenRequirement: "Low",
        tolerance: 17,
        lowTemperature: 10,
        highTemperature: 30,
      },
    ],
  });

  assert.equal(result.recipeDraftInput?.nutrients?.yeastId, 47);
  assert.equal(result.recipeDraftInput?.nutrients?.nitrogenRequirement, "Low");
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.doesNotMatch(result.answer, /nitrogen requirement/i);
});

test("a complete conversational I-want recipe request enters the concrete draft workflow", async () => {
  const requests: FireworksCompletionRequest[] = [];
  await runChatTurn({
    client: {
      async complete(request) {
        requests.push(request);
        return {
          id: "concrete-i-want-draft",
          model: "test-model",
          message: { role: "assistant", content: "I will build that draft." },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I want a 10 liter dry cherry mead with 2.8 kg honey, 2.7 kg sweet cherries, 800 g tart cherries, Lalvin 71B, and DAP in three additions. Target 1.106 OG.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 2,
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 15,
        highTemperature: 30,
      },
    ],
  });

  assert.deepEqual(requests[0]?.toolChoice, {
    type: "function",
    function: { name: "search_yeasts" },
  });
});

test("a direct measured-fruit draft uses the medium-strength default when no gravity target is supplied", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "default-gravity-fruit-draft",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "default-gravity-fruit-draft-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon raspberry mead with 3 lb raspberry in primary. Use wildflower honey, Lalvin 71B, Go-Ferm, and TOSNA with three additions. Ferment dry and do not stabilize.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    ingredientLookup: async () => [
      { id: 3, name: "Raspberry", category: "fruit", brix: 10 },
    ],
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 15,
        highTemperature: 30,
      },
    ],
  });

  assert.equal(result.recipeDraftInput?.targetOriginalGravity, 1.09);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
});

test("a split additive does not split otherwise primary-only fruit across stages", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "split-vanilla-not-fruit",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "split-vanilla-not-fruit-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 4 gallon blackberry mead with 4 lb blackberry in primary and 2 split vanilla beans. Use 8 lb honey, Lalvin 71B, Go-Ferm, and TOSNA with three additions. Ferment dry and do not stabilize.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    ingredientLookup: async () => [
      { id: 4, name: "Blackberry", category: "fruit", brix: 10 },
    ],
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 15,
        highTemperature: 30,
      },
    ],
  });

  const blackberry =
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Blackberry",
    ) ?? [];
  assert.equal(blackberry.length, 1);
  assert.equal(blackberry[0]?.secondary, undefined);
  assert.deepEqual(blackberry[0]?.amount, {
    kind: "weight",
    value: 4,
    unit: "lb",
  });
});

test("specific named juice prevents a duplicate generic juice ingredient", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "specific-juice-hydration",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "specific-juice-hydration-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon lemon mead with 8 lb honey in primary and 2 lb lemon juice in secondary. Use Lalvin D47, Go-Ferm, and TOSNA with three additions. Ferment dry and do not stabilize.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    ingredientLookup: async () => [
      { id: 1, name: "Juice", category: "juice", brix: 10 },
      { id: 2, name: "Lemon Juice", category: "juice", brix: 8 },
    ],
    yeastLookup: async () => [
      {
        id: 47,
        brand: "Lalvin",
        name: "ICV D47",
        nitrogenRequirement: "Low",
        tolerance: 17,
        lowTemperature: 10,
        highTemperature: 30,
      },
    ],
  });

  const juices =
    result.recipeDraftInput?.ingredients.filter((ingredient) =>
      /juice/i.test(ingredient.name),
    ) ?? [];
  assert.deepEqual(
    juices.map((ingredient) => ingredient.name),
    ["Lemon Juice"],
  );
  assert.equal(juices[0]?.secondary, true);
});

test("descriptive cider aliases reconcile to one catalog-backed fill liquid", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "descriptive-cider-reconciliation",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "descriptive-cider-reconciliation-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [
                      {
                        name: "Fresh apple cider",
                        amount: { kind: "weight", value: 0, unit: "oz" },
                      },
                      {
                        name: "Apple Juice",
                        catalogId: 8,
                        category: "juice",
                        brix: 11,
                      },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon cyser with fresh apple cider as the fill liquid, enough honey for 12% ABV, Lalvin D47, Go-Ferm, and TOSNA with three additions. Finish dry.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    ingredientLookup: async () => [
      { id: 8, name: "Apple Juice", category: "juice", brix: 11 },
    ],
    yeastLookup: async () => [
      {
        id: 47,
        brand: "Lalvin",
        name: "ICV D47",
        nitrogenRequirement: "Low",
        tolerance: 17,
        lowTemperature: 10,
        highTemperature: 30,
      },
    ],
  });

  const cider =
    result.recipeDraftInput?.ingredients.filter((ingredient) =>
      /apple (?:juice|cider)/i.test(ingredient.name),
    ) ?? [];
  assert.deepEqual(
    cider.map((ingredient) => ingredient.name),
    ["Apple Juice"],
  );
  assert.equal(cider[0]?.role, "fill_liquid");
  assert.equal(cider[0]?.amount, undefined);
});

test("an unmeasured named cider fill liquid is restored from a sparse secondary payload", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "secondary-cider-fill-reconciliation",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "secondary-cider-fill-reconciliation-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [
                      {
                        name: "Apple Juice",
                        catalogId: 8,
                        category: "juice",
                        brix: 11,
                        secondary: true,
                      },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
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
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.074,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Wildflower Honey", role: "adjustable_fermentable" },
          {
            name: "Apple Juice",
            catalogId: 8,
            category: "juice",
            brix: 11,
            secondary: true,
          },
        ],
        nutrients: {
          ...nutrientPlan,
          yeastStrain: "ICV D47",
          nitrogenRequirement: "Low",
          schedule: "justK",
          numberOfAdditions: 2,
        },
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const cider =
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Apple Juice",
    ) ?? [];
  assert.deepEqual(
    cider.map((ingredient) => ({
      secondary: ingredient.secondary,
      role: ingredient.role,
      amount: ingredient.amount,
    })),
    [{ secondary: false, role: "fill_liquid", amount: undefined }],
  );
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
});

test("a sparse payload moves a specifically staged juice out of an incorrect primary line", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "staged-lemon-juice-reconciliation",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "staged-lemon-juice-reconciliation-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [
                      {
                        name: "Juice",
                        amount: { kind: "weight", value: 2.1, unit: "lb" },
                      },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon lemon mead with 8 lb honey in primary and 2.1 lb lemon juice in secondary. Use Lalvin D47, Go-Ferm, and TOSNA with three additions. Ferment dry and do not stabilize.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    ingredientLookup: async () => [
      { id: 1, name: "Juice", category: "juice", brix: 10 },
      { id: 2, name: "Lemon Juice", category: "juice", brix: 8 },
    ],
    yeastLookup: async () => [
      {
        id: 47,
        brand: "Lalvin",
        name: "ICV D47",
        nitrogenRequirement: "Low",
        tolerance: 17,
        lowTemperature: 10,
        highTemperature: 30,
      },
    ],
  });

  const juices =
    result.recipeDraftInput?.ingredients.filter((ingredient) =>
      /juice/i.test(ingredient.name),
    ) ?? [];
  assert.deepEqual(
    juices.map((ingredient) => ({
      name: ingredient.name,
      secondary: ingredient.secondary,
    })),
    [{ name: "Lemon Juice", secondary: true }],
  );
  assert.deepEqual(juices[0]?.amount, {
    kind: "weight",
    value: 2.1,
    unit: "lb",
  });
});

test("a named juice returned in both stages keeps the brewer's explicit secondary stage", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "duplicate-named-juice-stage-reconciliation",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "duplicate-named-juice-stage-reconciliation-tool",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [
                      {
                        name: "Lemon Juice",
                        catalogId: 2,
                        category: "juice",
                        brix: 8,
                        amount: { kind: "weight", value: 2.1, unit: "lb" },
                      },
                      {
                        name: "Lemon Juice",
                        catalogId: 2,
                        category: "juice",
                        brix: 8,
                        amount: { kind: "weight", value: 2.1, unit: "lb" },
                      },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon lemon mead with 8 lb honey in primary and 2.1 lb lemon juice in secondary. Use Lalvin D47, Go-Ferm, and TOSNA with three additions. Ferment dry and do not stabilize.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    ingredientLookup: async () => [
      { id: 1, name: "Juice", category: "juice", brix: 10 },
      { id: 2, name: "Lemon Juice", category: "juice", brix: 8 },
    ],
    yeastLookup: async () => [
      {
        id: 47,
        brand: "Lalvin",
        name: "ICV D47",
        nitrogenRequirement: "Low",
        tolerance: 17,
        lowTemperature: 10,
        highTemperature: 30,
      },
    ],
  });

  const juices =
    result.recipeDraftInput?.ingredients.filter((ingredient) =>
      /juice/i.test(ingredient.name),
    ) ?? [];
  assert.deepEqual(
    juices.map((ingredient) => ({
      name: ingredient.name,
      secondary: ingredient.secondary,
    })),
    [{ name: "Lemon Juice", secondary: true }],
  );
});

test("a dry fermentation that explicitly stabilizes retains the stabilizer calculation", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "dry-then-stabilize",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "dry-then-stabilize-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 1 gallon traditional with 3 lb honey. Use Lalvin 71B, Go-Ferm, and TOSNA with three additions. Ferment dry, then stabilize before secondary additions.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 15,
        highTemperature: 30,
      },
    ],
  });

  assert.equal(result.recipeDraftInput?.stabilizers?.enabled, true);
  assert.equal(result.recipeDraftInput?.stabilizers?.phReading, 3.5);
});

test("a direct fixed-honey backsweetening request retains the default finished gravity", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "fixed-honey-backsweetening-default",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "fixed-honey-backsweetening-default-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Build a 4 gallon apple mead with 8 lb honey and 4 lb apples in primary. Use Lalvin 71B, Go-Ferm, and TOSNA with three additions. Ferment dry, stabilize, and backsweeten.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    ingredientLookup: async () => [
      { id: 1, name: "Apple", category: "fruit", brix: 10 },
    ],
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 15,
        highTemperature: 30,
      },
    ],
  });

  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.015,
  );
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
});

test("an explicit backsweetening request keeps the default finished target with fixed secondary fruit", async () => {
  let callCount = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        callCount += 1;
        if (callCount > 1) {
          return {
            id: "backsweetening-target-question",
            model: "test-model",
            message: {
              role: "assistant",
              content:
                "What finished gravity should MeadTools target after backsweetening?",
            },
            usage: {
              inputTokens: 10,
              outputTokens: 4,
              totalTokens: 14,
              cachedInputTokens: 0,
            },
          };
        }
        return {
          id: "backsweetening-target-needed",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "backsweetening-target-needed-build",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 5 gallon blueberry mead at 16% ABV. Use 15 lb split between primary and secondary, finish dry, and backsweeten.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.125,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          { name: "Blueberry", category: "fruit", brix: 10 },
          { name: "Blueberry", category: "fruit", brix: 10, secondary: true },
        ],
        nutrients: nutrientPlan,
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.equal(result.recipeDraftInput?.backsweeteningIntent, true);
  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.015,
  );
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.match(result.answer, /Backsweetened FG:\*{0,2}:?\s*1\.015/i);
});

test("a qualitative finished-sweetness target stays a backsweetening target without explicit default authorization", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "finished-sweetness-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "finished-sweetness-build-call",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 1 gallon cherry mead at 13% ABV, medium-sweet and finishing around 1.012. Use Lalvin 71B, TOSNA, Go-Ferm, and three nutrient additions.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.105,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          {
            name: "Cherry",
            category: "fruit",
            brix: 12,
            amount: { kind: "weight", value: 3, unit: "lb" },
          },
        ],
        nutrients: nutrientPlan,
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 2,
  });

  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.012,
  );
  assert.equal(result.recipeDraftInput?.stabilizers?.enabled, true);
  assert.match(result.answer, /Honey \(backsweetening\)/);
});

test("an explicitly named fill liquid stays a fill liquid instead of duplicating water", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "fill-liquid-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "fill-liquid-build-call",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 1 gallon cyser with fresh apple cider as the fill liquid, 2 lb wildflower honey, Lalvin D47, Fermaid K, Go-Ferm, and two nutrient additions. Finish dry.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        ingredients: [
          { name: "Apple Juice", category: "juice", brix: 11 },
          { name: "Wildflower Honey", role: "adjustable_fermentable" },
        ],
        nutrients: { ...nutrientPlan, yeastStrain: "D47" },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 2,
  });

  const cider = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Apple Juice",
  );
  assert.equal(cider?.role, "fill_liquid");
  assert.equal(cider?.amount, undefined);
  assert.doesNotMatch(result.answer, /Water \|/);
});

test("a named fill liquid does not let a model replace a stated honey amount", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "fixed-fill-honey-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "fixed-fill-honey-build-call",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [
                      {
                        name: "Apple Juice",
                        category: "juice",
                        brix: 11,
                        amount: { kind: "weight", value: 3, unit: "lb" },
                      },
                      {
                        name: "Wildflower Honey",
                        category: "honey",
                        brix: 81,
                        amount: { kind: "weight", value: 16.24, unit: "lb" },
                      },
                      {
                        name: "Tart Cherry",
                        category: "fruit",
                        brix: 12,
                        amount: { kind: "weight", value: 6, unit: "lb" },
                      },
                      {
                        name: "Tart Cherry",
                        category: "fruit",
                        brix: 12,
                        amount: { kind: "weight", value: 6, unit: "lb" },
                        secondary: true,
                      },
                    ],
                    targetOriginalGravity: 1.1,
                    fermentationFinalGravity: 0.999,
                    stabilizers: {
                      enabled: true,
                      type: "kmeta",
                      phReading: 3.5,
                    },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon tart cherry cyser with fresh apple cider as the fill liquid, 6 lb wildflower honey in primary, and 12 lb tart cherries split evenly between primary and secondary. Target 12% ABV. Use Lalvin D47, TOSNA, and Go-Ferm. Ferment dry, then stabilize and backsweeten to 1.012.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.1,
        fermentationFinalGravity: 0.999,
        ingredients: [
          {
            name: "Apple Juice",
            category: "juice",
            brix: 11,
            role: "fill_liquid",
          },
          {
            name: "Wildflower Honey",
            category: "honey",
            brix: 81,
            amount: { kind: "weight", value: 6, unit: "lb" },
          },
          {
            name: "Tart Cherry",
            category: "fruit",
            brix: 12,
            amount: { kind: "weight", value: 6, unit: "lb" },
          },
          {
            name: "Tart Cherry",
            category: "fruit",
            brix: 12,
            amount: { kind: "weight", value: 6, unit: "lb" },
            secondary: true,
          },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
        backsweetening: { targetFinalGravity: 1.012 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 2,
  });

  const honey = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Wildflower Honey",
  );
  const cider = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Apple Juice",
  );
  assert.deepEqual(honey?.amount, { kind: "weight", value: 6, unit: "lb" });
  assert.equal(cider?.role, "fill_liquid");
  assert.doesNotMatch(result.answer, /Apple Juice \| 3 lb/i);
  assert.doesNotMatch(result.answer, /16\.24/);
});

test("a fresh fixed cyser request preserves every stated fermentable instead of trusting model quantities", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "fresh-fixed-cyser-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "fresh-fixed-cyser-build-call",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    batchVolume: { value: 5, unit: "gal" },
                    targetOriginalGravity: 1.1,
                    fermentationFinalGravity: 0.999,
                    ingredients: [
                      {
                        name: "Apple Juice",
                        category: "juice",
                        brix: 11,
                        amount: { kind: "weight", value: 6, unit: "lb" },
                      },
                      {
                        name: "Wildflower Honey",
                        category: "honey",
                        brix: 81,
                        amount: { kind: "weight", value: 11.79, unit: "lb" },
                      },
                      {
                        name: "Cherry, Tart",
                        category: "fruit",
                        brix: 12,
                        amount: { kind: "weight", value: 1.5, unit: "lb" },
                      },
                      {
                        name: "Cherry, Tart",
                        category: "fruit",
                        brix: 12,
                        amount: { kind: "weight", value: 1.5, unit: "lb" },
                        secondary: true,
                      },
                    ],
                    nutrients: nutrientPlan,
                    stabilizers: {
                      enabled: true,
                      type: "kmeta",
                      phReading: 3.5,
                    },
                    backsweetening: { targetFinalGravity: 1.012 },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon tart cherry cyser with 1 gallon fresh apple cider, 6 lb wildflower honey in primary, and 12 lb tart cherries split evenly between primary and secondary. Target 12% ABV. Use Lalvin D47, TOSNA, and Go-Ferm. Ferment dry, then stabilize and backsweeten to 1.012.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 2,
  });

  const primaryIngredients =
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.secondary !== true,
    ) ?? [];
  const honey = primaryIngredients.find(
    (ingredient) => ingredient.name === "Wildflower Honey",
  );
  const cider = primaryIngredients.find(
    (ingredient) => ingredient.name === "Apple Juice",
  );
  const cherries =
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Cherry, Tart",
    ) ?? [];
  assert.deepEqual(honey?.amount, { kind: "weight", value: 6, unit: "lb" });
  assert.deepEqual(cider?.amount, { kind: "volume", value: 1, unit: "gal" });
  assert.notEqual(cider?.role, "fill_liquid");
  assert.equal(cherries.length, 2);
  assert.deepEqual(
    cherries.map((ingredient) => ingredient.amount?.value),
    [6, 6],
  );
});

test("a fresh weighed-fruit request cannot be converted into a fixed liquid by the model", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "fresh-pear-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "fresh-pear-build-call",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    batchVolume: { value: 2, unit: "gal" },
                    targetOriginalGravity: 1.1,
                    fermentationFinalGravity: 0.999,
                    ingredients: [
                      {
                        name: "Pear",
                        category: "fruit",
                        brix: 10,
                        amount: { kind: "volume", value: 2, unit: "gal" },
                      },
                      {
                        name: "Honey",
                        category: "honey",
                        brix: 81,
                        role: "adjustable_fermentable",
                      },
                    ],
                    nutrients: nutrientPlan,
                    stabilizers: { enabled: false },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 2 gallon pear and ginger mead with 5 lb pears, 40 g fresh ginger as an additive, and enough honey for 11% ABV. Use Lalvin 71B and TOSNA with three additions. Finish dry.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const pear = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Pear",
  );
  assert.deepEqual(pear?.amount, { kind: "weight", value: 5, unit: "lb" });
  assert.doesNotMatch(result.answer, /provided liquid/i);
});

test("a culinary ingredient explicitly identified as an additive is not sent through fruit Brix intake", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "ginger-additive-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "ginger-additive-build-call",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    ingredients: [
                      {
                        name: "Fresh Ginger",
                        amount: { kind: "weight", value: 40, unit: "g" },
                      },
                    ],
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 1 gallon blueberry mead with 3 lb blueberries, 40 g fresh ginger as an additive, Lalvin 71B, TOSNA, Go-Ferm, and three nutrient additions. Finish dry.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 1, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [
          { name: "Honey", role: "adjustable_fermentable" },
          {
            name: "Blueberry",
            category: "fruit",
            brix: 10,
            amount: { kind: "weight", value: 3, unit: "lb" },
          },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: false },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 2,
  });

  assert.deepEqual(result.recipeDraftInput?.additives, [
    { name: "Fresh Ginger", amount: 40, unit: "g" },
  ]);
  assert.doesNotMatch(result.answer, /Brix|ingredient well enough/i);
});

test("a sparse provider draft call restores explicit catalog fruit instead of omitting it", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "sparse-pear-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "sparse-pear-build-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 2 gallon pear and ginger mead with exactly 5 lb fresh pears in primary and 1 oz fresh ginger in secondary. Target 11% ABV and finish medium-sweet at 1.012. Use Lalvin 71B with TOSNA, Go-Ferm, and three additions. Stabilize with potassium metabisulfite at pH 3.5 before backsweetening.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 2, unit: "gal" },
        targetOriginalGravity: 1.09,
        fermentationFinalGravity: 0.999,
        ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
        nutrients: nutrientPlan,
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    ingredientLookup: async () => [
      { id: 17, name: "Pear", category: "fruit", brix: 10 },
      { id: 19, name: "Wildflower Honey", category: "honey", brix: 81 },
    ],
  });

  const pear = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Pear",
  );
  assert.equal(pear?.catalogId, 17);
  assert.deepEqual(pear?.amount, { kind: "weight", value: 5, unit: "lb" });
  assert.match(result.answer, /Pear/);
});

test("a sparse provider draft call restores every explicitly measured catalog ingredient", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "sparse-cyser-build",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "sparse-cyser-build-tool",
                type: "function",
                function: { name: "build_recipe_draft", arguments: "{}" },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon cyser using fresh apple cider to fill the batch and exactly 6 lb wildflower honey and 12 lb tart cherries, split evenly between primary and secondary. Target 12% ABV, ferment dry, use Lalvin 71B, TOSNA with Go-Ferm and three additions. Stabilize with potassium metabisulfite at pH 3.5 and backsweeten to 1.012.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.1,
        fermentationFinalGravity: 0.999,
        nutrients: nutrientPlan,
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    ingredientLookup: async () => [
      { id: 7, name: "Apple Juice", category: "juice", brix: 11 },
      { id: 8, name: "Wildflower Honey", category: "honey", brix: 81 },
      { id: 9, name: "Cherry, Tart", category: "fruit", brix: 12 },
    ],
  });

  const cider = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Apple Juice",
  );
  const honey = result.recipeDraftInput?.ingredients.find(
    (ingredient) => ingredient.name === "Wildflower Honey",
  );
  const cherries =
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Cherry, Tart",
    ) ?? [];
  assert.equal(cider?.role, "fill_liquid");
  assert.equal(cider?.amount, undefined);
  assert.deepEqual(honey?.amount, { kind: "weight", value: 6, unit: "lb" });
  assert.deepEqual(
    cherries.map((ingredient) => ingredient.amount?.value),
    [6, 6],
  );
  assert.doesNotMatch(
    result.answer,
    /Which fermentables and ingredient additions/i,
  );
});

test("an explicitly authorized beginner request builds instead of stopping at a plan", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        const functionName =
          calls === 1
            ? "calculate_gravity_target"
            : calls === 2
              ? "search_yeasts"
              : "build_recipe_draft";
        return {
          id: `authorized-beginner-${calls}`,
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: `authorized-beginner-${functionName}`,
                type: "function",
                function: {
                  name: functionName,
                  arguments:
                    functionName === "calculate_gravity_target"
                      ? // A provider can confuse a requested medium-sweet finish
                        // with the dry-fermentation FG used for the ABV target.
                        JSON.stringify({
                          targetAbv: 10,
                          fermentationFinalGravity: 1.015,
                        })
                      : functionName === "search_yeasts"
                        ? JSON.stringify({ query: "D47" })
                        : "{}",
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "I am brand new. Please make a 1 gallon medium-sweet traditional mead about 10% ABV. Choose a suitable yeast and use TOSNA with Go-Ferm and three additions. I am okay with your defaults.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 4,
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B-1122",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 15,
        highTemperature: 30,
      },
    ],
  });

  assert.equal(calls, 3);
  assert.match(result.answer, /^## Unsaved MeadTools recipe draft/);
  assert.equal(result.recipeDraftInput?.nutrients?.yeastId, 71);
  assert.equal(result.recipeDraftInput?.fermentationFinalGravity, 0.999);
  const expectedGravity = calculateGravityTarget({
    targetAbv: 10,
    fermentationFinalGravity: 0.999,
  });
  assert.equal(expectedGravity.status, "calculation");
  if (expectedGravity.status !== "calculation") return;
  assert.equal(
    result.recipeDraftInput?.targetOriginalGravity,
    expectedGravity.targetOriginalGravity,
  );
  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.015,
  );
});

test("a fixed recipe reconciles its stated yeast when the initial workflow call omits it", async () => {
  let calls = 0;
  const result = await runChatTurn({
    client: {
      async complete() {
        calls += 1;
        const functionName =
          calls === 1
            ? "build_recipe_draft"
            : calls === 2
              ? "search_yeasts"
              : "build_recipe_draft";
        return {
          id: `fixed-yeast-followup-${calls}`,
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: `fixed-yeast-followup-${functionName}`,
                type: "function",
                function: {
                  name: functionName,
                  arguments:
                    functionName === "search_yeasts"
                      ? JSON.stringify({ query: "71B" })
                      : "{}",
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon cyser using fresh apple cider to fill the batch and exactly 6 lb wildflower honey and 12 lb tart cherries, split evenly between primary and secondary. Target 12% ABV, ferment dry, use Lalvin 71B, TOSNA with Go-Ferm and three additions. Stabilize with potassium metabisulfite at pH 3.5 and backsweeten to 1.012.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 3,
    ingredientLookup: async () => [
      { id: 7, name: "Apple Juice", category: "juice", brix: 11 },
      { id: 8, name: "Wildflower Honey", category: "honey", brix: 81 },
      { id: 9, name: "Cherry, Tart", category: "fruit", brix: 12 },
    ],
    yeastLookup: async () => [
      {
        id: 71,
        brand: "Lalvin",
        name: "71B-1122",
        nitrogenRequirement: "Low",
        tolerance: 14,
        lowTemperature: 15,
        highTemperature: 30,
      },
    ],
  });

  assert.equal(calls, 1);
  assert.deepEqual(
    result.toolResults.map((tool) => tool.toolName),
    ["build_recipe_draft"],
  );
  assert.equal(result.recipeDraftInput?.nutrients?.yeastId, 71);
  assert.doesNotMatch(
    result.answer,
    /MeadTools still needs yeast brand and strain/i,
  );
});

test("a recipe refinement replaces the previously stated primary fruit amount", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "cranberry-refinement",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "cranberry-refinement-build",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    batchVolume: { value: 5, unit: "gal" },
                    targetOriginalGravity: 1.11,
                    fermentationFinalGravity: 0.999,
                    ingredients: [
                      {
                        name: "Cranberry",
                        category: "fruit",
                        brix: 7,
                        amount: { kind: "weight", value: 8, unit: "lb" },
                      },
                      {
                        name: "Cranberry",
                        category: "fruit",
                        brix: 7,
                        amount: { kind: "weight", value: 8, unit: "lb" },
                        secondary: true,
                      },
                      {
                        name: "Honey",
                        category: "honey",
                        brix: 81,
                        role: "adjustable_fermentable",
                      },
                    ],
                    nutrients: nutrientPlan,
                    stabilizers: {
                      enabled: true,
                      type: "kmeta",
                      phReading: 3.5,
                    },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 5 gallon cranberry mead with 8 lb cranberry in primary.",
        },
        { role: "assistant", content: "Draft ready." },
        {
          role: "user",
          content:
            "Change that to 5 lb of cranberry in primary plus 5 lb in secondary; keep the rest the same.",
        },
      ],
      recipeDraftInput: {
        batchVolume: { value: 5, unit: "gal" },
        targetOriginalGravity: 1.11,
        fermentationFinalGravity: 0.999,
        ingredients: [
          {
            name: "Cranberry",
            category: "fruit",
            brix: 7,
            amount: { kind: "weight", value: 8, unit: "lb" },
          },
          {
            name: "Honey",
            category: "honey",
            brix: 81,
            role: "adjustable_fermentable",
          },
        ],
        nutrients: nutrientPlan,
        stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 },
      },
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const cranberries =
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Cranberry",
    ) ?? [];
  assert.deepEqual(
    cranberries.map((ingredient) => ingredient.amount?.value),
    [5, 5],
  );
  assert.deepEqual(
    cranberries.map((ingredient) => ingredient.secondary === true),
    [false, true],
  );
});

test("explicit primary and secondary honey amounts and pH override model defaults", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "elderberry-explicit-values",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "elderberry-explicit-values-build",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    batchVolume: { value: 2, unit: "gal" },
                    targetOriginalGravity: 1.1,
                    fermentationFinalGravity: 0.999,
                    ingredients: [
                      {
                        name: "Honey",
                        category: "honey",
                        brix: 81,
                        amount: { kind: "weight", value: 5, unit: "lb" },
                      },
                      {
                        name: "Elderberry",
                        category: "fruit",
                        brix: 12,
                        amount: { kind: "weight", value: 2, unit: "lb" },
                      },
                      {
                        name: "Elderberry",
                        category: "fruit",
                        brix: 12,
                        amount: { kind: "weight", value: 1, unit: "lb" },
                        secondary: true,
                      },
                      {
                        name: "Honey",
                        category: "honey",
                        brix: 81,
                        amount: { kind: "weight", value: 5, unit: "lb" },
                        secondary: true,
                      },
                    ],
                    nutrients: nutrientPlan,
                    stabilizers: {
                      enabled: true,
                      type: "kmeta",
                      phReading: 3.5,
                    },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Create a 2 gallon elderberry mead with 5 lb honey and 2 lb elderberry in primary; 1 lb elderberry and 12 oz honey in secondary. Stabilize and backsweeten; assume pH 3.6.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  const honey =
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Honey",
    ) ?? [];
  assert.deepEqual(
    honey.map((ingredient) => ingredient.amount),
    [
      { kind: "weight", value: 5, unit: "lb" },
      { kind: "weight", value: 12, unit: "oz" },
    ],
  );
  const elderberry =
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Elderberry",
    ) ?? [];
  assert.deepEqual(
    elderberry.map((ingredient) => ingredient.amount),
    [
      { kind: "weight", value: 2, unit: "lb" },
      { kind: "weight", value: 1, unit: "lb" },
    ],
  );
  assert.equal(result.recipeDraftInput?.stabilizers?.phReading, 3.6);
  assert.doesNotMatch(result.answer, /assumed pH of 3\.5/i);
});

test("an explicit secondary fruit weight overrides a model-supplied volume", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "secondary-fruit-weight",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "secondary-fruit-weight-build",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    batchVolume: { value: 1, unit: "gal" },
                    targetOriginalGravity: 1.1,
                    fermentationFinalGravity: 0.999,
                    ingredients: [
                      {
                        name: "Honey",
                        category: "honey",
                        brix: 81,
                        role: "adjustable_fermentable",
                      },
                      {
                        name: "Raspberry",
                        category: "fruit",
                        brix: 4.98,
                        amount: { kind: "volume", value: 3, unit: "gal" },
                        secondary: true,
                      },
                    ],
                    nutrients: nutrientPlan,
                    stabilizers: {
                      enabled: true,
                      type: "kmeta",
                      phReading: 3.5,
                    },
                    backsweetening: { targetFinalGravity: 1.015 },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 1 gallon raspberry mead with 3 lb of raspberries in secondary, around 12% ABV, Lalvin 71B, TOSNA with three additions, and standard Go-Ferm. Stabilize and backsweeten to 1.015.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
    ingredientLookup: async () => [
      { id: 55, name: "Raspberry", category: "fruit", brix: 4.98 },
    ],
  });

  const raspberries =
    result.recipeDraftInput?.ingredients.filter(
      (ingredient) => ingredient.name === "Raspberry",
    ) ?? [];
  const raspberry = raspberries[0];
  assert.deepEqual(raspberry?.amount, { kind: "weight", value: 3, unit: "lb" });
  assert.equal(raspberry?.secondary, true);
  assert.equal(raspberries.length, 1);
});

test("an unquantified secondary adjustable honey placeholder is removed", async () => {
  const result = await runChatTurn({
    client: {
      async complete() {
        return {
          id: "stray-secondary-honey",
          model: "test-model",
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "stray-secondary-honey-build",
                type: "function",
                function: {
                  name: "build_recipe_draft",
                  arguments: JSON.stringify({
                    batchVolume: { value: 5, unit: "gal" },
                    targetOriginalGravity: 1.08,
                    fermentationFinalGravity: 0.999,
                    ingredients: [
                      {
                        name: "Wildflower Honey",
                        category: "honey",
                        brix: 81,
                        role: "adjustable_fermentable",
                      },
                      {
                        name: "Honey",
                        category: "honey",
                        brix: 81,
                        role: "adjustable_fermentable",
                        secondary: true,
                      },
                      {
                        name: "Apple Juice",
                        category: "juice",
                        brix: 10.3,
                        role: "fill_liquid",
                      },
                    ],
                    nutrients: nutrientPlan,
                    stabilizers: {
                      enabled: true,
                      type: "kmeta",
                      phReading: 3.5,
                    },
                    backsweetening: { targetFinalGravity: 1.012 },
                  }),
                },
              },
            ],
          },
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14,
            cachedInputTokens: 0,
          },
        };
      },
    },
    userId: 7,
    request: chatRequestSchema.parse({
      messages: [
        {
          role: "user",
          content:
            "Draft a 5 gallon medium-sweet cyser at 10% ABV with wildflower honey and apple juice as the fill liquid. Stabilize and backsweeten to 1.012.",
        },
      ],
    }),
    maxOutputTokens: 4_000,
    maxToolCalls: 1,
  });

  assert.ok(
    result.recipeDraftInput?.ingredients.every(
      (ingredient) =>
        !(
          ingredient.secondary === true &&
          ingredient.name === "Honey" &&
          ingredient.amount === undefined
        ),
    ),
  );
  assert.equal(
    result.recipeDraftInput?.backsweetening?.targetFinalGravity,
    1.012,
  );
});
