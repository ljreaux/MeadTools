import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { NextRequest } from "next/server";
import prisma from "../../prisma.ts";
import { exchangeAuthorizationCode, exchangeRefreshToken } from "../oauth.ts";
const hooks = registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/userAccessFunctions") return {
    url: "data:text/javascript,export async function verifyUser() { return 42; }", shortCircuit: true,
  };
  return nextResolve(specifier, context);
} });
const { GET, POST } = await import("../../../app/oauth/authorize/route.ts");
hooks.deregister();
const origin = "http://localhost:3000", resource = origin + "/mcp";
const redirectUri = "https://client.example.invalid/callback";
const base = "mcp:tools", expanded = base + " mcp:account:read";
const verifier = "v".repeat(43);
const challenge = createHash("sha256").update(verifier).digest("base64url");
const codes = new Map(), consents = new Set();
let session;
prisma.users.findUnique = async () => ({ active: true, credit_account: null,
  premium_memberships: [{ source: "manual", paid_through: new Date(Date.now() + 86400000), revoked_at: null }],
});
prisma.mcp_oauth_clients.findUnique = async () => ({ client_name: "Consent fixture", redirect_uris: [redirectUri] });
prisma.$transaction = async fn => fn(prisma);
prisma.$queryRaw = async () => [];
prisma.mcp_oauth_codes.create = async ({ data }) => {
  if (consents.has(data.consent_hash)) throw Object.assign(new Error("Consent already used"), { code: "P2002" });
  consents.add(data.consent_hash); codes.set(data.code_hash, data); return data;
};
prisma.mcp_oauth_codes.findUnique = async ({ where }) => codes.get(where.code_hash);
prisma.mcp_oauth_codes.updateMany = async ({ where, data }) => {
  const code = codes.get(where.code_hash);
  if (!code || code.consumed_at) return { count: 0 };
  Object.assign(code, data); return { count: 1 };
};
prisma.mcp_oauth_sessions.create = async ({ data }) => { session = { ...data, id: "fixture" }; return session; };
prisma.mcp_oauth_sessions.findUnique = async () => session;
prisma.mcp_oauth_sessions.update = async ({ data }) => { Object.assign(session, data); return session; };
prisma.mcp_oauth_consumed_refresh_tokens.create = async () => ({});
const post = (signedRequest, selection, decision = "approve") => POST(new NextRequest(origin + "/oauth/authorize", {
  method: "POST", headers: { Accept: "application/json", Origin: origin },
  body: new URLSearchParams({ authorization_request: signedRequest, decision,
    ...(selection === undefined ? {} : { account_read: selection }),
  }),
}));
let index = 0;
const getConsent = async requested => {
  const query = new URLSearchParams({ response_type: "code", client_id: "client", redirect_uri: redirectUri,
    code_challenge_method: "S256", code_challenge: challenge, scope: requested, resource, state: "fixture-state-" + index++,
  });
  const response = await GET(new NextRequest(origin + "/oauth/authorize?" + query, { headers: { Accept: "application/json" } }));
  assert.equal(response.status, 200); return response.json();
};
for (const [requested, selection, expected] of [
  [base, undefined, base], [base, "false", base], [base, "true", null],
  [expanded, undefined, base], [expanded, "false", base], [expanded, "true", expanded],
  [expanded, "yes", null], [expanded, "1", null], [expanded, "", null],
]) {
  const { signedRequest, accountRead } = await getConsent(requested);
  assert.equal(accountRead, requested === expanded);
  const countBefore = codes.size;
  const approved = await post(signedRequest, selection);
  assert.equal(approved.status, expected ? 200 : 400);
  if (!expected) {
    assert.equal(codes.size, countBefore, "invalid or elevated choices cannot issue codes"); continue;
  }
  const code = new URL((await approved.json()).redirectUrl).searchParams.get("code");
  assert.equal(codes.get(createHash("sha256").update(code).digest("hex")).scope, expected);
  const tokens = await exchangeAuthorizationCode({ code, clientId: "client", redirectUri, verifier, resource });
  assert.equal(tokens.scope, expected); assert.equal(session.scope, expected);
  if (expected === base) {
    await assert.rejects(exchangeRefreshToken({ refreshToken: tokens.refresh_token, clientId: "client", resource, scope: expanded }));
    assert.equal(session.scope, base);
  }
  const refreshed = await exchangeRefreshToken({ refreshToken: tokens.refresh_token, clientId: "client", resource });
  assert.equal(refreshed.scope, expected); assert.equal(session.scope, expected);
  // A different permission choice cannot replay the same signed consent.
  assert.equal((await post(signedRequest, selection === "true" ? "false" : "true")).status, 400);
  assert.equal(codes.size, countBefore + 1);
}
const deniedRequest = await getConsent(expanded);
const beforeDeny = codes.size;
const denied = await post(deniedRequest.signedRequest, "true", "deny");
assert.equal(new URL((await denied.json()).redirectUrl).searchParams.get("error"), "access_denied");
assert.equal(codes.size, beforeDeny);
await prisma.$disconnect();
