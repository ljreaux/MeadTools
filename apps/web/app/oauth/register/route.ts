import { NextRequest, NextResponse } from "next/server";
import { OAuthRequestError, registerMcpOAuthClient } from "@/lib/mcp/oauth";

export const runtime = "nodejs";

/** Public dynamic client registration for approved MCP client callbacks. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > 4_096) {
      return NextResponse.json({ error: "invalid_client_metadata" }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "invalid_client_metadata" }, { status: 400 });
  }
  try {
    const client = await registerMcpOAuthClient(body);
    return NextResponse.json(client, {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof OAuthRequestError) {
      return NextResponse.json({ error: error.code }, { status: 400 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
