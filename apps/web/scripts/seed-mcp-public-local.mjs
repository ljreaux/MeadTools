import assert from "node:assert/strict";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;
import { fileURLToPath } from "node:url";

const appDirectory = fileURLToPath(new URL("../", import.meta.url));
loadEnvConfig(appDirectory, true, { info() {}, error() {} });
function assertLocalFixtureTarget() {
  assert.notEqual(
    process.env.NODE_ENV,
    "production",
    "Local fixtures cannot run in production.",
  );
  assert.equal(
    process.env.ALLOW_MCP_PUBLIC_FIXTURES,
    "true",
    "Set ALLOW_MCP_PUBLIC_FIXTURES=true for this additive local seed.",
  );
  const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
  assert.ok(
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
    "Only a loopback database is allowed.",
  );
  assert.ok(
    ["meadtools_dev", "meadtools_test"].includes(url.pathname.slice(1)),
    "Only approved local development/test databases are allowed.",
  );
}
assertLocalFixtureTarget();
const { Prisma } = await import("@prisma/client");
const { default: db } = await import("../lib/prisma.ts");
const { buildRecipeDraft } = await import("@meadtools/recipe-workflows");
const { entryPayload } = await import("@meadtools/brew-domain");
const { projectAccountRecipe, executeMcpAgentTool } = await import(
  "@meadtools/recipe-agent"
);
const { createPublicReadAdapter } = await import(
  "../lib/public-read-adapter.ts"
);
const prefix = "MCP public demo";
const email = "mcp-public-discovery@fixture.invalid";
const ownerLabel = "Local MCP discovery fixtures";
const uuid = (n) => `47600000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const day = (start, days) => new Date(Date.parse(start) + days * 86400000);
const round = (n, places = 3) => Number(n.toFixed(places));

async function sourceRecipe(name) {
  const row = await db.recipes.findFirst({
    where: { name, private: false },
    select: { id: true, name: true, dataV2: true },
  });
  assert.ok(
    row,
    `Seed the normal local recipe catalog first; missing public recipe: ${name}`,
  );
  const projection = projectAccountRecipe(row.dataV2);
  assert.equal(
    projection.status,
    "supported",
    `Recipe needs supported V2 data: ${name}`,
  );
  const data = structuredClone(row.dataV2);
  // Keep the recipe's yeast, amounts, units, target and nutrients. Never copy user notes.
  data.notes = { primary: [], secondary: [] };
  return { ...row, dataV2: data, projection };
}
async function fixtureRecipe(tx, ownerId, name, dataV2, privateRecipe = false) {
  const existing = await tx.recipes.findFirst({
    where: { user_id: ownerId, name },
    select: { id: true },
  });
  const data = {
    name,
    private: privateRecipe,
    version: dataV2 ? 2 : 1,
    dataV2: dataV2 ?? Prisma.DbNull,
    recipeData: "{}",
    yanContribution: "{}",
    nutrientData: "{}",
    advanced: false,
    primaryNotes: [],
    secondaryNotes: [],
  };
  return existing
    ? tx.recipes.update({
        where: { id: existing.id },
        data,
        select: { id: true },
      })
    : tx.recipes.create({
        data: { ...data, user_id: ownerId },
        select: { id: true },
      });
}
async function seedBrew(tx, ownerId, spec) {
  const id = uuid(spec.n);
  const existing = await tx.brews.findUnique({
    where: { id },
    select: { user_id: true },
  });
  assert.ok(
    !existing || existing.user_id === ownerId,
    "A fixture brew ID belongs to another account.",
  );
  const data = {
    user_id: ownerId,
    recipe_id: spec.recipeId ?? null,
    public: spec.public !== false,
    name: `${prefix} — ${spec.name}`,
    batch_number: 47600 + spec.n,
    stage: spec.stage ?? "COMPLETE",
    start_date: new Date(spec.start),
    end_date:
      spec.duration === undefined ? null : day(spec.start, spec.duration),
    current_volume_liters: spec.bottlingLiters ?? spec.currentLiters ?? null,
    recipe_snapshot: spec.snapshot
      ? { name: spec.sourceName, dataV2: spec.snapshot }
      : Prisma.DbNull,
    // This cached mixed-provenance field is deliberately not used by public analytics.
    latest_gravity: spec.finished ?? spec.general ?? spec.fg ?? null,
  };
  await tx.brews.upsert({
    where: { id },
    create: { id, ...data },
    update: data,
  });
  let sequence = 0;
  async function entry(type, offset, fields = {}) {
    const entryId = uuid(1000 + spec.n * 100 + sequence++);
    const previous = await tx.brew_entries.findUnique({
      where: { id: entryId },
      select: { brew_id: true },
    });
    assert.ok(
      !previous || previous.brew_id === id,
      "A fixture entry ID belongs to another brew.",
    );
    const record = {
      brew_id: id,
      user_id: ownerId,
      type,
      datetime: day(spec.start, offset),
      title: null,
      note: null,
      gravity: null,
      temperature: null,
      temp_units: null,
      data: Prisma.DbNull,
      ...fields,
    };
    await tx.brew_entries.upsert({
      where: { id: entryId },
      create: { id: entryId, ...record },
      update: record,
    });
  }
  await entry("NOTE", 0, {
    title: "Synthetic local test batch",
    note: "Fictional brewing log for local MCP verification. This is not a real fermentation or a process recommendation.",
  });
  await entry("STAGE_CHANGE", 0, { data: { from: "PLANNED", to: "PRIMARY" } });
  if (spec.og !== undefined)
    await entry("GRAVITY", 0, {
      gravity: spec.og,
      data: { source: "measured", readingRole: "OG" },
      title: "Measured must gravity before yeast pitch",
    });
  if (spec.primaryLiters)
    await entry("VOLUME", 0, {
      data: {
        liters: spec.primaryLiters,
        displayValue: spec.primaryLiters,
        displayUnit: "L",
      },
    });
  await entry("TEMPERATURE", 0, {
    temperature: spec.temperature ?? 19,
    temp_units: "C",
  });
  if (spec.snapshot?.nutrients) {
    const selected = spec.snapshot.nutrients.selected;
    await entry("ADDITION", 0, {
      data: {
        kind: "YEAST",
        name: `${selected.yeastBrand} ${selected.yeastStrain}`,
        amount: 2,
        unit: "g",
      },
      title: "Yeast pitched",
    });
    // Use the saved recipe engine's actual per-addition grams, not invented nutrient doses.
    const derived = projectAccountRecipe(spec.snapshot).derivedEstimates;
    const grams = derived?.nutrients.nutrientAdditions.perAddition;
    const additions = Math.max(
      1,
      Math.min(
        4,
        Number(spec.snapshot.nutrients.inputs.numberOfAdditions) || 1,
      ),
    );
    for (let i = 0; i < additions; i++) {
      for (const [key, name] of [
        ["fermO", "Fermaid O"],
        ["fermK", "Fermaid K"],
        ["dap", "DAP"],
      ]) {
        if (typeof grams?.[key] === "number" && grams[key] > 0)
          await entry("NUTRIENT", i, {
            title: "Recorded nutrient addition from saved plan",
            data: {
              kind: "NUTRIENT",
              name,
              amount: round(grams[key]),
              unit: "g",
            },
          });
      }
    }
  }
  if (spec.general !== undefined)
    await entry("GRAVITY", spec.generalDay ?? 4, {
      gravity: spec.general,
      data: { source: "measured", readingRole: "GENERAL" },
      title: "Fermentation progress reading",
    });
  if (spec.fg !== undefined) {
    await entry("GRAVITY", spec.fgDay - 3, {
      gravity: spec.fg,
      data: { source: "measured", readingRole: "FG" },
      title: "Dry fermentation reading",
    });
    await entry("GRAVITY", spec.fgDay, {
      gravity: spec.fg,
      data: { source: "measured", readingRole: "FG" },
      title: "Repeat dry fermentation reading",
    });
    if (spec.snapshot) {
      await entry("STAGE_CHANGE", spec.fgDay + 1, {
        data: { from: "PRIMARY", to: "SECONDARY" },
      });
      if (spec.rackedLiters)
        await entry("VOLUME", spec.fgDay + 1, {
          data: {
            liters: spec.rackedLiters,
            displayValue: spec.rackedLiters,
            displayUnit: "L",
          },
          title: "Volume after removing fruit and lees",
        });
      if (spec.snapshot.stabilizers.adding) {
        await entry("PH", spec.fgDay + 3, {
          data: { ph: 3.4, source: "measured" },
        });
        await entry("STABILIZATION", spec.fgDay + 3, {
          title: "Stabilization recorded",
          note: "Local fixture records stabilization after dry readings. No dosing or universal safety conclusion is implied.",
        });
        await entry("STAGE_CHANGE", spec.fgDay + 3, {
          data: { from: "SECONDARY", to: "STABILIZED" },
        });
      }
      if (spec.finished !== undefined) {
        for (const ingredient of spec.snapshot.ingredients.filter(
          (i) => i.secondary,
        ))
          await entry("ADDITION", spec.fgDay + 5, {
            data: {
              kind: "INGREDIENT",
              name: ingredient.name,
              amount: Number(
                ingredient.amounts[ingredient.amounts.basis].value,
              ),
              unit: ingredient.amounts[ingredient.amounts.basis].unit,
            },
            title: "Saved recipe secondary addition",
          });
        await entry("BACKSWEETENING", spec.fgDay + 5, {
          title: "Saved secondary sugars added",
        });
        await entry("GRAVITY", spec.fgDay + 12, {
          gravity: spec.finished,
          data: { source: "measured", readingRole: "GENERAL" },
          title: "Finished gravity after secondary sugars",
          note: "Finished sweetness reading; this is not the dry fermentation FG.",
        });
        await entry("STAGE_CHANGE", spec.fgDay + 12, {
          data: {
            from: spec.snapshot.stabilizers.adding ? "STABILIZED" : "SECONDARY",
            to: "BACKSWEETENED",
          },
        });
      }
    }
  }
  if (spec.stage === "SECONDARY")
    await entry("STAGE_CHANGE", 35, {
      data: { from: "PRIMARY", to: "SECONDARY" },
      title: "Racked; no explicitly tagged final gravity in this log",
    });
  if (spec.duration !== undefined) {
    await entry("PACKAGING", spec.duration, {
      data: entryPayload.packaging({
        packagedVolumeLiters: spec.bottlingLiters,
        displayValue: spec.bottlingLiters,
        displayUnit: "L",
        bottleRows: [
          {
            label: `${spec.bottleSize} mL bottle`,
            quantity: spec.bottles,
            sizeLiters: spec.bottleSize / 1000,
            totalLiters: spec.bottlingLiters,
          },
        ],
      }).data,
      title: "Still mead bottled after bulk aging",
    });
    await entry("STAGE_CHANGE", spec.duration, {
      data: {
        from: spec.finished !== undefined ? "BACKSWEETENED" : "SECONDARY",
        to: "COMPLETE",
      },
    });
  }
  if (spec.hiddenFg)
    await entry("GRAVITY", 26, {
      gravity: 1.024,
      data: { source: "measured", readingRole: "FG", hidden: true },
      title: "Superseded transcription error",
      note: "Hidden correction fixture; exclude from public measurements.",
    });
  if (spec.targetReading)
    await entry("GRAVITY", 30, {
      gravity: 1.012,
      data: { source: "recipe", readingRole: "FG" },
      title: "Recipe target, not a measurement",
    });
  // Supplemental records are appended to preserve the stable IDs of earlier fixture entries.
  // Their event dates place them in the actual process chronology.
  if (spec.snapshot && spec.fg !== undefined) {
    for (const additive of spec.snapshot.additives) {
      if (additive.name.trim() && Number(additive.amount) > 0)
        await entry("ADDITION", spec.fgDay + 5, {
          title: "Saved recipe flavoring/fining addition",
          data: {
            kind: "OTHER",
            name: additive.name,
            amount: Number(additive.amount),
            unit: additive.unit,
          },
        });
    }
  }
  if (spec.n === 4) {
    await entry("GRAVITY", 2, {
      gravity: 1.03,
      data: { source: "measured", readingRole: "GENERAL" },
      title: "Interim fermentation reading",
    });
    await entry("TEMPERATURE", 4, { temperature: 18.5, temp_units: "C" });
  }
  if (spec.n === 5) {
    await entry("GRAVITY", 10, {
      gravity: 1.04,
      data: { source: "measured", readingRole: "GENERAL" },
    });
    await entry("GRAVITY", 21, {
      gravity: 1.02,
      data: { source: "measured", readingRole: "GENERAL" },
    });
    await entry("NOTE", 35, {
      note: "Racked at reduced volume. No explicitly tagged final-gravity reading, completion date, or stabilization/packaging record is available in this incomplete local test log.",
    });
  }
  return id;
}

async function main() {
  const [cheesecake, blueberry, traditional] = await Promise.all([
    sourceRecipe("Rapsberry Cheesecake"),
    sourceRecipe("Blueberry Hibiscus Hydromel"),
    sourceRecipe("Mead Wiki Simple Trad Metric"),
  ]);
  const [yeast, raspberry] = await Promise.all([
    db.yeasts.findFirst({
      where: { brand: "Lalvin", name: "71B" },
      select: { id: true, brand: true, name: true, nitrogen_requirement: true },
    }),
    db.ingredients.findFirst({
      where: { name: "Raspberry" },
      select: { id: true, name: true, category: true, sugar_content: true },
    }),
  ]);
  assert.ok(
    yeast && raspberry,
    "Local ingredient and yeast catalogs must be seeded first.",
  );
  const draft = buildRecipeDraft({
    name: `${prefix} — Raspberry 71B`,
    batchVolume: { value: 5, unit: "L" },
    targetAbv: 11,
    fermentationFinalGravity: 0.998,
    ingredients: [
      {
        name: raspberry.name,
        catalogId: raspberry.id,
        category: raspberry.category,
        brix: Number(raspberry.sugar_content),
        role: "fixed",
        amount: { kind: "weight", value: 1, unit: "kg" },
      },
      { name: "Honey", role: "adjustable_fermentable" },
      { name: "Water", role: "fill_liquid" },
    ],
    nutrients: {
      enabled: true,
      yeastBrand: yeast.brand,
      yeastStrain: yeast.name,
      yeastId: yeast.id,
      nitrogenRequirement: yeast.nitrogen_requirement,
      schedule: "tosna",
      numberOfAdditions: 4,
      goFermType: "none",
    },
    backsweetening: {
      targetFinalGravity: 1.012,
      sweetener: { name: "Honey", category: "sugar", brix: 79.6 },
    },
    stabilizers: { enabled: true, type: "kmeta", phReading: 3.4 },
  });
  assert.equal(
    draft.status,
    "recipe",
    "The shared recipe engine must complete the raspberry plan.",
  );
  draft.recipeData.lossAdjustment = {
    enabled: true,
    mode: "manual",
    percentage: 15,
  };
  const og = (r) => round(r.projection.derivedEstimates.gravity.ogPrimary);
  const raspberryOg = round(
    projectAccountRecipe(draft.recipeData).derivedEstimates.gravity.ogPrimary,
  );
  const result = await db.$transaction(
    async (tx) => {
      let owner = await tx.users.findUnique({
        where: { email },
        select: { id: true, public_username: true },
      });
      if (owner)
        assert.equal(
          owner.public_username,
          ownerLabel,
          "The reserved fixture email belongs to a different account.",
        );
      else
        owner = await tx.users.create({
          data: { email, public_username: ownerLabel, active: false },
          select: { id: true, public_username: true },
        });
      const raspberryRecipe = await fixtureRecipe(
        tx,
        owner.id,
        `${prefix} — Raspberry 71B`,
        draft.recipeData,
      );
      const legacy = await fixtureRecipe(
        tx,
        owner.id,
        `${prefix} — Legacy traditional`,
        null,
      );
      const privateRecipe = await fixtureRecipe(
        tx,
        owner.id,
        `${prefix} — Private recipe control`,
        draft.recipeData,
        true,
      );
      const specs = [
        {
          n: 1,
          name: "Raspberry Cheesecake D254",
          recipeId: cheesecake.id,
          sourceName: cheesecake.name,
          snapshot: cheesecake.dataV2,
          start: "2026-07-01T12:00:00Z",
          duration: 62,
          og: round(og(cheesecake) + 0.001),
          general: 1.041,
          fg: 0.998,
          fgDay: 19,
          finished: 1.022,
          primaryLiters: 5.68,
          rackedLiters: 5.05,
          bottlingLiters: 4.875,
          bottles: 13,
          bottleSize: 375,
          temperature: 20,
        },
        {
          n: 2,
          name: "Raspberry Cheesecake D254",
          recipeId: cheesecake.id,
          sourceName: cheesecake.name,
          snapshot: cheesecake.dataV2,
          start: "2026-08-01T12:00:00Z",
          duration: 75,
          og: round(og(cheesecake) - 0.002),
          general: 1.045,
          fg: 0.997,
          fgDay: 23,
          finished: 1.021,
          primaryLiters: 5.6,
          rackedLiters: 4.9,
          bottlingLiters: 4.5,
          bottles: 12,
          bottleSize: 375,
          temperature: 19,
          hiddenFg: true,
        },
        {
          n: 3,
          name: "Blueberry Hibiscus DV10",
          recipeId: blueberry.id,
          sourceName: blueberry.name,
          snapshot: blueberry.dataV2,
          start: "2026-08-15T12:00:00Z",
          duration: 47,
          og: round(og(blueberry) + 0.001),
          general: 1.021,
          fg: 0.997,
          fgDay: 12,
          finished: 1.011,
          primaryLiters: 4.66,
          rackedLiters: 4.1,
          bottlingLiters: 3.75,
          bottles: 5,
          bottleSize: 750,
          temperature: 19,
        },
        {
          n: 4,
          name: "Blueberry Hibiscus DV10 — active",
          recipeId: blueberry.id,
          sourceName: blueberry.name,
          snapshot: blueberry.dataV2,
          start: "2026-11-02T12:00:00Z",
          stage: "PRIMARY",
          og: round(og(blueberry) - 0.001),
          general: 1.014,
          generalDay: 4,
          primaryLiters: 4.66,
          currentLiters: 4.66,
          temperature: 18,
        },
        {
          n: 5,
          name: "Simple Trad US-05 — incomplete log",
          recipeId: traditional.id,
          sourceName: traditional.name,
          snapshot: traditional.dataV2,
          start: "2026-09-01T12:00:00Z",
          stage: "SECONDARY",
          og: round(og(traditional) - 0.001),
          general: 1.018,
          generalDay: 28,
          primaryLiters: 4,
          currentLiters: 3.6,
          temperature: 19,
          targetReading: true,
        },
        {
          n: 6,
          name: "Raspberry 71B",
          recipeId: raspberryRecipe.id,
          sourceName: `${prefix} — Raspberry 71B`,
          snapshot: draft.recipeData,
          start: "2026-06-15T12:00:00Z",
          duration: 66,
          og: round(raspberryOg + 0.001),
          general: 1.038,
          fg: 0.999,
          fgDay: 21,
          finished: 1.013,
          primaryLiters: 5,
          rackedLiters: 4.25,
          bottlingLiters: 4.125,
          bottles: 11,
          bottleSize: 375,
          temperature: 18,
        },
        {
          n: 7,
          name: "Raspberry 71B",
          recipeId: raspberryRecipe.id,
          sourceName: `${prefix} — Raspberry 71B`,
          snapshot: draft.recipeData,
          start: "2026-08-10T12:00:00Z",
          duration: 71,
          og: round(raspberryOg - 0.001),
          general: 1.046,
          fg: 0.998,
          fgDay: 24,
          finished: 1.012,
          primaryLiters: 5,
          rackedLiters: 4.15,
          bottlingLiters: 3.75,
          bottles: 10,
          bottleSize: 375,
          temperature: 17,
        },
        {
          n: 8,
          name: "Legacy traditional — missing original log",
          recipeId: legacy.id,
          start: "2026-05-01T12:00:00Z",
          duration: 92,
          fg: 1.006,
          fgDay: 34,
          bottlingLiters: 2.25,
          bottles: 3,
          bottleSize: 750,
        },
        {
          n: 9,
          name: "Private brew control",
          recipeId: raspberryRecipe.id,
          public: false,
          start: "2026-07-01T12:00:00Z",
          stage: "PRIMARY",
        },
        {
          n: 10,
          name: "Private source recipe control",
          recipeId: privateRecipe.id,
          start: "2026-07-01T12:00:00Z",
          stage: "PRIMARY",
        },
        {
          n: 11,
          name: "No linked recipe control",
          start: "2026-07-01T12:00:00Z",
          stage: "PRIMARY",
        },
      ];
      for (const spec of specs) await seedBrew(tx, owner.id, spec);
      return {
        specs,
        raspberryRecipeId: raspberryRecipe.id,
        privateRecipeId: privateRecipe.id,
        legacyRecipeId: legacy.id,
      };
    },
    { timeout: 30000 },
  );
  const adapter = createPublicReadAdapter();
  async function run(name, args) {
    const execution = await executeMcpAgentTool(name, args, {
      publicReadAdapter: adapter,
    });
    assert.equal(
      execution.status,
      "ok",
      `${name} did not succeed: ${execution.status}`,
    );
    return execution.result;
  }
  const summary = await run("summarize_public_brews", {
    filters: { query: prefix },
  });
  assert.equal(summary.cohortCount, 8);
  assert.equal(summary.unsupportedSnapshots, 1);
  assert.equal(summary.measuredOgSg.usable, 7);
  assert.equal(summary.measuredOgSg.missing, 1);
  assert.equal(summary.measuredFgSg.usable, 6);
  assert.equal(summary.measuredFgSg.missing, 2);
  assert.ok(
    Math.abs(summary.measuredFgSg.mean - 0.9991666666666666) < 1e-6,
    "FG must exclude sweetened, recipe-target and hidden readings.",
  );
  assert.equal(summary.recordedLifecycleDays.usable, 6);
  assert.equal(summary.recordedLifecycleDays.missing, 2);
  assert.ok(Math.abs(summary.recordedLifecycleDays.mean - 413 / 6) < 1e-9);
  const seen = [];
  let cursor;
  do {
    const page = await run("search_public_brews", {
      filters: { query: prefix },
      limit: 2,
      ...(cursor ? { cursor } : {}),
    });
    seen.push(...page.items.map((r) => r.id));
    cursor = page.page.nextCursor;
  } while (cursor);
  assert.equal(new Set(seen).size, 8);
  for (let n = 9; n <= 11; n++) {
    const output = await executeMcpAgentTool(
      "get_public_brew",
      { id: uuid(n) },
      { publicReadAdapter: adapter },
    );
    assert.equal(
      output.status,
      "not_found",
      "Visibility control must not be discoverable by direct ID.",
    );
  }
  const hiddenRecipe = await executeMcpAgentTool(
    "get_public_recipe",
    { id: result.privateRecipeId },
    { publicReadAdapter: adapter },
  );
  assert.equal(hiddenRecipe.status, "not_found");
  const detail = await run("get_public_brew", { id: uuid(1) });
  assert.equal(detail.record.measuredFg.sg, 0.998);
  assert.ok(
    Math.abs(
      detail.record.snapshot.estimates.finishedGravitySg -
        cheesecake.projection.derivedEstimates.gravity.backsweetenedFg,
    ) < 1e-12,
  );
  const found = await run("search_public_brews", {
    filters: {
      query: prefix,
      recipeId: result.raspberryRecipeId,
      ingredientId: raspberry.id,
      yeastId: yeast.id,
      estimatedAbvPercent: { min: 10, max: 12 },
    },
  });
  assert.equal(
    found.cohortCount,
    2,
    "Combined catalog and recipe-estimate filters must match both 71B brews.",
  );
  const recipes = await run("search_public_recipes", {
    filters: { query: prefix },
  });
  assert.equal(recipes.cohortCount, 2);
  const recipe = await run("get_public_recipe", {
    id: result.raspberryRecipeId,
  });
  assert.equal(recipe.record.recipe.yeastId, yeast.id);
  console.log(
    JSON.stringify(
      {
        fixturePrefix: prefix,
        publicBrewCount: summary.cohortCount,
        privateVisibilityControls: 3,
        raspberryRecipeId: result.raspberryRecipeId,
        yeastId: yeast.id,
        ingredientId: raspberry.id,
        measuredOg: summary.measuredOgSg,
        measuredFg: summary.measuredFgSg,
        recordedLifecycleDays: summary.recordedLifecycleDays,
        brewDetailUrl: detail.record.appUrl,
        verified: "All five tools, real PostgreSQL, no model provider calls",
      },
      null,
      2,
    ),
  );
}
try {
  await main();
} catch (error) {
  console.error(
    error instanceof assert.AssertionError
      ? error.message
      : "Local public-fixture setup failed; database details suppressed.",
  );
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
