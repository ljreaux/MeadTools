import assert from "node:assert/strict";
import test from "node:test";
import {
  createWikiAgentTools,
  executeGravityTargetAgentTool,
  executePrepareBrewActionTool,
  executeRecordRecipePlanAgentTool,
  executeRecipeAgentTool,
  executeHostedAgentTool,
  hostedAgentToolDefinitions,
  hostedAgentTools,
  recipeAgentTools,
} from "../src/index";
import { hostedPocEvaluations } from "../eval/hosted-poc";
import { hostedAgentPolicy } from "../src/policy";

test("the provider-neutral registry exposes only deterministic recipe workflows", () => {
  assert.deepEqual(
    recipeAgentTools.map((tool) => tool.name),
    ["build_recipe_draft", "explain_recipe"],
  );
});

test("agent tool execution delegates general recipe drafting to the shared workflow", () => {
  const execution = executeRecipeAgentTool("build_recipe_draft", {
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.996,
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    nutrients: {
      enabled: true,
      yeastBrand: "Lalvin",
      yeastStrain: "71B",
      nitrogenRequirement: "Medium",
      schedule: "tosna",
      numberOfAdditions: 4,
      goFermType: "Go-Ferm",
    },
    stabilizers: { enabled: false },
  });

  assert.equal(execution.status, "ok");
  if (execution.status !== "ok") return;
  assert.equal(execution.result.operation, "build_recipe_draft");
  assert.equal(execution.result.status, "recipe");
});

test("a recipe plan records validated partial draft context without calculating", () => {
  const execution = executeRecordRecipePlanAgentTool({
    plan: {
      batchVolume: { value: 1, unit: "gal" },
      ingredients: [
        { name: "Raspberry", catalogId: 11, category: "fruit", brix: 8 },
      ],
      assumptions: ["Use raspberries in a beginner-friendly fruit mead."],
    },
  });

  assert.equal(execution.status, "ok");
  if (execution.status !== "ok") return;
  assert.equal(execution.result.plan.batchVolume?.value, 1);
  assert.equal(execution.result.plan.ingredients[0]?.name, "Raspberry");
  assert.equal(
    execution.result.plan.assumptions[0],
    "Use raspberries in a beginner-friendly fruit mead.",
  );
});

test("gravity target tool delegates ABV target math to the shared workflow", () => {
  const execution = executeGravityTargetAgentTool({
    targetAbv: 16,
    fermentationFinalGravity: 1.025,
    additionalOgPoints: 10,
  });

  assert.equal(execution.status, "ok");
  assert.equal(execution.result.status, "calculation");
  if (execution.result.status !== "calculation") return;
  assert.ok(
    execution.result.targetOriginalGravity >
      execution.result.baseOriginalGravity,
  );
});

test("brew action proposals require a trusted selected brew target", () => {
  const input = {
    type: "ADDITION",
    data: { kind: "OTHER", name: "Vanilla bean", amount: 1, unit: "units" },
  };
  const withoutTarget = executePrepareBrewActionTool(input, undefined);
  assert.deepEqual(withoutTarget, {
    status: "error",
    message:
      "Select a brew and retrieve its context before preparing an action.",
  });

  const execution = executePrepareBrewActionTool(input, {
    brewId: "11111111-1111-4111-8111-111111111111",
    brewLabel: "Brew: Summer Traditional",
  });
  assert.equal(execution.status, "ok");
  if (execution.status !== "ok") return;
  assert.equal(
    execution.result.target.brewId,
    "11111111-1111-4111-8111-111111111111",
  );
  assert.equal(execution.result.entry.type, "ADDITION");
  assert.equal(
    execution.result.summary,
    "Log 1 units Vanilla bean as an addition.",
  );
});

test("brew action proposals accept case-insensitive model enum values", () => {
  const execution = executePrepareBrewActionTool(
    {
      type: "note",
      title: "Gravity sample observation",
      note: "The sample looked clear.",
    },
    {
      brewId: "11111111-1111-4111-8111-111111111111",
      brewLabel: "Brew: Summer Traditional",
    },
  );

  assert.equal(execution.status, "ok");
  if (execution.status !== "ok") return;
  assert.equal(execution.result.entry.type, "NOTE");
});

