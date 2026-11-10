import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as mcpPost } from "../../../app/mcp/route.ts";
import { encodeDraftHandoff } from "@meadtools/recipe-workflows/draft-handoff";
import { createHash } from "node:crypto";
import prisma from "../../prisma.ts";
import { authenticateMcpAccessToken, createMcpAccessToken } from "../access.ts";
import {
  validateAuthorizationRequest,
  signConsentRequest,
  verifyConsentRequest,
  exchangeRefreshToken,
  exchangeAuthorizationCode
} from "../oauth.ts";
import { createMeadToolsMcpServer } from "../server.ts";
import {
  mcpAccountReadToolNames,
  calculatorToolNames,
  publicReadToolNames
} from "@meadtools/recipe-agent";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const base = "mcp:tools";
const expanded = `${base} mcp:account:read`;
const resource = "http://localhost:3000/mcp";
const future = () => new Date(Date.now() + 86400000);
let active = true,
  restricted = false,
  entitled = true;
prisma.users.findUnique = async () => ({
  active,
  credit_account: restricted ? { payment_restricted_at: new Date() } : null,
  premium_memberships: entitled
    ? [{ source: "manual", paid_through: future(), revoked_at: null }]
    : []
});
prisma.$transaction = async (fn) => fn(prisma);
prisma.$queryRaw = async () => [];
let record = {
  id: "fixture",
  user_id: 42,
  scope: base,
  expires_at: future(),
  revoked_at: null
};
let session = {
  ...record,
  resource,
  client_id: "client",
  access_expires_at: future(),
  refresh_expires_at: future(),
  refresh_token_hash: ""
};
prisma.mcp_access_tokens.findUnique = async () => record;
prisma.mcp_access_tokens.count = async () => 0;
prisma.mcp_access_tokens.create = async ({ data }) => ({
  ...data,
  id: "fixture"
});
prisma.mcp_access_tokens.update = async () => ({});
prisma.mcp_oauth_sessions.findUnique = async () => session;
prisma.mcp_oauth_sessions.update = async ({ data }) => {
  session = { ...session, ...data };
  return session;
};
prisma.mcp_oauth_consumed_refresh_tokens.create = async () => ({});
const initialChallenge = await mcpPost(
  new NextRequest(resource, {
    method: "POST",
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
  })
);
assert.equal(initialChallenge.status, 401);
assert.match(
  initialChallenge.headers.get("www-authenticate"),
  /resource_metadata=/
);
assert.doesNotMatch(
  initialChallenge.headers.get("www-authenticate"),
  /(?:^|[, ])scope=/,
  "Initial discovery must not override the supported scopes with basic-only access"
);
const { GET: getResourceMetadata } = await import(
  "../../../app/.well-known/oauth-protected-resource/route.ts"
);
const discovered = await getResourceMetadata().json();
assert.deepEqual(discovered.scopes_supported, [base, "mcp:account:read"]);
const header = `Bearer mtmcp_${"a".repeat(43)}`;
for (const scope of [base, expanded]) {
  record.scope = scope;
  const access = await authenticateMcpAccessToken(header);
  assert.equal(access.kind, "authorized");
  assert.equal(access.scope, scope);
}
for (const mutation of [
  { revoked_at: new Date() },
  { expires_at: new Date(0) },
  { scope: "mcp:write" }
]) {
  const previous = record;
  record = { ...previous, ...mutation };
  assert.equal((await authenticateMcpAccessToken(header)).kind, "unauthorized");
  record = previous;
}
restricted = true;
assert.equal((await authenticateMcpAccessToken(header)).kind, "unauthorized");
restricted = false;
active = false;
assert.equal((await authenticateMcpAccessToken(header)).kind, "unauthorized");
active = true;
entitled = false;
assert.equal(
  (await authenticateMcpAccessToken(header)).kind,
  "premium_required"
);
entitled = true;
process.env.PREMIUM_MCP_ENABLED = "false";
assert.equal((await authenticateMcpAccessToken(header)).kind, "unauthorized");
process.env.PREMIUM_MCP_ENABLED = "true";
assert.equal((await createMcpAccessToken(42, "Legacy")).scope, base);
assert.equal((await createMcpAccessToken(42, "Account", true)).scope, expanded);
record.scope = base;
for (const name of mcpAccountReadToolNames) {
  const response = await mcpPost(
    new NextRequest(resource, {
      method: "POST",
      headers: { Authorization: header },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name, arguments: {} }
      })
    })
  );
  assert.equal(response.status, 403);
  assert.match(response.headers.get("www-authenticate"), /insufficient_scope/);
  assert.match(response.headers.get("www-authenticate"), /mcp:account:read/);
}
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/userAccessFunctions") {
      return {
        url: `data:text/javascript,${encodeURIComponent(`
          export async function verifyUser(request) {
            if (request.nextUrl.pathname !== "/mcp/draft") return 42;
            const user = request.headers.get("x-fixture-user");
            return user ? Number(user) : new Response(null, { status: 401 });
          }
        `)}`,
        shortCircuit: true
      };
    }
    return nextResolve(specifier, context);
  }
});
const tokenRoute = await import(
  "../../../app/api/account/premium/mcp/tokens/route.ts"
);
const authorizeRoute = await import("../../../app/oauth/authorize/route.ts");
const { POST: openDraft } = await import("../../../app/mcp/draft/route.ts");
hooks.deregister();
prisma.mcp_access_tokens.create = async ({ data }) => ({
  ...data,
  id: "f9949f9c-9917-4d68-b9d2-79f814673f3b",
  created_at: new Date()
});
for (const accountRead of [undefined, false, true]) {
  const response = await tokenRoute.POST(
    new NextRequest("http://localhost:3000/api/account/premium/mcp/tokens", {
      method: "POST",
      body: JSON.stringify({ label: "Fixture", accountRead })
    })
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).accountRead, accountRead === true);
}
const timestamp = new Date();
prisma.mcp_access_tokens.findMany = async () => [
  {
    id: "f9949f9c-9917-4d68-b9d2-79f814673f3b",
    label: "Legacy",
    scope: base,
    created_at: timestamp,
    expires_at: future(),
    last_used_at: null
  }
];
prisma.mcp_oauth_sessions.findMany = async () => [
  {
    id: "f9949f9c-9917-4d68-b9d2-79f814673f3b",
    label: "Account",
    scope: expanded,
    created_at: timestamp,
    refresh_expires_at: future(),
    last_used_at: null
  }
];
const listedConnections = await tokenRoute.GET(
  new NextRequest("http://localhost:3000/api/account/premium/mcp/tokens")
);
assert.deepEqual(
  (await listedConnections.json()).tokens.map((item) => item.accountRead),
  [false, true]
);
record = null;
for (const scope of [base, expanded]) {
  session.scope = scope;
  assert.equal((await authenticateMcpAccessToken(header)).scope, scope);
}
for (const mutation of [
  { revoked_at: new Date() },
  { access_expires_at: new Date(0) },
  { scope: "mcp:write" }
]) {
  const previous = session;
  session = { ...previous, ...mutation };
  assert.equal((await authenticateMcpAccessToken(header)).kind, "unauthorized");
  session = previous;
}
session.resource = "https://foreign.invalid/mcp";
assert.equal((await authenticateMcpAccessToken(header)).kind, "unauthorized");
session.resource = resource;
const redirectUri = "https://client.example.invalid/callback";
prisma.mcp_oauth_clients.findUnique = async () => ({
  client_name: "Fixture",
  redirect_uris: [redirectUri]
});
const verifier = "v".repeat(43);
const query = new URLSearchParams({
  client_id: "client",
  redirect_uri: redirectUri,
  resource,
  response_type: "code",
  code_challenge_method: "S256",
  code_challenge: createHash("sha256").update(verifier).digest("base64url"),
  state: "fixture-state"
});
for (const scope of [base, expanded, "mcp:account:read mcp:tools"]) {
  query.set("scope", scope);
  const consentResponse = await authorizeRoute.GET(
    new NextRequest(`http://localhost:3000/oauth/authorize?${query}`, {
      headers: { Accept: "application/json" }
    })
  );
  assert.equal(consentResponse.status, 200);
  assert.equal((await consentResponse.json()).accountRead, scope !== base);
  const request = await validateAuthorizationRequest(query, 42);
  assert.equal(
    verifyConsentRequest(signConsentRequest(request), 42).scope,
    request.scope
  );
  prisma.mcp_oauth_codes.findUnique = async () => ({
    ...request,
    user_id: 42,
    client_id: "client",
    redirect_uri: redirectUri,
    code_challenge: request.codeChallenge,
    code_hash: "fixture",
    expires_at: future()
  });
  prisma.mcp_oauth_codes.updateMany = async () => ({ count: 1 });
  prisma.mcp_oauth_sessions.create = async ({ data }) => {
    assert.equal(data.scope, request.scope);
    return data;
  };
  const result = await exchangeAuthorizationCode({
    code: "fixture",
    clientId: "client",
    resource,
    redirectUri,
    verifier
  });
  assert.equal(result.scope, request.scope);
}
query.set("scope", "mcp:tools mcp:write");
await assert.rejects(validateAuthorizationRequest(query, 42));
const refreshToken = "offline-fixture";
const resetSession = (scope) => {
  session = {
    id: "fixture",
    user_id: 42,
    scope,
    resource,
    client_id: "client",
    refresh_expires_at: future(),
    revoked_at: null,
    refresh_token_hash: createHash("sha256").update(refreshToken).digest("hex")
  };
};
resetSession(base);
await assert.rejects(
  exchangeRefreshToken({
    refreshToken,
    resource,
    clientId: "client",
    scope: expanded
  })
);
assert.equal(session.scope, base);
for (const [scope, requested, expected] of [
  [base, undefined, base],
  [expanded, undefined, expanded],
  [expanded, base, base]
]) {
  resetSession(scope);
  assert.equal(
    (
      await exchangeRefreshToken({
        refreshToken,
        resource,
        clientId: "client",
        scope: requested
      })
    ).scope,
    expected
  );
  assert.equal(session.scope, expected);
}

