import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Use only a disposable test database. Never load application environment files.
const database = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["localhost", "127.0.0.1"].includes(database.hostname));
assert.equal(database.pathname, "/meadtools_premium_foundation_test");
Object.assign(process.env, {
  NODE_ENV: "test",
  NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
  VERCEL_ENV: ""
});
const { default: prisma } = await import("../lib/prisma.ts");
const { createAccountReadAdapter } =
  await import("../lib/account-read-adapter.ts");
const { executeMcpAgentTool, executeRecipeAgentTool } =
  await import("@meadtools/recipe-agent");

const users = [];
try {
  for (let n = 0; n < 2; n++)
    users.push(
      await prisma.users.create({
        data: { email: `${randomUUID()}@fixture.invalid` }
      })
    );
  const [owner, foreign] = users;
  const draft = executeRecipeAgentTool("build_recipe_draft", {
    batchVolume: { value: 5, unit: "L" },
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
    backsweetening: {
      targetFinalGravity: 1.02,
      sweetener: { name: "Honey", category: "sugar", brix: 80 }
    },
    stabilizers: { enabled: true, type: "kmeta", phReading: 3.6 }
  });
  assert.ok(draft.status === "ok" && draft.result.status === "recipe");
  const snapshot = structuredClone(draft.result.recipeData);
  snapshot.lossAdjustment = {
    enabled: true,
    mode: "manual",
    percentage: 10,
    secondary: { enabled: true, percentage: 5 }
  };
  const latestRecipe = structuredClone(snapshot);
  latestRecipe.fg = "1.01";
  const recipes = [],
    brews = [];
  for (const user of [owner, owner, owner, foreign]) {
    const recipe = await prisma.recipes.create({
      data: {
        user_id: user.id,
        name: "Duplicate",
        private: true,
        recipeData: "{}",
        yanContribution: "{}",
        nutrientData: "{}",
        advanced: false,
        primaryNotes: [],
        secondaryNotes: [],
        dataV2: latestRecipe
      }
    });
    recipes.push(recipe);
    brews.push(
      await prisma.brews.create({
        data: {
          user_id: user.id,
          recipe_id: recipe.id,
          name: "Duplicate",
          stage: "PRIMARY",
          recipe_snapshot: { name: "Saved snapshot", dataV2: snapshot }
        }
      })
    );
  }
  const brew = brews[0];
  // Equal timestamps, sub-millisecond differences, hidden and SQL/JSON-null legacy data.
  const entryIds = Array.from({ length: 7 }, () => randomUUID()).sort();
  for (const [n, id] of entryIds.entries()) {
    const at =
      n < 2 ? "2026-10-14T00:00:00.123455Z" : "2026-10-14T00:00:00.123456Z";
    const data =
      n === 4
        ? { hidden: true }
        : n === 5
          ? { source: "nutrient_basis" }
          : n === 6
            ? { source: "abv_estimate" }
            : null;
    await prisma.$executeRaw`INSERT INTO brew_entries (id, brew_id, user_id, datetime, type, note, data) VALUES (${id}::uuid, ${brew.id}::uuid, ${owner.id}, ${at}::timestamptz, 'NOTE', 'Offline note', ${JSON.stringify(data)}::jsonb)`;
  }
  const sensorIds = Array.from({ length: 4 }, () => randomUUID()).sort();
  for (const [n, sensorId] of sensorIds.entries()) {
    const at = n < 2 ? "2026-10-14T00:00:00.123455Z" : "2026-10-14T00:00:00.123456Z";
    await prisma.$executeRaw`INSERT INTO logs (id, brew_id, datetime, angle, temperature, temp_units, battery, gravity, interval, calculated_gravity) VALUES (${sensorId}::uuid, ${brew.id}::uuid, ${at}::timestamptz, 45, 20, 'C', 80, 1.01, 900, 1.012)`;
  }
  for (const [at, measured, derived] of [
    ["2026-10-12T00:00:00Z", "NaN", null],
    ["2026-10-15T00:00:00Z", "Infinity", "NaN"]
  ]) {
    await prisma.$executeRaw`INSERT INTO logs (id, brew_id, datetime, angle, temperature, temp_units, battery, gravity, interval, calculated_gravity) VALUES (${randomUUID()}::uuid, ${brew.id}::uuid, ${at}::timestamptz, 45, 20, 'C', 80, ${measured}::real, 900, ${derived}::real)`;
  }
  const read = async (name, input, account = owner) =>
    executeMcpAgentTool(name, input, {
      accountReadAdapter: createAccountReadAdapter(account.id)
    });
  async function collect(name, input = {}) {
    const items = [];
    let cursor;
    do {
      const result = await read(name, {
        ...input,
        limit: 1,
        ...(cursor ? { cursor } : {})
      });
      assert.equal(result.status, "ok");
      items.push(...result.result.items);
      assert.equal(
        result.result.page.hasMore,
        result.result.page.nextCursor !== null
      );
      cursor = result.result.page.nextCursor;
      assert.ok(items.length < 10, "Pagination must terminate");
    } while (cursor);
    return items;
  }
  const recordState = async () => ({
    recipes: await prisma.recipes.findMany({
      where: { user_id: { in: users.map((u) => u.id) } },
      orderBy: { id: "asc" }
    }),
    brews: await prisma.brews.findMany({
      where: { user_id: { in: users.map((u) => u.id) } },
      orderBy: { id: "asc" }
    }),
    entries:
      await prisma.$queryRaw`SELECT id, datetime::text, data, note FROM brew_entries WHERE brew_id = ${brew.id}::uuid ORDER BY id`
  });
  const sensors = await collect("get_brew_sensor_history", { id: brew.id,
    from: "2026-10-13T19:00:00.123455-05:00", to: "2026-10-14T00:00:00.123456Z" });
  assert.deepEqual(sensors.map(sample => sample.id), [...sensorIds].reverse());
  assert.equal(sensors[0].datetime, "2026-10-14T00:00:00.123456Z");
  assert.equal(sensors[2].datetime, "2026-10-14T00:00:00.123455Z");
  assert.doesNotMatch(JSON.stringify(sensors), /device_id|battery|angle/);
  const compact = await read("summarize_brew_sensor_history", { id: brew.id });
  assert.equal(compact.status, "ok");
  assert.equal(compact.result.sampleCount, 6);
  assert.equal(compact.result.measured.validCount, 4);
  assert.equal(compact.result.deviceCalculated.validCount, 4);
  assert.equal(compact.result.repeatedTimestamps, 2);
  assert.equal(compact.result.gapsOverOneHour, 2);
  assert.equal(compact.result.firstSampleAt, "2026-10-12T00:00:00.000000Z");
  assert.equal(compact.result.measured.firstAt, "2026-10-14T00:00:00.123455Z");
  assert.ok(JSON.stringify(compact).length < 1500);
  const before = await recordState();
  assert.deepEqual(
    (await collect("list_recipes", { query: "Duplicate" })).map((r) => r.id),
    recipes
      .slice(0, 3)
      .map((r) => r.id)
      .sort((a, b) => b - a)
  );
  assert.deepEqual(
    (
      await collect("list_brews", { query: "Duplicate", activity: "active" })
    ).map((b) => b.id),
    brews
      .slice(0, 3)
      .map((b) => b.id)
      .sort()
      .reverse()
  );
  const timeline = await collect("get_brew_timeline", {
    id: brew.id,
    from: "2026-10-13T19:00:00.123455-05:00",
    to: "2026-10-14T00:00:00.123456Z"
  });
  assert.deepEqual(
    timeline.map((e) => e.id),
    entryIds.slice(0, 4).reverse()
  );
  assert.equal(timeline[0].datetime, "2026-10-14T00:00:00.123456Z");
  assert.equal(timeline[2].datetime, "2026-10-14T00:00:00.123455Z");
  assert.ok(timeline.every((e) => e.provenance === "unknown"));
  for (const [name, id] of [
    ["get_brew", brews[3].id],
    ["get_brew_timeline", brews[3].id],
    ["get_brew_sensor_history", brews[3].id],
    ["summarize_brew_sensor_history", brews[3].id],
    ["get_recipe", recipes[3].id],
    ["get_brew", randomUUID()],
    ["get_recipe", 2147483647]
  ]) {
    const result = await read(name, { id });
    assert.equal(result.status, "not_found");
    assert.equal(result.dataAvailability, "unknown");
    assert.deepEqual(result.requestedRecord, {
      kind: name === "get_recipe" ? "recipe" : "brew", id
    });
  }
  const saved = await read("get_recipe", { id: recipes[0].id });
  const batch = await read("get_brew", { id: brew.id });
  assert.equal(saved.status, "ok");
  assert.equal(batch.status, "ok");
  assert.equal(batch.result.latestHydrometerReading.measuredGravitySg, null);
  assert.equal(batch.result.latestHydrometerReading.derivedGravitySg, null);
  assert.equal(batch.result.latestHydrometerReading.datetime, "2026-10-15T00:00:00.000000Z");
  const allSensors = await collect("get_brew_sensor_history", { id: brew.id });
  assert.equal(allSensors.length, 6);
  assert.equal(allSensors.filter(sample => sample.measuredGravitySg === null).length, 2);
  assert.equal(allSensors.filter(sample => sample.derivedGravitySg === null).length, 2);

  assert.equal(saved.result.recipe.visibility, "private");
  assert.equal(
    saved.result.recipe.appUrl,
    `http://localhost:3000/recipes/${recipes[0].id}`
  );
  assert.equal(
    batch.result.brew.appUrl,
    `http://localhost:3000/account/brews/${brew.id}`
  );
  assert.equal(saved.result.savedRecipe.recipeTargets.finalGravitySg, 1.01);
  assert.equal(batch.result.recipeSnapshot.recipeTargets.finalGravitySg, 0.996);
  const derived = batch.result.recipeSnapshot.derivedEstimates;
  assert.ok(derived.gravity.backsweetenedFg > 0.996);
  assert.ok(derived.alcohol.abv > 0);
  assert.ok(derived.stabilizers.sorbate > 0 && derived.stabilizers.sulfite > 0);
  assert.ok(derived.nutrients.nutrientAdditions.totalGrams.fermO > 0);
  assert.ok(derived.volume.lossL > 0 && derived.volume.secondaryLossL > 0);
  assert.ok(derived.volume.bottlingL < derived.volume.totalL);
  assert.deepEqual(
    await recordState(),
    before,
    "Account reads must leave all stored records unchanged"
  );
  console.log(
    "PostgreSQL MCP account reads passed: ownership, private recipes, all seven tools, multi-page lists/history, microseconds, offsets, hidden/null legacy entries, snapshot isolation, derived results, links, unchanged records."
  );
} finally {
  // Delete only the synthetic accounts' fixtures, even if an assertion fails.
  const userIds = users.map((user) => user.id);
  await prisma.logs.deleteMany({ where: { brews: { user_id: { in: userIds } } } });
  await prisma.brews.deleteMany({ where: { user_id: { in: userIds } } });
  await prisma.recipes.deleteMany({ where: { user_id: { in: userIds } } });
  await prisma.users.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
}
