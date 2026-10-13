import { NextRequest, NextResponse } from "next/server";
import { revokeOAuthToken } from "@/lib/mcp/oauth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 2_048) return new NextResponse(null, { status: 413 });
  const body = await request.text();
  if (Buffer.byteLength(body, "utf8") > 2_048) return new NextResponse(null, { status: 413 });
  const form = new URLSearchParams(body);
  const clientId = form.get("client_id") ?? "";
  const token = form.get("token") ?? "";
  if (clientId.length <= 128 && token.length <= 100) {
    await revokeOAuthToken(clientId, token);
  }
  return new NextResponse(null, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}
