import { registerHooks } from "node:module";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as mcpPost } from "../../../app/mcp/route.ts";
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
import { mcpAccountReadToolNames } from "@meadtools/recipe-agent";
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
const { GET: getResourceMetadata } =
  await import("../../../app/.well-known/oauth-protected-resource/route.ts");
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
        url: "data:text/javascript,export async function verifyUser() { return 42; }",
        shortCircuit: true
      };
    }
    return nextResolve(specifier, context);
  }
});
const tokenRoute =
  await import("../../../app/api/account/premium/mcp/tokens/route.ts");
const authorizeRoute = await import("../../../app/oauth/authorize/route.ts");
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

// Real SDK protocol exchange, no network, database or model provider.
for (const scope of [base, expanded]) {
  const server = createMeadToolsMcpServer(42, scope);
  const client = new Client({ name: "offline-permissions", version: "1" });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const inventory = await client.listTools();
  assert.equal(inventory.tools.length, scope === base ? 7 : 14);
  for (const tool of inventory.tools)
    assert.equal(tool.annotations.readOnlyHint, true);
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
await prisma.$disconnect();
