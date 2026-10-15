import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createAccountReadAdapter } from "../account-read-adapter.ts";
import { createMeadToolsMcpServer } from "../server.ts";
import {
  accountReadInputSchemas,
  executeRecipeAgentTool,
  encodeAccountCursor
} from "@meadtools/recipe-agent";
import prisma from "../../prisma.ts";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const drafted = executeRecipeAgentTool("build_recipe_draft", {
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
  stabilizers: { enabled: true, type: "kmeta", phReading: 3.6 }
});
assert.ok(drafted.status === "ok" && drafted.result.status === "recipe");
const recipeData = structuredClone(drafted.result.recipeData);
recipeData.notes.primary.push({
  lineId: "offline-note",
  content: ["Primary", "Untrusted reference note"]
});
const brew = {
  id: id(3),
  name: "Owned",
  stage: "PRIMARY",
  start_date: new Date("2026-10-01Z"),
  end_date: null,
  current_volume_liters: 4,
  recipe_snapshot: { name: "Saved", dataV2: recipeData }
};
const recipe = {
  id: 3,
  name: "Private owned",
  private: true,
  dataV2: recipeData
};
const rows = [3, 2, 1].map((n) => ({
  id: id(n),
  datetime: "2026-10-14T00:00:00.123456Z",
  type: "GRAVITY",
  title: null,
  note: "Untrusted reference",
  gravity: 1.01,
  temperature: null,
  temp_units: null,
  data: { readingRole: "FG", source: "measured", secret: "DO_NOT_LEAK" }
}));
const before = structuredClone({ brew, recipe, rows });
let reads = 0,
  concurrent = 0,
  rate = 0;