test("brew action proposals recover a note when a provider omits its discriminator", () => {
  const execution = executePrepareBrewActionTool(
    { title: "Gravity sample observation", note: "The sample looked clear." },
    {
      brewId: "11111111-1111-4111-8111-111111111111",
      brewLabel: "Brew: Summer Traditional",
    },
  );

  assert.equal(execution.status, "ok");
  if (execution.status !== "ok") return;
  assert.equal(execution.result.entry.type, "NOTE");
});

test("unknown provider tool names are rejected before workflow execution", () => {
  const execution = executeRecipeAgentTool("calculate_recipe", {});
  assert.deepEqual(execution, {
    status: "unknown_tool",
    toolName: "calculate_recipe",
  });
});

test("wiki search exposes a small catalog result set without fetching pages", async () => {
  const search = createWikiAgentTools().find(
    (tool) => tool.name === "search_wiki",
  );
  assert.ok(search);

  const execution = await search.execute({ query: "nutrient schedule" });
  assert.equal(execution.status, "ok");
  if (execution.status !== "ok") return;
  assert.ok(Array.isArray(execution.result));
  assert.equal(execution.result[0]?.title, "Nutrient Schedules");
});

test("ingredient catalog exposes every authoritative ingredient through an injected lookup", async () => {
  const execution = await executeHostedAgentTool(
    "search_ingredients",
    {},
    {
      ingredientLookup: async () => [
        { id: 42, name: "Blackberries", category: "fruit", brix: 10 },
        { id: 43, name: "Blueberries", category: "fruit", brix: 12 },
      ],
    },
  );

  assert.equal(execution.status, "ok");
  if (execution.status !== "ok" || !Array.isArray(execution.result)) return;
  assert.deepEqual(execution.result, [
    { id: 42, name: "Blackberries", category: "fruit", brix: 10 },
    { id: 43, name: "Blueberries", category: "fruit", brix: 12 },
  ]);
});

test("additive catalog exposes canonical per-gallon dosage units through an injected lookup", async () => {
  const execution = await executeHostedAgentTool(
    "search_additives",
    {},
    {
      additiveLookup: async () => [
        {
          id: "pectic-enzyme",
          name: "Pectic Enzyme",
          dosagePerGallon: 0.4,
          unit: "tsp",
        },
        { id: "bentonite", name: "Bentonite", dosagePerGallon: 6, unit: "g" },
      ],
    },
  );

  assert.equal(execution.status, "ok");
  if (execution.status !== "ok" || !Array.isArray(execution.result)) return;
  assert.deepEqual(execution.result, [
    {
      id: "pectic-enzyme",
      name: "Pectic Enzyme",
      dosagePerGallon: 0.4,
      unit: "tsp",
    },
    { id: "bentonite", name: "Bentonite", dosagePerGallon: 6, unit: "g" },
  ]);
  assert.ok(
    hostedAgentToolDefinitions.some((tool) => tool.name === "search_additives"),
  );
});

test("yeast search exposes authoritative nutrient inputs through an injected lookup", async () => {
  const execution = await executeHostedAgentTool(
    "search_yeasts",
    { query: "Premier Rouge" },
    {
      yeastLookup: async (query, limit) => {
        assert.equal(query, "Premier Rouge");
        assert.equal(limit, 5);
        return [
          {
            id: 101,
            brand: "Red Star",
            name: "Premier Rouge (Pasteur Red)",
            nitrogenRequirement: "Medium",
            tolerance: 15,
            lowTemperature: 64,
            highTemperature: 86,
          },
        ];
      },
    },
  );

  assert.equal(execution.status, "ok");
  if (execution.status !== "ok" || !Array.isArray(execution.result)) return;
  assert.deepEqual(execution.result[0], {
    id: 101,
    brand: "Red Star",
    name: "Premier Rouge (Pasteur Red)",
    nitrogenRequirement: "Medium",
    tolerance: 15,
    lowTemperature: 64,
    highTemperature: 86,
  });
});

