import assert from "node:assert/strict";
import test from "node:test";
import {
  executeMcpAgentTool,
  executeHostedAgentTool,
  executeRecipeAgentTool,
  publicReadInputSchemas,
  publicReadOutputSchemas,
  publicReadToolNames,
  mcpAgentToolDefinitions,
  projectAccountRecipe,
  type PublicReadAdapter,
  type PublicRecord,
  type PublicFilters,
} from "../src/index";
const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function recipeData() {
  const draft = executeRecipeAgentTool("build_recipe_draft", {
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
  assert.ok(draft.status === "ok" && draft.result.status === "recipe");
  const data = draft.result.recipeData;
  data.ingredients[0].ref = { kind: "catalog", ingredientId: "42" };
  data.nutrients!.selected.yeastId = 71;
  data.notes.primary.push({
    lineId: "private",
    content: ["PRIVATE_NOTE", "DO_NOT_EXPOSE"],
  });
  return data;
}
function brew(n: number, data: unknown = recipeData()): PublicRecord {
  return {
    kind: "brew",
    id: uuid(n),
    name: "Same",
    recipeId: 1,
    data,
    stage: "COMPLETE",
    startDate: "2026-10-01T00:00:00Z",
    endDate: "2026-10-11T00:00:00Z",
    currentVolumeLiters: 3,
    measuredOg: { sg: 1.1, at: "2026-10-01T00:00:00Z" },
    measuredFg: { sg: 1.01, at: "2026-10-10T00:00:00Z" },
  };
}
function source(rows: PublicRecord[]): PublicReadAdapter {
  return {
    origin: "https://meadtools.com",
    candidates: async () => rows,
    get: async (kind, key) =>
      rows.find((r) => r.kind === kind && r.id === key) ?? null,
  };
}
async function run(
  name: (typeof publicReadToolNames)[number],
  input: unknown,
  adapter: PublicReadAdapter,
) {
  const result = await executeMcpAgentTool(name, input, {
    publicReadAdapter: adapter,
  });
  assert.ok(
    publicReadOutputSchemas[name].safeParse(result).success,
    JSON.stringify(result),
  );
  return result as any;
}

test("public strict schemas reject unsupported criteria, identity injection, ranges, cursors and bad dates before reads", async () => {
  let reads = 0;
  const adapter = {
    ...source([]),
    candidates: async () => {
      reads++;
      return [];
    },
  };
  for (const input of [
    { userId: 7 },
    { filters: { private: true } },
    { filters: { measuredFg: { min: 1 } } },
    { filters: { estimatedAbvPercent: { min: 12, max: 10 } } },
    { filters: { volume: { unit: "g", range: { min: 1 } } } },
    { filters: { originalGravitySg: {} } },
    { limit: 21 },
    { cursor: "1" },
    { sort: "name" },
    {
      filters: {
        startedFrom: "2026-10-03T00:00:00Z",
        startedTo: "2026-10-01T00:00:00Z",
      },
    },
  ])
    assert.equal(
      (await run("search_public_brews", input, adapter)).status,
      "invalid_input",
    );
  assert.equal(reads, 0);
  assert.equal(
    publicReadInputSchemas.search_public_recipes.safeParse({
      filters: { stage: "COMPLETE" },
    }).success,
    false,
  );
  assert.equal(
    publicReadInputSchemas.get_public_recipe.safeParse({
      id: 1,
      url: "https://meadtools.com/recipes/1",
    }).success,
    false,
  );
});

test("catalog combinations and inclusive normalized ranges use authoritative snapshot estimates", async () => {
  const data = recipeData(),
    projected = projectAccountRecipe(data).derivedEstimates!;
  const adapter = source([brew(1, data), brew(2, null)]);
  const filters: PublicFilters = {
    ingredientId: 42,
    yeastId: 71,
    estimatedAbvPercent: {
      min: projected.alcohol.abv!,
      max: projected.alcohol.abv!,
    },
    originalGravitySg: {
      min: projected.gravity.ogPrimary!,
      max: projected.gravity.ogPrimary!,
    },
    finalGravitySg: { min: 0.996, max: 0.996 },
  };
  for (const [unit, multiplier] of [
    ["L", 1],
    ["mL", 1000],
    ["gal", 1 / 3.785411784],
  ] as const) {
    const liters = projected.volume.bottlingL!;
    const result = await run(
      "search_public_brews",
      {
        filters: {
          ...filters,
          volume: {
            unit,
            range: {
              min: liters * multiplier - 1e-10,
              max: liters * multiplier + 1e-10,
            },
          },
        },
      },
      adapter,
    );
    assert.equal(result.result.cohortCount, 1);
    assert.equal(
      result.result.items[0].snapshot.estimates.finishedAbvPercent,
      projected.alcohol.abv,
    );
    assert.equal(
      result.result.items[0].snapshot.estimates.fermentationTargetFgSg,
      0.996,
    );
    assert.equal(result.result.items[0].measuredFg.sg, 1.01);
  }
  for (const filters of [
    { yeastId: 72 },
    { ingredientId: 43 },
    { estimatedAbvPercent: { max: 0 } },
    { finalGravitySg: { min: 1.1 } },
  ])
    assert.equal(
      (await run("search_public_brews", { filters }, adapter)).result
        .cohortCount,
      0,
    );
  const custom = recipeData();
  custom.ingredients[0].ref = { kind: "custom" };
  assert.equal(
    (
      await run(
        "search_public_brews",
        { filters: { ingredientId: 42 } },
        source([brew(1, custom)]),
      )
    ).result.cohortCount,
    0,
  );
});

test("stable pagination preserves duplicate names and full cohort counts across partial pages", async () => {
  const rows = [brew(1), brew(3), brew(2)];
  const a = await run("search_public_brews", { limit: 1 }, source(rows));
  const b = await run(
    "search_public_brews",
    { limit: 1, cursor: a.result.page.nextCursor },
    source(rows),
  );
  const c = await run(
    "search_public_brews",
    { limit: 1, cursor: b.result.page.nextCursor },
    source(rows),
  );
  assert.deepEqual(
    [a, b, c].map((v) => v.result.items[0].id),
    [uuid(3), uuid(2), uuid(1)],
  );
  assert.equal(c.result.page.hasMore, false);
  assert.equal(a.result.page.scope, "requested_page");
  assert.equal(a.result.cohortCount, 3);
  const recipeRows: PublicRecord[] = [2, 11, 1].map((n) => ({
    kind: "recipe",
    id: n,
    name: "Same",
    data: null,
  }));
  const r = await run(
    "search_public_recipes",
    { limit: 1 },
    source(recipeRows),
  );
  assert.equal(r.result.items[0].id, 11);
  assert.equal(
    (
      await run(
        "search_public_recipes",
        { cursor: r.result.page.nextCursor },
        source(recipeRows),
      )
    ).result.items[0].id,
    2,
  );
});

test("full cohort summaries deduplicate brews and disclose missing readings, snapshots and invalid duration", async () => {
  const b = brew(2, null);
  assert.equal(b.kind, "brew");
  if (b.kind !== "brew") return;
  b.measuredFg = null;
  b.endDate = null;
  const c = brew(3);
  if (c.kind !== "brew") return;
  c.endDate = "2026-09-01T00:00:00Z";
  c.measuredOg = null;
  c.measuredFg = { sg: 1.02, at: "2026-10-11T00:00:00Z" };
  const rows = [brew(1), b, c, brew(1)];
  const output = await run("summarize_public_brews", {}, source(rows));
  assert.equal(output.result.coverage, "complete_matching_cohort_at_read_time");
  assert.equal(output.result.cohortCount, 3);
  assert.equal(output.result.unsupportedSnapshots, 1);
  assert.deepEqual(output.result.recordedLifecycleDays, {
    usable: 1,
    missing: 2,
    minimum: 10,
    maximum: 10,
    mean: 10,
  });
  assert.equal(output.result.measuredFgSg.usable, 2);
  assert.equal(output.result.measuredFgSg.missing, 1);
  assert.equal(output.result.measuredFgSg.mean, 1.0150000000000001);
  assert.equal(output.result.measuredOgSg.usable, 2);
  assert.match(output.result.caveat, /selected and incomplete/);
  const empty = await run("summarize_public_brews", {}, source([]));
  assert.deepEqual(empty.result.measuredOgSg, {
    usable: 0,
    missing: 0,
    minimum: null,
    maximum: null,
    mean: null,
  });
  for (const name of [
    "search_public_brews",
    "summarize_public_brews",
  ] as const) {
    const broad = await run(
      name,
      {},
      source(Array.from({ length: 201 }, (_, n) => brew(n + 1))),
    );
    assert.equal(broad.status, "too_broad");
    assert.equal("result" in broad, false);
  }
});

test("details recognize only canonical typed URLs and exclude arbitrary/notes/private fields", async () => {
  const data = recipeData(),
    before = structuredClone(data);
  const rows: PublicRecord[] = [
    { kind: "recipe", id: 1, name: "UNTRUSTED " + "x".repeat(200), data },
    brew(1, data),
  ];
  (rows[0] as any).email = "PRIVATE_EMAIL";
  (rows[1] as any).device_id = "PRIVATE_DEVICE";
  const adapter = source(rows);
  for (const [name, url] of [
    ["get_public_recipe", "https://meadtools.com/en/recipes/1"],
    ["get_public_brew", `https://meadtools.com/de/recipes/1/brews/${uuid(1)}`],
  ] as const) {
    const result = await run(name, { url }, adapter);
    assert.equal(result.status, "ok");
    assert.match(
      result.result.record.appUrl,
      /https:\/\/meadtools.com\/recipes\/1/,
    );
    assert.doesNotMatch(
      JSON.stringify(result),
      /PRIVATE_NOTE|DO_NOT_EXPOSE|PRIVATE_EMAIL|PRIVATE_DEVICE|dataV2|user_id|recipe_snapshot/,
    );
  }
  for (const url of [
    "https://evil.test/recipes/1",
    "https://meadtools.com/recipes/1?owner=7",
    `https://meadtools.com/recipes/1/brews/${uuid(1)}`,
    "https://meadtools.com/account/recipes/1",
  ]) {
    assert.equal(
      (await run("get_public_recipe", { url }, adapter)).status,
      "invalid_input",
    );
  }
  assert.equal(
    (
      await run(
        "get_public_brew",
        { url: `https://meadtools.com/recipes/2/brews/${uuid(1)}` },
        adapter,
      )
    ).status,
    "not_found",
  );
  assert.deepEqual(data, before);
  rows.splice(0, rows.length);
  assert.equal(
    (await run("get_public_recipe", { id: 1 }, adapter)).status,
    "not_found",
  );
  assert.equal(
    (await run("get_public_brew", { id: uuid(1) }, adapter)).status,
    "not_found",
  );
});

test("legacy/oversized records are explicit, errors stay generic and hosted/MCP use the same operations", async () => {
  const rows: PublicRecord[] = [
    { kind: "recipe", id: 1, name: "Legacy", data: null },
    { kind: "recipe", id: 2, name: "Large", data: { oversized: true } },
  ];
  const adapter = source(rows);
  const result = await run("search_public_recipes", {}, adapter);
  assert.equal(result.result.unsupportedSnapshots, 2);
  assert.equal(result.result.items[0].recipe.reason, "exceeds_safe_bounds");
  assert.equal(result.result.items[1].recipe.reason, "missing_or_legacy");
  assert.deepEqual(
    await executeHostedAgentTool(
      "search_public_recipes",
      {},
      { publicReadAdapter: adapter },
    ),
    result,
  );
  assert.equal(
    (await executeMcpAgentTool("get_public_recipe", { id: 1 })).status,
    "unavailable",
  );
  assert.deepEqual(
    await run(
      "search_public_recipes",
      {},
      {
        ...adapter,
        candidates: async () => {
          throw new Error("SECRET_SQL");
        },
      },
    ),
    { status: "error", message: "Public discovery failed." },
  );
  for (const name of publicReadToolNames) {
    const definition = mcpAgentToolDefinitions.find((t) => t.name === name)!;
    assert.ok(definition && "outputSchema" in definition);
  }
});

test("public comparison labels fermentation FG separately from finished backsweetened gravity", async () => {
  const data = recipeData();
  data.fg = "0.998";
  const honey = data.ingredients.find((line) => line.name === "Honey")!;
  data.ingredients.push({
    ...structuredClone(honey),
    lineId: "secondary-honey",
    secondary: true,
    amounts: {
      basis: "weight",
      weight: { value: "200", unit: "g" },
      volume: { value: "142", unit: "mL" },
    },
  });
  const record = brew(1, data);
  assert.equal(record.kind, "brew");
  if (record.kind !== "brew") return;
  record.measuredFg = { sg: 0.998, at: "2026-10-10T00:00:00Z" };
  const adapter = source([record]);
  const detail = await run("get_public_brew", { id: uuid(1) }, adapter);
  assert.equal(detail.result.record.measuredFg.sg, 0.998);
  assert.ok(detail.result.record.snapshot.estimates.finishedGravitySg > 1.01);
  assert.match(detail.result.readingBasis, /measuredFg.*fermentation FG/i);
  assert.match(
    detail.result.readingBasis,
    /Measured finished gravity.*not returned/i,
  );
  assert.equal("measuredFinishedGravitySg" in detail.result.record, false);
  const summary = await run("summarize_public_brews", {}, adapter);
  assert.equal(summary.result.measuredFgSg.mean, 0.998);
  assert.match(summary.result.readingBasis, /not post-backsweetening/i);
  const { mcpServerInstructions, hostedAgentPolicy } = await import(
    "../src/index"
  );
  for (const guidance of [
    mcpServerInstructions,
    hostedAgentPolicy.instructions.join("\n"),
  ]) {
    assert.match(guidance, /Never label measuredFg.*finished gravity/i);
  }
  const definition = mcpAgentToolDefinitions.find(
    (tool) => tool.name === "get_public_brew",
  )!;
  assert.ok("outputSchema" in definition);
  assert.match(JSON.stringify(definition.outputSchema), /fermentation FG/i);
});
