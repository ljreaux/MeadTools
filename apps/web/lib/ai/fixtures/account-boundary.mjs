import assert from "node:assert/strict";
import prisma from "../../prisma.ts";
import { createAccountReadAdapter } from "../../account-read-adapter.ts";
import { getSelectedChatContext } from "../chat-account-context.ts";
import { executeHostedAgentTool } from "@meadtools/recipe-agent";

const brewId = "00000000-0000-4000-8000-000000000001";
const foreignId = "00000000-0000-4000-8000-000000000002";
let reads = 0;
prisma.recipes.findFirst = async ({ where, select }) => {
  reads++;
  assert.deepEqual(where, { id: where.id, user_id: 42 });
  assert.equal(select.users, undefined);
  return where.id === 1 ? { id: 1, name: "Owned private", private: true, dataV2: null } : null;
};
prisma.brews.findFirst = async ({ where, select }) => {
  reads++;
  assert.deepEqual(where, { id: where.id, user_id: 42 });
  assert.equal(select.devices, undefined);
  assert.equal(select.entries, undefined);
  return where.id === brewId ? {
    id: brewId, name: "Owned brew", stage: "PRIMARY", start_date: new Date("2026-10-01Z"),
    end_date: null, current_volume_liters: null, recipe_snapshot: null, recipes: null,
  } : null;
};
prisma.logs.findFirst = async ({ where, select }) => {
  assert.deepEqual(where, { brew_id: brewId, brews: { user_id: 42 } });
  assert.equal(select.devices, undefined);
  return null;
};
prisma.$queryRaw = async (query) => {
  const sql = query.strings.join("?");
  assert.match(sql, /b.user_id = \?/);
  assert.ok(query.values.includes(42));
  if (sql.includes("FROM logs l")) {
    assert.match(sql, /JOIN brews b ON b.id = l.brew_id/);
    assert.match(sql, /CASE WHEN l.gravity/);
    assert.match(sql, /CASE WHEN l.calculated_gravity/);
    assert.match(sql, /CASE WHEN l.temperature/);
    assert.ok(query.values.includes(brewId));
    return [];
  }
  assert.match(sql, /hidden/);
  return [];
};
const accountReadAdapter = createAccountReadAdapter(42);
const run = (name, input) => executeHostedAgentTool(name, input, { accountReadAdapter });
assert.equal((await run("get_recipe", { id: 99 })).status, "not_found");
assert.equal((await run("get_brew", { id: foreignId })).status, "not_found");
assert.equal((await run("get_brew_timeline", { id: foreignId })).status, "not_found");
assert.equal((await run("get_brew_sensor_history", { id: foreignId })).status, "not_found");
assert.equal((await run("summarize_brew_sensor_history", { id: foreignId })).status, "not_found");
const beforeInvalid = reads;
assert.equal((await run("get_recipe", { id: 1, userId: 99 })).status, "invalid_input");
assert.equal(reads, beforeInvalid);
const owned = await run("get_brew", { id: brewId });
assert.equal(owned.status, "ok");
assert.deepEqual(owned.result.latestReadings, []);
assert.equal(owned.result.latestHydrometerReading, null);
assert.equal(owned.result.recipeSnapshot.status, "unsupported");
const selection = await getSelectedChatContext(42, { kind: "recipe", id: 1 });
assert.deepEqual(selection, { kind: "recipe", label: "Recipe: Owned private", recipe: { id: 1, name: "Owned private" } });
assert.equal(await getSelectedChatContext(42, { kind: "recipe", id: 99 }), undefined);
assert.equal(await getSelectedChatContext(42, { kind: "brew", id: foreignId }), undefined);
await prisma.$disconnect();
