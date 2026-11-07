import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createPublicReadAdapter } from "../../public-read-adapter.ts";
import { createMeadToolsMcpServer } from "../server.ts";
import { publicReadToolNames } from "@meadtools/recipe-agent";
import prisma from "../../prisma.ts";
const id = "00000000-0000-4000-8000-000000000001";
let recipePublic = true,
  brewPublic = true,
  deleted = false,
  reads = 0,
  concurrent = 0,
  rate = 0;
const queries = [];
const recipe = { kind: "recipe", id: 1, name: "Same", data: null };
const brew = {
  kind: "brew",
  id,
  name: "Same",
  recipeId: 1,
  data: null,
  stage: "COMPLETE",
  startDate: "2026-10-01T00:00:00Z",
  endDate: "2026-10-11T00:00:00Z",
  currentVolumeLiters: 3,
  measuredOg: null,
  measuredFg: null,
};
const before = structuredClone({ recipe, brew });
prisma.$transaction = async (run, options) => {
  if (options) assert.deepEqual(options, { timeout: 5000, maxWait: 2000 });
  return run(prisma);
};
prisma.$executeRaw = async (q) => {
  assert.equal(
    Array.isArray(q) ? q.join("") : q.sql,
    "SET LOCAL statement_timeout = '3000ms'",
  );
  return 0;
};
prisma.$queryRaw = async (q) => {
  if ((Array.isArray(q) ? q.join("") : q.sql).includes("pg_advisory_xact_lock"))
    return [{ locked: 1 }];
  reads++;
  queries.push(q);
  assert.ok(q.values.includes(201) || q.values.includes(1));
  assert.match(q.sql, /r.private = false/);
  assert.doesNotMatch(q.sql, /user_id|email|devices|logs|note|SELECT \*/i);
  assert.match(q.sql, /octet_length/);
  if (q.sql.includes("FROM brews")) {
    assert.match(q.sql, /b.public = true AND r.private = false/);
    assert.match(q.sql, /JOIN recipes r ON r.id = b.recipe_id/);
    assert.match(q.sql, /e.data->>'source' = 'measured'/);
    assert.match(q.sql, /e.data->>'readingRole' = \?/);
    assert.match(q.sql, /COALESCE\(e.data->>'hidden', ''\) <> 'true'/);
    assert.match(q.sql, /ORDER BY e.datetime DESC, e.id DESC LIMIT 1/);
    assert.match(q.sql, /b.recipe_snapshot->'dataV2'/);
    assert.doesNotMatch(q.sql, /r\."dataV2"/);
    return !deleted && recipePublic && brewPublic ? [brew] : [];
  }
  assert.match(q.sql, /ORDER BY r.id DESC LIMIT \?/);
  return !deleted && recipePublic ? [recipe] : [];
};
prisma.mcp_tool_leases.deleteMany = async () => ({ count: 0 });
prisma.mcp_tool_leases.count = async () => concurrent;
prisma.mcp_tool_leases.create = async () => ({ id });
prisma.mcp_rate_buckets.findUnique = async () => ({
  window_start: new Date(),
  call_count: rate,
});
prisma.mcp_rate_buckets.upsert = async () => ({});
const usage = [];
prisma.mcp_tool_usage.create = async ({ data }) => {
  usage.push(data);
  return {};
};