prisma.brews.findFirst = async ({ where, select }) => {
  reads++;
  assert.deepEqual(where, { id: where.id, user_id: 42 });
  assert.equal(select.users, undefined);
  return where.id === brew.id ? brew : null;
};
prisma.brews.findMany = async ({ where, take, orderBy, select }) => {
  reads++;
  assert.equal(where.user_id, 42);
  assert.ok(take <= 21);
  assert.deepEqual(orderBy, { id: "desc" });
  assert.equal(select.recipe_snapshot, undefined);
  if (where.name)
    assert.deepEqual(where.name, { contains: "Owned", mode: "insensitive" });
  return [brew];
};
prisma.recipes.findFirst = async ({ where }) => {
  reads++;
  assert.equal(where.user_id, 42);
  return where.id === recipe.id ? recipe : null;
};
prisma.recipes.findMany = async ({ where, take, orderBy, select }) => {
  reads++;
  assert.equal(where.user_id, 42);
  assert.ok(take <= 21);
  assert.equal(where.private, undefined, "Private recipes must be included");
  assert.deepEqual(orderBy, { id: "desc" });
  assert.equal(select.dataV2, undefined);
  return [3, 2, 1]
    .filter((n) => !where.id || n < where.id.lt)
    .map((n) => ({ ...recipe, id: n, name: "Same" }))
    .slice(0, take);
};
prisma.logs.findFirst = async ({ where, select }) => {
  reads++;
  assert.deepEqual(where, { brew_id: brew.id, brews: { user_id: 42 } });
  assert.equal(select.device_id, undefined);
  assert.equal(select.battery, undefined);
  return {
    datetime: new Date("2026-10-14T00:00:00Z"),
    gravity: 1.01,
    calculated_gravity: 1.012,
    temperature: 20,
    temp_units: "C"
  };
};
prisma.$queryRaw = async (query) => {
  if (Array.isArray(query) || query.sql.includes("pg_advisory")) return [];
  reads++;
  assert.match(query.sql, /JOIN brews b ON b.id = e.brew_id/);
  assert.match(query.sql, /b.user_id = \? AND b.id = \?::uuid/);
  assert.equal(query.values[0], 42);
  assert.equal(query.values[1], brew.id);
  assert.match(query.sql, /COALESCE\(e.data->>'hidden'/);
  assert.match(query.sql, /nutrient_basis.*abv_estimate/);
  assert.match(query.sql, /ORDER BY e.datetime DESC, e.id DESC LIMIT/);
  assert.match(query.sql, /HH24:MI:SS.US/);
  const limit = query.values.at(-1);
  assert.ok(limit <= 21);
  if (query.values.includes("PH") || query.values.includes("TEMPERATURE"))
    return [];
  if (query.sql.includes("e.datetime >="))
    assert.ok(query.values.includes("2026-10-13T19:00:00-05:00"));
  if (query.sql.includes("e.datetime <="))
    assert.ok(query.values.includes("2026-10-14T00:00:01Z"));
  const after = query.sql.includes("(e.datetime, e.id) <")
    ? query.values.at(-2)
    : undefined;
  if (after)
    assert.ok(
      query.values.includes("2026-10-14T00:00:00.123456Z"),
      "Cursor must preserve microseconds"
    );
  return rows.filter((row) => !after || row.id < after).slice(0, limit);
};
prisma.$transaction = async (fn) => fn(prisma);
prisma.mcp_tool_leases.deleteMany = async () => ({});
prisma.mcp_tool_leases.count = async () => concurrent;
prisma.mcp_tool_leases.create = async ({ data }) => {
  assert.equal(data.user_id, 42);
  return { id: "lease" };
};
prisma.mcp_rate_buckets.findUnique = async () => ({
  window_start: new Date(),
  call_count: rate
});
prisma.mcp_rate_buckets.upsert = async () => ({});
const usage = [];
prisma.mcp_tool_usage.create = async ({ data }) => {
  assert.deepEqual(Object.keys(data).sort(), [
    "duration_ms",
    "result_class",
    "tool_name",
    "user_id"
  ]);
  usage.push(data);
  return {};
};

const adapter = createAccountReadAdapter(42);
await adapter.listBrews(
  accountReadInputSchemas.list_brews.parse({
    query: "Owned",
    activity: "active",
    cursor: encodeAccountCursor({ id: id(4) })
  })
);
await adapter.listBrews(
  accountReadInputSchemas.list_brews.parse({ activity: "completed" })
);
const first = await adapter.listRecipes({ limit: 2 });
assert.equal(first.hasMore, true);
assert.deepEqual(
  first.rows.map((row) => row.id),
  [3, 2]
);
assert.deepEqual(
  (
    await adapter.listRecipes({
      limit: 2,
      cursor: encodeAccountCursor({ id: 2 })
    })
  ).rows.map((row) => row.id),
  [1]
);
const timeline = await adapter.getBrewTimeline({
  id: brew.id,
  limit: 2,
  from: "2026-10-13T19:00:00-05:00",
  to: "2026-10-14T00:00:01Z",
  types: ["GRAVITY"]
});
assert.equal(timeline.hasMore, true);
const second = await adapter.getBrewTimeline({
  id: brew.id,
  limit: 2,
  cursor: encodeAccountCursor({ id: id(2), at: rows[1].datetime })
});
assert.deepEqual(
  second.rows.map((row) => row.id),
  [id(1)]
);
assert.equal(second.hasMore, false);
assert.equal(await adapter.getBrew(id(99)), null);
assert.equal(await adapter.getRecipe(99), null);
assert.equal(await adapter.getBrewTimeline({ id: id(99), limit: 2 }), null);

for (const scope of ["mcp:tools", "mcp:tools mcp:account:read"]) {
  const server = createMeadToolsMcpServer(42, scope);
  const client = new Client({ name: "offline-account-reads", version: "1" });
  const [left, right] = InMemoryTransport.createLinkedPair();
  await server.connect(right);
  await client.connect(left);
  assert.match(client.getInstructions() ?? "", /search_wiki/);
  assert.match(client.getInstructions() ?? "", /fetch_wiki_page/);
  assert.match(client.getInstructions() ?? "", /cite/i);

  assert.equal(
    (await client.listTools()).tools.length,
    scope.includes("account") ? 12 : 7
  );
  for (const [name, args] of [
    ["list_brews", {}],
    ["get_brew", { id: brew.id }],
    ["get_brew_timeline", { id: brew.id, limit: 2 }],
    ["list_recipes", { limit: 2 }],
    ["get_recipe", { id: recipe.id }]
  ]) {
    const previousReads = reads;
    const result = await client.callTool({ name, arguments: args });
    assert.doesNotMatch(JSON.stringify(result), /DO_NOT_LEAK/);
    assert.ok(Buffer.byteLength(JSON.stringify(result), "utf8") <= 64 * 1024);
    if (scope.includes("account")) {
      assert.equal(result.isError, false, JSON.stringify(result));
      assert.equal(result.structuredContent.status, "ok");
      if (["get_recipe", "get_brew", "get_brew_timeline"].includes(name)) {
        const guidance = result.structuredContent.result.relatedGuidance;
        assert.equal(
          guidance.referenceStatus,
          "catalog_references_not_fetched"
        );
        assert.ok(
          guidance.references.length > 0 && guidance.references.length <= 5
        );
        assert.match(guidance.adviceWorkflow, /fetch_wiki_page/);
      }

      assert.ok(reads > previousReads);
    } else {
      assert.equal(result.isError, true);
      assert.equal(reads, previousReads);
    }
  }
  if (scope.includes("account")) {
    for (const [count, field, pattern] of [
      [2, "concurrent", /concurrent/],
      [60, "rate", /call limit/]
    ]) {
      concurrent = field === "concurrent" ? count : 0;
      rate = field === "rate" ? count : 0;
      const previousReads = reads;
      const result = await client.callTool({
        name: "list_recipes",
        arguments: {}
      });
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, pattern);
      assert.equal(reads, previousReads);
    }
    concurrent = 0;
    rate = 0;
  }
  await client.close();
  await server.close();
}
assert.equal(usage.length, 5);
assert.deepEqual({ brew, recipe, rows }, before);
await prisma.$disconnect();
