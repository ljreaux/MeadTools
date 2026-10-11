import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpAccessToken, isMcpRolloutEnabled } from "@/lib/mcp/access";
import { createMeadToolsMcpServer } from "@/lib/mcp/server";
import { MCP_SCOPE, mcpOrigin, protectedResourceMetadataUrl } from "@/lib/mcp/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 16 * 1024;

function unauthorized() {
  return new NextResponse(null, {
    status: 401,
    headers: {
      "WWW-Authenticate": `Bearer resource_metadata="${protectedResourceMetadataUrl()}", scope="${MCP_SCOPE}"`,
      "Cache-Control": "no-store",
    },
  });
}

async function handle(request: NextRequest) {
  if (!isMcpRolloutEnabled()) return new NextResponse(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && origin !== mcpOrigin()) {
    return new NextResponse(null, { status: 403 });
  }
  const access = await authenticateMcpAccessToken(request.headers.get("authorization"));
  if (!access) return unauthorized();

  let parsedBody: unknown;
  if (request.method === "POST") {
    const length = Number(request.headers.get("content-length"));
    if (Number.isFinite(length) && length > MAX_REQUEST_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > MAX_REQUEST_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
    try {
      parsedBody = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  const server = createMeadToolsMcpServer(access.userId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request, { parsedBody });
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } finally {
    await server.close();
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
