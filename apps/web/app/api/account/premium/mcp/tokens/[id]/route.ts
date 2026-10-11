import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { mcpTokenRevokeResponseSchema } from "@meadtools/api-contract/mcp";
import { verifyUser } from "@/lib/userAccessFunctions";
import { revokeMcpAccessToken, revokeMcpOAuthSession } from "@/lib/mcp/access";

export const runtime = "nodejs";

/**
 * Revoke one owned MCP credential immediately.
 * @response 200:McpTokenRevokeResponse
 * @responseSet none
 * @add 400:McpErrorResponse
 * @add 401:McpErrorResponse
 * @add 403:McpErrorResponse
 * @add 404:McpErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext<"/api/account/premium/mcp/tokens/[id]">,
) {
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid connection" }, { status: 400 });
  }
  const revoked = await revokeMcpAccessToken(userId, id) ||
    await revokeMcpOAuthSession(userId, id);
  if (!revoked) return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  return NextResponse.json(mcpTokenRevokeResponseSchema.parse({ revoked: true }));
}