test("wiki page fetches retain the constrained wiki retrieval contract", async () => {
  const execution = await executeHostedAgentTool(
    "fetch_wiki_page",
    { url: "/en/home" },
    {
      fetcher: async () => ({
        ok: true,
        status: 200,
        url: "https://wiki.meadtools.com/en/home",
        headers: {
          get: (name) => (name === "content-type" ? "text/html" : null),
        },
        text: async () =>
          "<title>Wiki Home</title><main>Trusted guidance</main>",
      }),
    },
  );

  assert.equal(execution.status, "ok");
  if (execution.status !== "ok" || !("url" in execution.result)) return;
  assert.equal(execution.result.url, "https://wiki.meadtools.com/en/home");
  assert.match(execution.result.text, /Trusted guidance/);
});

test("a constrained wiki fetch cannot switch from a process result to a recipe page", async () => {
  let fetched = false;
  const execution = await executeHostedAgentTool(
    "fetch_wiki_page",
    { url: "https://wiki.meadtools.com/en/recipes/beginner/0001" },
    {
      allowedWikiFetchUrls: [
        "https://wiki.meadtools.com/en/process/process_summary",
      ],
      fetcher: async () => {
        fetched = true;
        throw new Error("The rejected wiki page must not be fetched.");
      },
    },
  );

  assert.equal(execution.status, "invalid_input");
  assert.equal(fetched, false);
  if (execution.status !== "invalid_input") return;
  assert.match(
    execution.issues.join(" "),
    /non-recipe page returned by the current wiki search/i,
  );
});

test("wiki tools return validation errors without calling retrieval", async () => {
  const execution = await executeHostedAgentTool("fetch_wiki_page", {
    url: "",
  });
  assert.equal(execution.status, "invalid_input");
  if (execution.status !== "invalid_input") return;
  assert.match(execution.issues.join(" "), /url/);
});

test("POC evaluation cases reference only the hosted tool surface", () => {
  const toolNames = new Set([...hostedAgentTools.map((tool) => tool.name)]);

  for (const evaluation of hostedPocEvaluations) {
    assert.ok(
      evaluation.expectedToolSequence.length <=
        hostedAgentPolicy.maxToolCallsPerTurn,
    );
    for (const toolName of evaluation.expectedToolSequence) {
      assert.ok(
        toolNames.has(toolName),
        `${evaluation.id} references ${toolName}`,
      );
    }
  }

  const wikiGrounded = hostedPocEvaluations.find(
    (evaluation) => evaluation.id === "wiki-grounded-nutrient-guidance",
  );
  assert.deepEqual(wikiGrounded?.expectedToolSequence, [
    "search_wiki",
    "fetch_wiki_page",
  ]);
  assert.equal(wikiGrounded?.citationRequired, true);
});

test("provider tool definitions stay aligned with the executable tool surface", () => {
  assert.deepEqual(
    hostedAgentToolDefinitions.map((tool) => tool.name),
    hostedAgentTools.map((tool) => tool.name),
  );
  assert.equal(
    hostedAgentToolDefinitions.find(
      (tool) => tool.name === "build_recipe_draft",
    )?.parameters["additionalProperties"],
    false,
  );
  const draftProperties = hostedAgentToolDefinitions.find(
    (tool) => tool.name === "build_recipe_draft",
  )?.parameters["properties"];
  assert.ok(
    !(
      typeof draftProperties === "object" &&
      draftProperties !== null &&
      "deferredAdditives" in draftProperties
    ),
  );
  assert.ok(
    hostedAgentToolDefinitions.some(
      (tool) => tool.name === "prepare_brew_action",
    ),
  );
});

test("hosted policy distinguishes wiki guidance from brief general context", () => {
  assert.ok(
    hostedAgentPolicy.instructions.some((instruction) =>
      instruction.includes("General brewing context"),
    ),
  );
  assert.ok(
    hostedAgentPolicy.instructions.some((instruction) =>
      instruction.includes("cite the canonical URL"),
    ),
  );
  assert.ok(
    hostedAgentPolicy.instructions.some((instruction) =>
      instruction.includes("fixed fermentable amounts"),
    ),
  );
  assert.ok(
    hostedAgentPolicy.instructions.some((instruction) =>
      instruction.includes("clearly labelled fruit-load assumption"),
    ),
  );
  assert.ok(
    hostedAgentPolicy.instructions.some(
      (instruction) =>
        /medium-sweet/i.test(instruction) &&
        /stabili[sz]ation/i.test(instruction) &&
        /backsweetening/i.test(instruction) &&
        /stopping fermentation early/i.test(instruction),
    ),
  );
});