// Keep the protocol exercise offline while retaining lease and usage admission.
const calculatorUsage = [];
prisma.mcp_tool_leases.deleteMany = async () => ({ count: 0 });
prisma.mcp_tool_leases.count = async () => 0;
prisma.mcp_tool_leases.create = async () => ({
  id: "calculator-fixture-lease"
});
prisma.mcp_rate_buckets.findUnique = async () => null;
prisma.mcp_rate_buckets.upsert = async () => ({});
prisma.mcp_tool_usage.create = async ({ data }) => {
  calculatorUsage.push(data.tool_name);
  return {};
};

const drafts = new Map();
let failDraftWrites = false;
prisma.mcp_draft_handoffs.deleteMany = async ({ where }) => {
  for (const draft of drafts.values()) {
    if (draft.expires_at <= where.expires_at.lte) drafts.delete(draft.id);
  }
};
prisma.mcp_draft_handoffs.create = async ({ data }) => {
  if (failDraftWrites) throw new Error("Store offline");
  drafts.set(data.id, data);
};
prisma.mcp_draft_handoffs.findFirst = async ({ where, select }) => {
  assert.deepEqual(select, { payload: true });
  assert.equal(typeof where.user_id, "number");
  const draft = drafts.get(where.id);
  return draft?.user_id === where.user_id && draft.expires_at > where.expires_at.gt
    ? { payload: draft.payload }
    : null;
};
const redeem = (id, userId) => openDraft(new NextRequest(`${resource}/draft`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(userId ? { "x-fixture-user": String(userId) } : {})
  },
  body: JSON.stringify(id)
}));