const adapter = createPublicReadAdapter();
assert.equal(adapter.origin, "https://meadtools.com");
const injection = "x' OR true --";
await adapter.candidates("brew", {
  query: injection,
  recipeId: 1,
  ingredientId: 42,
  yeastId: 71,
  stage: "COMPLETE",
  completed: false,
  startedFrom: "2026-10-01T02:00:00+02:00",
  startedTo: "2026-10-11T00:00:00Z",
});
const query = queries.at(-1);
assert.ok(query.values.includes(injection));
assert.ok(
  query.values.includes(
    JSON.stringify({
      ingredients: [{ ref: { kind: "catalog", ingredientId: 42 } }],
    }),
  ),
);
assert.ok(
  query.values.includes(
    JSON.stringify({
      ingredients: [{ ref: { kind: "catalog", ingredientId: "42" } }],
    }),
  ),
);
assert.ok(
  query.values.includes(
    JSON.stringify({ nutrients: { selected: { yeastId: 71 } } }),
  ),
);
assert.ok(!query.sql.includes(injection));
assert.match(query.sql, /strpos\(lower\(b.name\), lower\(\?\)\) > 0/);
assert.match(query.sql, /b.stage::text = \?/);
assert.match(query.sql, /b.start_date >= \?::timestamptz/);
assert.match(query.sql, /b.start_date <= \?::timestamptz/);
assert.match(
  query.sql,
  /\(b.stage = 'COMPLETE' OR b.end_date IS NOT NULL\) = \?/,
);
await adapter.get("recipe", 1);
assert.ok(queries.at(-1).values.includes(1));
await adapter.get("brew", id);
assert.ok(queries.at(-1).values.includes(id));

for (const scope of ["mcp:tools", "mcp:tools mcp:account:read"]) {
  const server = createMeadToolsMcpServer(42, scope);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "offline-public-fixture", version: "1" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const inventory = await client.listTools();
  for (const name of publicReadToolNames) {
    const tool = inventory.tools.find((t) => t.name === name);
    assert.ok(tool?.outputSchema);
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(tool.annotations.idempotentHint, true);
    const result = await client.callTool({
      name,
      arguments:
        name === "get_public_recipe"
          ? { id: 1 }
          : name === "get_public_brew"
            ? { id }
            : {},
    });
    assert.equal(result.isError, false, JSON.stringify(result));
    assert.equal(result.structuredContent.status, "ok");
    assert.equal(
      result.structuredContent.result.textPolicy.includes("untrusted"),
      true,
    );
    assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 65536);
  }
  // All independent visibility combinations apply to list, detail, traversal and aggregate.
  for (const [rp, bp] of [
    [true, false],
    [false, true],
    [false, false],
    [true, true],
  ]) {
    recipePublic = rp;
    brewPublic = bp;
    const list = await client.callTool({
      name: "search_public_brews",
      arguments: { filters: { recipeId: 1 } },
    });
    const summary = await client.callTool({
      name: "summarize_public_brews",
      arguments: { filters: { recipeId: 1 } },
    });
    const detail = await client.callTool({
      name: "get_public_brew",
      arguments: { id },
    });
    const recipeDetail = await client.callTool({
      name: "get_public_recipe",
      arguments: { id: 1 },
    });
    assert.equal(list.structuredContent.result.items.length, rp && bp ? 1 : 0);
    assert.equal(
      summary.structuredContent.result.cohortCount,
      rp && bp ? 1 : 0,
    );
    assert.equal(
      detail.structuredContent.status,
      rp && bp ? "ok" : "not_found",
    );
    assert.equal(
      recipeDetail.structuredContent.status,
      rp ? "ok" : "not_found",
    );
  }
  deleted = true;
  assert.equal(
    (await client.callTool({ name: "get_public_brew", arguments: { id } }))
      .structuredContent.status,
    "not_found",
  );
  assert.equal(
    (await client.callTool({ name: "get_public_recipe", arguments: { id: 1 } }))
      .structuredContent.status,
    "not_found",
  );
  deleted = false;
  for (const [c, r, pattern] of [
    [2, 0, /concurrent/],
    [0, 60, /call limit/],
  ]) {
    concurrent = c;
    rate = r;
    const previous = reads;
    const result = await client.callTool({
      name: "search_public_recipes",
      arguments: {},
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, pattern);
    assert.equal(reads, previous);
  }
  concurrent = 0;
  rate = 0;
  await client.close();
  await server.close();
}
assert.ok(usage.some((u) => u.tool_name === "summarize_public_brews"));
for (const u of usage)
  assert.deepEqual(Object.keys(u).sort(), [
    "duration_ms",
    "result_class",
    "tool_name",
    "user_id",
  ]);
assert.deepEqual({ recipe, brew }, before);
await prisma.$disconnect();
