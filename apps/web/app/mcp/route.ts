import { canReadMcpAccount, isMcpAccountReadTool, isRecipeEvaluationTool, MCP_ACCOUNT_READ_SCOPE } from "@meadtools/recipe-agent";
import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpAccessToken, isMcpRolloutEnabled } from "@/lib/mcp/access";
import { createMeadToolsMcpServer } from "@/lib/mcp/server";
import { MCP_SCOPE, mcpOrigin, protectedResourceMetadataUrl } from "@/lib/mcp/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_RECIPE_REQUEST_BYTES = 128 * 1024;

async function readMcpBody(request: Request) {
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  if (reader) {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_RECIPE_REQUEST_BYTES) {
          await reader.cancel().catch(() => {});
          return null;
        }
        text += decoder.decode(value, { stream: true });
      }
    } finally {
      reader.releaseLock();
    }
  }
  return { text: text + decoder.decode(), bytes };
}

function calledTool(body: unknown) {
  if (body && typeof body === "object" && "method" in body &&
    body.method === "tools/call" && "params" in body &&
    body.params && typeof body.params === "object" &&
    "name" in body.params && typeof body.params.name === "string") {
    return body.params.name;
  }
}


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
  let toolName: string | undefined;
  if (request.method === "POST") {
    const declaredBytes = Number(request.headers.get("content-length"));
    if (declaredBytes > MAX_RECIPE_REQUEST_BYTES) {
      return new NextResponse(null, { status: 413 });
    }
    const body = await readMcpBody(request);
    if (!body) return new NextResponse(null, { status: 413 });

    const requestBytes = Math.max(body.bytes, Number.isFinite(declaredBytes) ? declaredBytes : 0);
    try {
      parsedBody = JSON.parse(body.text);
    } catch {
      if (requestBytes > MAX_REQUEST_BYTES) return new NextResponse(null, { status: 413 });
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    toolName = calledTool(parsedBody);
    if (requestBytes > MAX_REQUEST_BYTES && !(toolName && isRecipeEvaluationTool(toolName))) {
      return new NextResponse(null, { status: 413 });
    }
  }

  // Protocol-level challenge supports clients that implement OAuth step-up.
  if (toolName && isMcpAccountReadTool(toolName) && !canReadMcpAccount(access.scope)) {
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