// Real SDK protocol exchange, no network, database or model provider.
for (const scope of [base, expanded]) {
  const server = createMeadToolsMcpServer(42, scope);
  const client = new Client({ name: "offline-permissions", version: "1" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const inventory = await client.listTools();
  assert.equal(
    inventory.tools.length,
    scope === base
      ? 7 + calculatorToolNames.length + publicReadToolNames.length
      : 14 + calculatorToolNames.length + publicReadToolNames.length
  );
  for (const tool of inventory.tools) {
    assert.equal(typeof tool.title, "string", `${tool.name} needs a title`);
    assert.ok(tool.title.trim().length > 0, `${tool.name} needs a readable title`);
    assert.ok(
      !tool.title.includes("_"),
      `${tool.name} exposes a machine name as its title`
    );
    assert.equal(tool.annotations.readOnlyHint, true);
    assert.equal(tool.annotations.destructiveHint, false);
    assert.equal(
      tool.annotations.openWorldHint,
      publicReadToolNames.includes(tool.name),
      `${tool.name} must distinguish public discovery from bounded account/catalog tools`
    );
  }
  assert.equal(
    inventory.tools.find((tool) => tool.name === "calculate_abv").title,
    "Calculate ABV"
  );
  const calculatorSamples = {
    calculate_juice_sugar: { sugar: 24, servingSize: 240 },
    calculate_abv: { originalGravity: 1.1, finalGravity: 1 },
    convert_brix_gravity: { reading: 24, unit: "Brix" },
    estimate_original_gravity: { hydrometerFg: 1, refractometerFgBrix: 5 },
    calculate_sulfite: { volume: 1 },
    calculate_sorbate: { volume: 1, abvPercent: 12 },
    correct_refractometer: { originalReading: 1.1, finalBrix: 8.5 },
    correct_hydrometer_temperature: {
      specificGravity: 1.1,
      measuredTemperature: 68
    },
    calculate_blend: {
      rows: [
        { value: 1, volume: 1 },
        { value: 2, volume: 1 }
      ],
      valueUnit: "SG",
      volumeUnit: "L"
    },
    calculate_priming_sugar: { volume: 1 },
    calculate_bottling: { volume: 1, rows: [{ size: "750ml", quantity: 5 }] },
    calculate_bench_trial: {
      stockVolumeMl: 1,
      concentrationPercent: 10,
      sampleMl: 100,
      batchSize: 1
    }
  };
  for (const name of calculatorToolNames) {
    assert.ok(inventory.tools.find((tool) => tool.name === name)?.outputSchema);
    const result = await client.callTool({
      name,
      arguments: calculatorSamples[name]
    });
    assert.equal(result.isError, false, JSON.stringify(result));
    assert.equal(result.structuredContent.status, "ok");
    assert.deepEqual(
      result.structuredContent,
      JSON.parse(result.content[0].text)
    );
  }
  if (scope === base) {
    const arguments_ = {
      name: "Key Lime Pie — Link Test 🍯",
      batchVolume: { value: 1, unit: "gal" },
      fermentationFinalGravity: 0.996,
      ingredients: [
        { name: "Honey", brix: 79.6, role: "fixed", amount: { kind: "weight", unit: "lb", value: 1.5 } },
        { name: "Water", role: "fill_liquid" },
        { name: "Key Lime Juice", category: "juice", brix: 1.35, role: "fixed", secondary: true,
          amount: { kind: "volume", unit: "fl_oz", value: 6 } }
      ],
      additives: [{ name: "Vanilla Bean", amount: 1, unit: "units", secondary: true }],
      assumptions: Array.from({ length: 10 }, (_, i) =>
        `Secondary note ${i + 1}: keep the fruit additions separate from primary. ${"🍋".repeat(55)}`),
      nutrients: { enabled: true, yeastBrand: "Lalvin", yeastStrain: "ICV D47",
        nitrogenRequirement: "Low", schedule: "tosna", numberOfAdditions: 3, goFermType: "Go-Ferm" },
      stabilizers: { enabled: true, type: "kmeta" }
    };
    const response = await client.callTool({ name: "build_recipe_draft", arguments: arguments_ });
    const { result } = JSON.parse(response.content[0].text);
    assert.equal(result.status, "recipe", response.content[0].text);
    const url = new URL(result.builderUrl);
    assert.equal(url.pathname + url.search, "/recipe-draft");
    assert.match(url.hash, /^#mcp-[0-9a-f-]{36}$/);
    assert.ok(result.builderUrl.length < 100);
    assert.deepEqual(response.content[1], {
      type: "text",
      text: `[Open unsaved draft in MeadTools](${result.builderUrl})`
    });
    const id = url.hash.slice(5);
    const stored = drafts.get(id);
    assert.ok(stored.payload.length > 5253);
    assert.ok(stored.expires_at.getTime() > Date.now() + 23 * 60 * 60 * 1000);
    const owner = await redeem(id, 42);
    assert.equal(owner.status, 200);
    assert.equal(owner.headers.get("cache-control"), "private, no-store");
    const handoff = await owner.json();
    assert.deepEqual(handoff, {
      version: 1,
      name: arguments_.name,
      recipeData: result.recipeData,
      assumptions: result.assumptions,
      warnings: result.warnings
    });
    assert.ok(handoff.recipeData.nutrients);
    assert.equal(handoff.recipeData.additives[0].name, "Vanilla Bean");
    assert.equal(handoff.recipeData.ingredients.some(ingredient => ingredient.secondary), true);

    // Also carry native secondary notes if present in the draft payload.
    handoff.recipeData.notes.secondary = [{ lineId: "note-1", content: ["Syrup & zest 🍋", ""] }];
    stored.payload = encodeDraftHandoff(handoff);
    assert.deepEqual(await (await redeem(id, 42)).json(), handoff);

    assert.equal((await redeem(id)).status, 401);
    assert.equal((await redeem(id, 43)).status, 404);
    assert.equal((await redeem(`${id}%0a`, 42)).status, 404);
    stored.expires_at = new Date(0);
    assert.equal((await redeem(id, 42)).status, 404);

    failDraftWrites = true;
    const failed = await client.callTool({ name: "build_recipe_draft", arguments: arguments_ });
    const failedDraft = JSON.parse(failed.content[0].text).result;
    assert.equal(failedDraft.status, "recipe");
    assert.equal(failedDraft.builderUrl, undefined);
    assert.match(failedDraft.builderLinkError, /Could not create/);
    assert.equal(failed.content.length, 1);
    assert.equal(drafts.size, 0);
    failDraftWrites = false;
  }
  for (const name of mcpAccountReadToolNames) {
    const result = await client.callTool({ name, arguments: {} });
    assert.equal(result.isError, true);
    if (scope === base)
      assert.match(
        result.content[0].text,
        /Account read permission is required/
      );
  }
  await client.close();
  await server.close();
}
for (const name of calculatorToolNames)
  assert.equal(calculatorUsage.filter((tool) => tool === name).length, 2);
await prisma.$disconnect();
