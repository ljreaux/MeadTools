import { NextRequest, NextResponse } from "next/server";
import {
  mcpTokenCreateBodySchema,
  mcpTokenCreateResponseSchema,
  mcpTokenListResponseSchema,
} from "@meadtools/api-contract/mcp";
import { verifyUser } from "@/lib/userAccessFunctions";
import { getPremiumAccessStatus } from "@/lib/db/premium-access";
import {
  createMcpAccessToken,
  isMcpRolloutEnabled,
  listMcpAccessTokens,
  listMcpOAuthSessions,
} from "@/lib/mcp/access";
import { mcpResource } from "@/lib/mcp/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List the signed-in account's revocable MCP credentials.
 * @response 200:McpTokenListResponse
 * @responseSet none
 * @add 401:McpErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
export async function GET(request: NextRequest) {
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [tokens, oauthSessions] = await Promise.all([
    listMcpAccessTokens(userId),
    listMcpOAuthSessions(userId),
  ]);
  return NextResponse.json(mcpTokenListResponseSchema.parse({
    endpoint: mcpResource(),
    tokens: [
      ...tokens.map((token) => ({
      id: token.id,
      label: token.label,
      createdAt: token.created_at.toISOString(),
      expiresAt: token.expires_at.toISOString(),
      lastUsedAt: token.last_used_at?.toISOString() ?? null,
      })),
      ...oauthSessions.map((session) => ({
        id: session.id,
        label: session.label,
        createdAt: session.created_at.toISOString(),
        expiresAt: session.refresh_expires_at.toISOString(),
        lastUsedAt: session.last_used_at?.toISOString() ?? null,
      })),
    ],
  }));
}

/**
 * Create a 90-day MCP bearer credential, displayed once.
 * @body McpTokenCreateBody
 * @response 200:McpTokenCreateResponse
 * @responseSet none
 * @add 400:McpErrorResponse
 * @add 401:McpErrorResponse
 * @add 403:McpErrorResponse
 * @add 413:McpErrorResponse
 * @add 503:McpErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
export async function POST(request: NextRequest) {
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (!isMcpRolloutEnabled()) {
    return NextResponse.json({ error: "MCP access is unavailable" }, { status: 503 });
  }
  const access = await getPremiumAccessStatus(userId);
  if (!access.premiumEnabled) {
    return NextResponse.json({ error: "Premium access is required" }, { status: 403 });
  }
  let body: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 1_024) {
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = mcpTokenCreateBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid token name" }, { status: 400 });
  }
  try {
    const token = await createMcpAccessToken(userId, parsed.data.label);
    return NextResponse.json(mcpTokenCreateResponseSchema.parse({
      id: token.id,
      label: token.label,
      token: token.token,
      createdAt: token.created_at.toISOString(),
      expiresAt: token.expires_at.toISOString(),
    }), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (["MCP access is unavailable.", "Premium access is required.",
      "Enter a token name of up to 80 characters.", "Revoke an existing connection first."].includes(message)) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return NextResponse.json({ error: "Unable to create connection" }, { status: 500 });
  }
}
