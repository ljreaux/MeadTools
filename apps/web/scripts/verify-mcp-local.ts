/** Disposable local HTTP verification. No external model provider is called. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import prisma from "../lib/prisma";
import {
  createMcpAccessToken,
  revokeMcpAccessToken,
} from "../lib/mcp/access";
import { executeLimitedMcpTool, McpToolLimitError } from "../lib/mcp/usage";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
if (!baseUrl || !URL.canParse(baseUrl) || !["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname)) {
  throw new Error("The local MCP fixture requires a localhost base URL.");
}
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("The local MCP fixture requires a localhost database.");
}

let userId: number | null = null;
try {
  const user = await prisma.users.create({
    data: { email: `mcp-fixture-${randomUUID()}@example.invalid` },
  });
  userId = user.id;
  await prisma.premium_memberships.create({
    data: {
      user_id: user.id,
      source: "manual",
      paid_through: new Date(Date.now() + 24 * 60 * 60_000),
    },
  });
  const issued = await createMcpAccessToken(user.id, "Local fixture");
  await executeLimitedMcpTool(user.id, "fixture", async () => ({ status: "ok" }));
  const call = async (body: object, bearer = issued.token) => fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify(body),
  });

  const initialize = await call({
    jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "local-fixture", version: "1" } },
  });
  assert.equal(initialize.status, 200, "MCP initialization must succeed");
  const initialized = await initialize.json() as { result?: { serverInfo?: { name?: string } } };
  assert.equal(initialized.result?.serverInfo?.name, "meadtools");

  const listed = await call({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  assert.equal(listed.status, 200, "MCP tool discovery must succeed");
  const listing = await listed.json() as { result?: { tools?: Array<{ name: string }> } };
  assert.deepEqual(listing.result?.tools?.map((tool) => tool.name).sort(), [
    "build_recipe_draft", "calculate_gravity_target", "fetch_wiki_page",
    "search_additives", "search_ingredients", "search_wiki", "search_yeasts",
  ]);

  const calculated = await call({
    jsonrpc: "2.0", id: 3, method: "tools/call",
    params: { name: "calculate_gravity_target", arguments: {
      targetAbv: 12, fermentationFinalGravity: 1.005,
    } },
  });
  assert.equal(calculated.status, 200, "MCP calculation must succeed");
  const calculation = await calculated.json() as {
    result?: { isError?: boolean; content?: Array<{ text?: string }> };
  };
  assert.equal(calculation.result?.isError, false, calculation.result?.content?.[0]?.text);
  assert.match(calculation.result?.content?.[0]?.text ?? "", /"status":"ok"/);

  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let signalStarted!: () => void;
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  let heldCount = 0;
  const runHeld = () => executeLimitedMcpTool(user.id, "fixture", async () => {
    heldCount += 1;
    if (heldCount === 2) signalStarted();
    await held;
    return { status: "ok" };
  });
  const firstHeld = runHeld();
  const secondHeld = runHeld();
  await started;
  await assert.rejects(
    executeLimitedMcpTool(user.id, "fixture", async () => ({ status: "ok" })),
    McpToolLimitError,
    "A third concurrent call must be refused",
  );
  release();
  await Promise.all([firstHeld, secondHeld]);

  await prisma.mcp_rate_buckets.update({
    where: { user_id: user.id }, data: { call_count: 60 },
  });
  await assert.rejects(
    executeLimitedMcpTool(user.id, "fixture", async () => ({ status: "ok" })),
    McpToolLimitError,
    "The 61st call in a minute must be refused",
  );

  const anonymous = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/list" }),
  });
  assert.equal(anonymous.status, 401);
  assert.match(anonymous.headers.get("www-authenticate") ?? "", /resource_metadata=/);

  await prisma.premium_memberships.update({
    where: { user_id_source: { user_id: user.id, source: "manual" } },
    data: { revoked_at: new Date() },
  });
  assert.equal((await call({ jsonrpc: "2.0", id: 5, method: "tools/list" })).status, 401);
  assert.equal(await revokeMcpAccessToken(user.id, issued.id), true);
  assert.equal((await call({ jsonrpc: "2.0", id: 6, method: "tools/list" })).status, 401);
  console.log("Local MCP HTTP, entitlement, and revocation verification passed.");
} finally {
  if (userId !== null) {
    await prisma.mcp_tool_usage.deleteMany({ where: { user_id: userId } });
    await prisma.mcp_tool_leases.deleteMany({ where: { user_id: userId } });
    await prisma.mcp_rate_buckets.deleteMany({ where: { user_id: userId } });
    await prisma.mcp_access_tokens.deleteMany({ where: { user_id: userId } });
    await prisma.premium_memberships.deleteMany({ where: { user_id: userId } });
    await prisma.users.delete({ where: { id: userId } });
  }
  await prisma.$disconnect();
}
