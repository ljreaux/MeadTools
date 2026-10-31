import "server-only";
import { normalizeMcpScope, MCP_ACCOUNT_READ_SCOPE } from "@meadtools/recipe-agent";

import { createHash, randomBytes } from "node:crypto";
import prisma from "@/lib/prisma";
import { getPremiumAccessStatus } from "@/lib/db/premium-access";
import { MCP_SCOPE, mcpResource } from "@/lib/mcp/metadata";

const TOKEN_LIFETIME_MS = 90 * 24 * 60 * 60 * 1_000;
const TOKEN_PATTERN = /^mtmcp_[A-Za-z0-9_-]{43}$/;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isMcpRolloutEnabled() {
  return process.env.PREMIUM_MCP_ENABLED === "true";
}

export async function createMcpAccessToken(userId: number, label: string, accountRead = false) {
  if (!isMcpRolloutEnabled()) throw new Error("MCP access is unavailable.");
  const access = await getPremiumAccessStatus(userId);
  if (!access.premiumEnabled) throw new Error("Premium access is required.");
  const normalizedLabel = label.trim();
  if (normalizedLabel.length < 1 || normalizedLabel.length > 80) {
    throw new Error("Enter a token name of up to 80 characters.");
  }
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const activeCount = await tx.mcp_access_tokens.count({
      where: { user_id: userId, revoked_at: null, expires_at: { gt: now } },
    });
    if (activeCount >= 5)
      throw new Error("Revoke an existing connection first.");

    const token = `mtmcp_${randomBytes(32).toString("base64url")}`;
    const expiresAt = new Date(now.getTime() + TOKEN_LIFETIME_MS);
    const record = await tx.mcp_access_tokens.create({
      data: {
        user_id: userId,
        label: normalizedLabel,
        scope: accountRead ? `${MCP_SCOPE} ${MCP_ACCOUNT_READ_SCOPE}` : MCP_SCOPE,
        token_hash: tokenHash(token),
        expires_at: expiresAt,
      },
      select: { scope: true, id: true, label: true, created_at: true, expires_at: true },
    });
    return { token, ...record };
  });
}

export async function listMcpAccessTokens(userId: number) {
  return prisma.mcp_access_tokens.findMany({
    where: { user_id: userId, revoked_at: null },
    select: { scope: true, id: true, label: true, created_at: true, expires_at: true, last_used_at: true },
    orderBy: { created_at: "desc" },
  });
}

export async function listMcpOAuthSessions(userId: number) {
  return prisma.mcp_oauth_sessions.findMany({
    where: { user_id: userId, revoked_at: null, refresh_expires_at: { gt: new Date() } },
    select: {
      scope: true, id: true, label: true, created_at: true,
      refresh_expires_at: true, last_used_at: true,
    },
    orderBy: { created_at: "desc" },
  });
}

export async function revokeMcpAccessToken(userId: number, tokenId: string) {
  const result = await prisma.mcp_access_tokens.updateMany({
    where: { id: tokenId, user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
  return result.count === 1;
}

export async function revokeMcpOAuthSession(userId: number, sessionId: string) {
  const result = await prisma.mcp_oauth_sessions.updateMany({
    where: { id: sessionId, user_id: userId, revoked_at: null },
    data: { revoked_at: new Date() },
  });
  return result.count === 1;
}

type McpAccessResult =
  | { kind: "authorized"; userId: number; tokenId: string; scope: string }
  | { kind: "premium_required" }
  | { kind: "unauthorized" };

export async function authenticateMcpAccessToken(header: string | null): Promise<McpAccessResult> {
  if (!isMcpRolloutEnabled()) return { kind: "unauthorized" };
  const match = /^Bearer (\S+)$/i.exec(header ?? "");
  const token = match?.[1];
  if (!token || !TOKEN_PATTERN.test(token)) return { kind: "unauthorized" };
  const now = new Date();
  const record = await prisma.mcp_access_tokens.findUnique({
    where: { token_hash: tokenHash(token) },
    select: { id: true, user_id: true, revoked_at: true, expires_at: true, scope: true },
  });
  const oauth = record ? null : await prisma.mcp_oauth_sessions.findUnique({
    where: { access_token_hash: tokenHash(token) },
    select: {
      id: true, user_id: true, revoked_at: true, access_expires_at: true,
      resource: true, scope: true,
    },
  });
  if (
    (!record && !oauth) || (record && !normalizeMcpScope(record.scope)) || record?.revoked_at ||
    (record && record.expires_at <= now) || oauth?.revoked_at ||
    (oauth && (oauth.access_expires_at <= now || oauth.resource !== mcpResource() || !normalizeMcpScope(oauth.scope)))
  ) return { kind: "unauthorized" };
  const userId = record?.user_id ?? oauth?.user_id;
  if (!userId) return { kind: "unauthorized" };
  const access = await getPremiumAccessStatus(userId, now);
  if (!access.activeUser || access.paymentRestricted) return { kind: "unauthorized" };
  if (!access.premiumEnabled) return { kind: "premium_required" };
  if (record) {
    await prisma.mcp_access_tokens.update({
      where: { id: record.id },
      data: { last_used_at: now },
    });
  } else if (oauth) {
    await prisma.mcp_oauth_sessions.update({
      where: { id: oauth.id },
      data: { last_used_at: now },
    });
  }
  return { kind: "authorized", userId, tokenId: record?.id ?? oauth!.id, scope: normalizeMcpScope(record?.scope ?? oauth!.scope)! };
}
