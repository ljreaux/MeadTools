import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/prisma";
import { getPremiumAccessStatus } from "@/lib/db/premium-access";
import { isMcpRolloutEnabled } from "@/lib/mcp/access";
import { MCP_SCOPE, mcpOrigin, mcpResource } from "@/lib/mcp/metadata";
import { isAllowedMcpRedirect } from "@/lib/mcp/redirect-uri";

const ACCESS_LIFETIME_MS = 60 * 60_000;
const REFRESH_LIFETIME_MS = 30 * 24 * 60 * 60_000;
const CODE_LIFETIME_MS = 10 * 60_000;
const CONSENT_LIFETIME_MS = 10 * 60_000;
const HASH_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export class OAuthRequestError extends Error {
  constructor(public code: string, message = code) { super(message); }
}

export function oauthHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function randomToken(prefix: string) {
  return `${prefix}${randomBytes(32).toString("base64url")}`;
}

function signingSecret() {
  const secret = process.env.MCP_OAUTH_SIGNING_SECRET;
  if (!secret || secret.length < 32) throw new Error("MCP OAuth signing is not configured.");
  return secret;
}

function hmac(value: string) {
  return createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

export async function registerMcpOAuthClient(input: unknown) {
  if (!isMcpRolloutEnabled()) throw new OAuthRequestError("temporarily_unavailable");
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new OAuthRequestError("invalid_client_metadata");
  }
  const metadata = input as Record<string, unknown>;
  const name = typeof metadata.client_name === "string"
    ? metadata.client_name.trim() : "MCP client";
  const uris = metadata.redirect_uris;
  if (
    name.length < 1 || name.length > 100 ||
    !Array.isArray(uris) || uris.length < 1 || uris.length > 5 ||
    !uris.every((uri) => typeof uri === "string" && isAllowedMcpRedirect(uri))
  ) throw new OAuthRequestError("invalid_client_metadata");
  if (
    metadata.token_endpoint_auth_method !== undefined && metadata.token_endpoint_auth_method !== "none"
  ) throw new OAuthRequestError("invalid_client_metadata");
  if (
    metadata.grant_types !== undefined &&
    (!Array.isArray(metadata.grant_types) ||
      metadata.grant_types.some((grant) => grant !== "authorization_code" && grant !== "refresh_token"))
  ) throw new OAuthRequestError("invalid_client_metadata");
  const clientId = randomToken("mtmcp_client_");
  const client = await prisma.mcp_oauth_clients.create({
    data: { client_id: clientId, client_name: name, redirect_uris: uris as string[] },
  });
  return {
    client_id: client.client_id,
    client_name: client.client_name,
    redirect_uris: client.redirect_uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    client_id_issued_at: Math.floor(client.created_at.getTime() / 1_000),
  };
}

export type AuthorizationRequest = {
  userId: number;
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  resource: string;
  scope: string;
  state: string;
};

export async function validateAuthorizationRequest(params: URLSearchParams, userId: number): Promise<AuthorizationRequest> {
  const clientId = params.get("client_id") ?? "";
  const redirectUri = params.get("redirect_uri") ?? "";
  const codeChallenge = params.get("code_challenge") ?? "";
  const resource = params.get("resource") ?? "";
  const scope = params.get("scope") || MCP_SCOPE;
  const state = params.get("state") ?? "";
  if (
    params.get("response_type") !== "code" ||
    params.get("code_challenge_method") !== "S256" ||
    !HASH_PATTERN.test(codeChallenge) ||
    resource !== mcpResource() || scope !== MCP_SCOPE ||
    state.length < 8 || state.length > 256
  ) throw new OAuthRequestError("invalid_request");
  const client = await prisma.mcp_oauth_clients.findUnique({ where: { client_id: clientId } });
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    throw new OAuthRequestError("invalid_client");
  }
  return { userId, clientId, clientName: client.client_name, redirectUri,
    codeChallenge, resource, scope, state };
}

export function signConsentRequest(request: AuthorizationRequest) {
  const payload = Buffer.from(JSON.stringify({
    ...request,
    expiresAt: Date.now() + CONSENT_LIFETIME_MS,
  })).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

export function verifyConsentRequest(value: string, userId: number): AuthorizationRequest {
  if (value.length > 4_096) throw new OAuthRequestError("invalid_request");
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !HASH_PATTERN.test(signature)) {
    throw new OAuthRequestError("invalid_request");
  }
  const expected = hmac(payload);
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new OAuthRequestError("invalid_request");
  }
  let parsed: AuthorizationRequest & { expiresAt: number };
  try { parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { throw new OAuthRequestError("invalid_request"); }
  if (
    parsed.userId !== userId || parsed.expiresAt <= Date.now() ||
    parsed.resource !== mcpResource() || parsed.scope !== MCP_SCOPE ||
    !HASH_PATTERN.test(parsed.codeChallenge) || !isAllowedMcpRedirect(parsed.redirectUri)
  ) throw new OAuthRequestError("invalid_request");
  return parsed;
}

export function oauthRedirect(request: AuthorizationRequest, value: { code?: string; error?: string }) {
  const url = new URL(request.redirectUri);
  if (value.code) url.searchParams.set("code", value.code);
  if (value.error) url.searchParams.set("error", value.error);
  url.searchParams.set("state", request.state);
  url.searchParams.set("iss", mcpOrigin());
  return url;
}

