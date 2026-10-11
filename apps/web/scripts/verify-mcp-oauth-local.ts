/** Disposable OAuth + MCP HTTP check; it makes no real model calls. */
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
const databaseUrl = process.env.DATABASE_URL;
if (
  !baseUrl || !URL.canParse(baseUrl) || !["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname) ||
  !databaseUrl || !URL.canParse(databaseUrl) || !["localhost", "127.0.0.1"].includes(new URL(databaseUrl).hostname) ||
  !process.env.ACCESS_TOKEN_SECRET
) throw new Error("The OAuth fixture requires local web, database, and auth configuration.");

let userId: number | null = null;
let clientId: string | null = null;
try {
  const user = await prisma.users.create({ data: { email: `mcp-oauth-${randomUUID()}@example.invalid` } });
  userId = user.id;
  await prisma.premium_memberships.create({ data: {
    user_id: user.id, source: "manual", paid_through: new Date(Date.now() + 24 * 60 * 60_000),
  } });
  const accountToken = jwt.sign({ id: user.id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "5m" });
  const resource = `${baseUrl}/mcp`;
  const redirectUri = "http://localhost:49645/callback";
  const registration = await fetch(`${baseUrl}/oauth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Local MCP fixture", redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"], token_endpoint_auth_method: "none" }),
  });
  assert.equal(registration.status, 201, "OAuth client registration must succeed");
  const registered = await registration.json() as { client_id: string };
  clientId = registered.client_id;
  assert.equal((await fetch(`${baseUrl}/oauth/register`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: "Untrusted callback",
      redirect_uris: ["https://example.invalid/callback"] }),
  })).status, 400, "Unapproved OAuth callbacks must be rejected");

  const protectedMetadata = await (await fetch(`${baseUrl}/.well-known/oauth-protected-resource`)).json() as { resource: string };
  const authorizationMetadata = await (await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)).json() as { code_challenge_methods_supported: string[] };
  assert.equal(protectedMetadata.resource, resource);
  assert.deepEqual(authorizationMetadata.code_challenge_methods_supported, ["S256"]);

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorizeUrl = new URL(`${baseUrl}/oauth/authorize`);
  for (const [key, value] of Object.entries({
    response_type: "code", client_id: clientId, redirect_uri: redirectUri,
    code_challenge: challenge, code_challenge_method: "S256",
    resource, scope: "mcp:tools", state: randomBytes(16).toString("base64url"),
  })) authorizeUrl.searchParams.set(key, value);
  const browserRedirect = await fetch(authorizeUrl, { redirect: "manual" });
  assert.equal(browserRedirect.status, 307, "Browser authorization must open the consent page");
  assert.match(browserRedirect.headers.get("location") ?? "", /\/oauth\/connect\?/);
  const authorize = await fetch(authorizeUrl, {
    headers: { Authorization: `Bearer ${accountToken}`, Accept: "application/json" },
  });
  assert.equal((await fetch(authorizeUrl, { headers: { Accept: "application/json" } })).status,
    401, "Consent details must require an account");
  assert.equal(authorize.status, 200, "Consent details must load for the signed-in user");
  const { signedRequest } = await authorize.json() as { signedRequest: string };
  assert.ok(signedRequest, "Consent details must contain a signed request");

  const approval = await fetch(`${baseUrl}/oauth/authorize`, {
    method: "POST", redirect: "manual",
    headers: { Authorization: `Bearer ${accountToken}`, Origin: baseUrl,
      Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ authorization_request: signedRequest, decision: "approve" }),
  });
  assert.equal(approval.status, 200, "Browser consent must return the registered callback");
  const callback = new URL((await approval.json() as { redirectUrl: string }).redirectUrl);
  assert.equal(callback.origin + callback.pathname, redirectUri);
  assert.equal(callback.searchParams.get("iss"), baseUrl);
  const code = callback.searchParams.get("code");
  assert.ok(code, "Consent must issue an authorization code");
  const replay = await fetch(`${baseUrl}/oauth/authorize`, {
    method: "POST", redirect: "manual",
    headers: { Authorization: `Bearer ${accountToken}`, Origin: baseUrl,
      "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ authorization_request: signedRequest, decision: "approve" }),
  });
  assert.equal(replay.status, 400, "Consent approval must be single use");

  const tokenRequest = (fields: Record<string, string>) => fetch(`${baseUrl}/oauth/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  assert.equal((await tokenRequest({ grant_type: "authorization_code", client_id: clientId,
    code, redirect_uri: redirectUri, code_verifier: randomBytes(32).toString("base64url"),
    resource })).status, 400, "The wrong PKCE verifier must not exchange a code");
  const token = await tokenRequest({ grant_type: "authorization_code", client_id: clientId,
    code, redirect_uri: redirectUri, code_verifier: verifier, resource });
  assert.equal(token.status, 200, "Authorization code exchange must succeed");
  const first = await token.json() as { access_token: string; refresh_token: string };
  const mcpCall = (bearer: string) => fetch(resource, { method: "POST",
    headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json, text/event-stream",
      "Content-Type": "application/json", "MCP-Protocol-Version": "2025-11-25" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  assert.equal((await mcpCall(first.access_token)).status, 200);
  assert.equal((await tokenRequest({ grant_type: "authorization_code", client_id: clientId,
    code, redirect_uri: redirectUri, code_verifier: verifier, resource })).status, 400,
  "An authorization code must be single use");

  const refresh = await tokenRequest({ grant_type: "refresh_token", client_id: clientId,
    refresh_token: first.refresh_token, resource });
  assert.equal(refresh.status, 200);
  const second = await refresh.json() as { access_token: string; refresh_token: string };
  assert.equal((await mcpCall(first.access_token)).status, 401);
  assert.equal((await mcpCall(second.access_token)).status, 200);
  assert.equal((await tokenRequest({ grant_type: "refresh_token", client_id: clientId,
    refresh_token: first.refresh_token, resource })).status, 400);

  await prisma.premium_memberships.update({
    where: { user_id_source: { user_id: user.id, source: "manual" } },
    data: { revoked_at: new Date() },
  });
  assert.equal((await mcpCall(second.access_token)).status, 401,
    "Losing premium must immediately block MCP access");
  assert.equal((await tokenRequest({ grant_type: "refresh_token", client_id: clientId,
    refresh_token: second.refresh_token, resource })).status, 400,
  "Losing premium must block OAuth refresh");

  const revoked = await fetch(`${baseUrl}/oauth/revoke`, { method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, token: second.refresh_token }),
  });
  assert.equal(revoked.status, 200);
  assert.equal((await mcpCall(second.access_token)).status, 401);
  console.log("Local MCP OAuth registration, consent, PKCE, refresh, and revocation passed.");
} finally {
  if (userId !== null) {
    await prisma.mcp_tool_usage.deleteMany({ where: { user_id: userId } });
    await prisma.mcp_tool_leases.deleteMany({ where: { user_id: userId } });
    await prisma.mcp_rate_buckets.deleteMany({ where: { user_id: userId } });
    await prisma.mcp_oauth_sessions.deleteMany({ where: { user_id: userId } });
    await prisma.mcp_oauth_codes.deleteMany({ where: { user_id: userId } });
    await prisma.premium_memberships.deleteMany({ where: { user_id: userId } });
    await prisma.users.delete({ where: { id: userId } });
  }
  if (clientId) await prisma.mcp_oauth_clients.deleteMany({ where: { client_id: clientId } });
  await prisma.$disconnect();
}
