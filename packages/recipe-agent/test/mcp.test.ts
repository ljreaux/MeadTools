import assert from "node:assert/strict";
import test from "node:test";
import {
  executeHostedAgentTool,
  executeMcpAgentTool,
  mcpAgentToolDefinitions,
  mcpAgentToolNames
} from "../src/index";

test("MCP advertises only the reviewed read-only tool allowlist", () => {
  assert.deepEqual(
    mcpAgentToolDefinitions.map((tool) => tool.name).sort(),
    [...mcpAgentToolNames].sort()
  );
});

test("MCP calculation uses the same result as hosted chat", async () => {
  const input = { targetAbv: 12, fermentationFinalGravity: 1.005 };
  assert.deepEqual(
    await executeMcpAgentTool("calculate_gravity_target", input),
    await executeHostedAgentTool("calculate_gravity_target", input)
  );
});

test("all seven original MCP tools preserve successful shared execution without account access", async () => {
  const options: NonNullable<Parameters<typeof executeMcpAgentTool>[2]> = {
    ingredientLookup: async () => [
      { id: 42, name: "Blackberries", category: "fruit", brix: 10 }
    ],
    additiveLookup: async () => [
      { id: "bentonite", name: "Bentonite", dosagePerGallon: 6, unit: "g" }
    ],
    yeastLookup: async () => [
      {
        id: 101,
        brand: "Red Star",
        name: "Premier Rouge",
        nitrogenRequirement: "Medium",
        tolerance: 15,
        lowTemperature: 64,
        highTemperature: 86
      }
    ],
    fetcher: async () => ({
      ok: true,
      status: 200,
      url: "https://wiki.meadtools.com/en/home",
      headers: {
        get: (name) => (name === "content-type" ? "text/html" : null)
      },
      text: async () =>
        "<title>Wiki Home</title><main>Offline brewing reference</main>"
    })
  };
  for (const [name, input] of [
    ["search_ingredients", {}],
    ["search_additives", {}],
    ["search_yeasts", { query: "Premier Rouge" }],
    ["search_wiki", { query: "stabilization" }],
    ["fetch_wiki_page", { url: "/en/home" }],
    [
      "calculate_gravity_target",
      { targetAbv: 12, fermentationFinalGravity: 1.005 }
    ],
    [
      "build_recipe_draft",
      {
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
          goFermType: "Go-Ferm"
        },
        stabilizers: { enabled: false }
      }
    ]
  ] as const) {
    const result = await executeMcpAgentTool(name, input, options);
    assert.equal(result.status, "ok", name);
    assert.deepEqual(
      result,
      await executeHostedAgentTool(name, input, options),
      name
    );
  }
});

test("MCP refuses hosted-only context and proposal tools", async () => {
  for (const name of [
    "get_selected_account_context",
    "record_recipe_plan",
    "explain_recipe",
    "prepare_brew_action"
  ]) {
    assert.deepEqual(await executeMcpAgentTool(name, {}), {
      status: "unknown_tool",
      toolName: name
    });
  }
});