export async function issueAuthorizationCode(request: AuthorizationRequest, signedConsent: string) {
  if (!isMcpRolloutEnabled()) throw new OAuthRequestError("temporarily_unavailable");
  const access = await getPremiumAccessStatus(request.userId);
  if (!access.premiumEnabled) throw new OAuthRequestError("access_denied");
  const code = randomToken("mtmcp_code_");
  try {
    await prisma.mcp_oauth_codes.create({ data: {
      code_hash: oauthHash(code), consent_hash: oauthHash(signedConsent),
      user_id: request.userId, client_id: request.clientId,
      redirect_uri: request.redirectUri, code_challenge: request.codeChallenge,
      resource: request.resource, scope: request.scope,
      expires_at: new Date(Date.now() + CODE_LIFETIME_MS),
    } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      throw new OAuthRequestError("invalid_request", "This authorization was already used.");
    }
    throw error;
  }
  return code;
}

export async function exchangeAuthorizationCode(input: {
  code: string; clientId: string; redirectUri: string; verifier: string; resource: string;
}) {
  if (!isMcpRolloutEnabled()) throw new OAuthRequestError("temporarily_unavailable");
  if (
    input.code.length > 100 || input.clientId.length > 128 ||
    input.redirectUri.length > 2048 || input.resource !== mcpResource() ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(input.verifier)
  ) throw new OAuthRequestError("invalid_grant");
  const now = new Date();
  const code = await prisma.mcp_oauth_codes.findUnique({ where: { code_hash: oauthHash(input.code) } });
  if (
    !code || code.consumed_at || code.expires_at <= now ||
    code.client_id !== input.clientId || code.redirect_uri !== input.redirectUri ||
    code.resource !== input.resource
  ) throw new OAuthRequestError("invalid_grant");
  const challenge = createHash("sha256").update(input.verifier).digest("base64url");
  if (!timingSafeEqual(Buffer.from(challenge), Buffer.from(code.code_challenge))) {
    throw new OAuthRequestError("invalid_grant");
  }
  const access = await getPremiumAccessStatus(code.user_id, now);
  if (!access.premiumEnabled) throw new OAuthRequestError("access_denied");
  const client = await prisma.mcp_oauth_clients.findUnique({ where: { client_id: input.clientId } });
  if (!client || !client.redirect_uris.includes(input.redirectUri)) {
    throw new OAuthRequestError("invalid_client");
  }
  const accessToken = randomToken("mtmcp_");
  const refreshToken = randomToken("mtmcp_refresh_");
  const consumed = await prisma.$transaction(async (tx) => {
    const update = await tx.mcp_oauth_codes.updateMany({
      where: { code_hash: code.code_hash, consumed_at: null, expires_at: { gt: now } },
      data: { consumed_at: now },
    });
    if (update.count !== 1) return false;
    await tx.mcp_oauth_sessions.create({ data: {
      user_id: code.user_id, client_id: input.clientId, label: client.client_name,
      access_token_hash: oauthHash(accessToken), refresh_token_hash: oauthHash(refreshToken),
      resource: code.resource, scope: code.scope,
      access_expires_at: new Date(now.getTime() + ACCESS_LIFETIME_MS),
      refresh_expires_at: new Date(now.getTime() + REFRESH_LIFETIME_MS),
    } });
    return true;
  });
  if (!consumed) throw new OAuthRequestError("invalid_grant");
  return tokenResponse(accessToken, refreshToken, code.scope);
}

function tokenResponse(accessToken: string, refreshToken: string, scope: string) {
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_LIFETIME_MS / 1_000,
    refresh_token: refreshToken,
    scope,
  };
}

export async function exchangeRefreshToken(input: {
  refreshToken: string; clientId: string; resource: string; scope?: string;
}) {
  if (!isMcpRolloutEnabled()) throw new OAuthRequestError("temporarily_unavailable");
  if (input.resource !== mcpResource() || input.refreshToken.length > 100) {
    throw new OAuthRequestError("invalid_grant");
  }
  const now = new Date();
  const session = await prisma.mcp_oauth_sessions.findUnique({
    where: { refresh_token_hash: oauthHash(input.refreshToken) },
  });
  if (
    !session || session.revoked_at || session.refresh_expires_at <= now ||
    session.client_id !== input.clientId || session.resource !== input.resource ||
    (input.scope && input.scope !== session.scope)
  ) throw new OAuthRequestError("invalid_grant");
  const access = await getPremiumAccessStatus(session.user_id, now);
  if (!access.premiumEnabled) throw new OAuthRequestError("access_denied");
  const accessToken = randomToken("mtmcp_");
  const refreshToken = randomToken("mtmcp_refresh_");
  const update = await prisma.mcp_oauth_sessions.updateMany({
    where: {
      id: session.id, refresh_token_hash: oauthHash(input.refreshToken),
      revoked_at: null, refresh_expires_at: { gt: now },
    },
    data: {
      access_token_hash: oauthHash(accessToken), refresh_token_hash: oauthHash(refreshToken),
      access_expires_at: new Date(now.getTime() + ACCESS_LIFETIME_MS),
      refresh_expires_at: new Date(now.getTime() + REFRESH_LIFETIME_MS),
    },
  });
  if (update.count !== 1) throw new OAuthRequestError("invalid_grant");
  return tokenResponse(accessToken, refreshToken, session.scope);
}

export async function revokeOAuthToken(clientId: string, token: string) {
  const digest = oauthHash(token);
  await prisma.mcp_oauth_sessions.updateMany({
    where: {
      client_id: clientId, revoked_at: null,
      OR: [{ access_token_hash: digest }, { refresh_token_hash: digest }],
    },
    data: { revoked_at: new Date() },
  });
}
