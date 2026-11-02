import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { NextRequest } from "next/server";
import prisma from "../../prisma.ts";

// Authentication is outside this regression: stub its boundary before loading
// the real route, so NextAuth's framework-specific loader is not needed here.
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/userAccessFunctions") {
    return { url: "data:text/javascript,export async function verifyUser() { return 42; }", shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
const { GET, POST } = await import("../../../app/oauth/authorize/route.ts");
hooks.deregister();

// Only dummy credentials are passed by the parent; all database calls are mocked.
const origin = "http://localhost:3000";
const redirectUri = `https://client.example.invalid/callback?context=${"x".repeat(850)}`;
prisma.users.findUnique = async () => ({
  id: 42, active: true, credit_account: null,
  premium_memberships: [{ source: "manual", paid_through: new Date(Date.now() + 86_400_000), revoked_at: null }],
});
prisma.mcp_oauth_clients.findUnique = async () => ({ client_name: "Test client", redirect_uris: [redirectUri] });
let issuedCodes = 0;
prisma.mcp_oauth_codes.create = async () => { issuedCodes++; return {}; };
const query = new URLSearchParams({
  client_id: "test-client", redirect_uri: redirectUri, response_type: "code",
  code_challenge_method: "S256", code_challenge: "a".repeat(43),
  resource: `${origin}/mcp`, state: "s".repeat(2048),
});
assert.ok(Buffer.byteLength(`?${query}`) < 4_096);
const headers = {
  Accept: "application/json", Origin: origin,
};
const response = await GET(new NextRequest(`${origin}/oauth/authorize?${query}`, { headers }));
assert.equal(response.status, 200);
const { signedRequest } = await response.json();
for (const explicitLength of [false, true]) {
  const decision = explicitLength ? "deny" : "approve";
  const body = new URLSearchParams({ authorization_request: signedRequest, decision }).toString();
  assert.ok(Buffer.byteLength(body) > 4_096, "fixture must reproduce the previous POST limit failure");
  const consent = await POST(new NextRequest(`${origin}/oauth/authorize`, {
    method: "POST", body,
    headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded",
      ...(explicitLength ? { "Content-Length": String(Buffer.byteLength(body)) } : {}) },
  }));
  assert.equal(consent.status, 200);
  const callback = new URL((await consent.json()).redirectUrl);
  if (decision === "approve") assert.ok(callback.searchParams.get("code"));
  else assert.equal(callback.searchParams.get("error"), "access_denied");
  assert.equal(callback.searchParams.get("state"), "s".repeat(2048));
}
for (const explicitLength of [false, true]) {
  const oversized = "x".repeat(8_193);
  const rejected = await POST(new NextRequest(`${origin}/oauth/authorize`, {
    method: "POST", body: oversized,
    headers: { ...headers, ...(explicitLength ? { "Content-Length": String(oversized.length) } : {}) },
  }));
  assert.equal(rejected.status, 413);
}
assert.equal(issuedCodes, 1, "denied and oversized requests must not issue codes");
await prisma.$disconnect();
