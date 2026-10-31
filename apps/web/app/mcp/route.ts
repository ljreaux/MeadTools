import { canReadMcpAccount, isMcpAccountReadTool, MCP_ACCOUNT_READ_SCOPE } from "@meadtools/recipe-agent";
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
      // Without a scope override, clients discover both supported capabilities
      // and the owner selects the granted subset on the consent screen.
      "WWW-Authenticate": `Bearer resource_metadata="${protectedResourceMetadataUrl()}"`,
      "Cache-Control": "no-store",
    },
  });
}

function premiumRequired() {
  return NextResponse.json({
    error: "premium_required",
    message: "Premium access is required to use MeadTools MCP. Check your membership in MeadTools.",
    help_url: `${mcpOrigin()}/account/premium`,
  }, {
    status: 403,
    headers: { "Cache-Control": "no-store" },
  });
}

async function handle(request: NextRequest) {
  if (!isMcpRolloutEnabled()) return new NextResponse(null, { status: 404 });
  const origin = request.headers.get("origin");
  if (origin && origin !== mcpOrigin()) {
    return new NextResponse(null, { status: 403 });
  }
  const access = await authenticateMcpAccessToken(request.headers.get("authorization"));
  if (access.kind === "unauthorized") return unauthorized();
  if (access.kind === "premium_required") return premiumRequired();

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

  // Protocol-level challenge supports clients that implement OAuth step-up.
  if (parsedBody && typeof parsedBody === "object" && "method" in parsedBody &&
    parsedBody.method === "tools/call" && "params" in parsedBody &&
    parsedBody.params && typeof parsedBody.params === "object" &&
    "name" in parsedBody.params && typeof parsedBody.params.name === "string" &&
    isMcpAccountReadTool(parsedBody.params.name) && !canReadMcpAccount(access.scope)) {
    return NextResponse.json({ error: "insufficient_scope", message: "Reconnect and explicitly allow private account reads." }, {
      status: 403,
      headers: {
        "WWW-Authenticate": `Bearer error="insufficient_scope", resource_metadata="${protectedResourceMetadataUrl()}", scope="${MCP_SCOPE} ${MCP_ACCOUNT_READ_SCOPE}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const server = createMeadToolsMcpServer(access.userId, access.scope);
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
