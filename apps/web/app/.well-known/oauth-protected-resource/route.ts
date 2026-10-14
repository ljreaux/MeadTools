import { NextResponse } from "next/server";
import { MCP_SCOPES, mcpOrigin, mcpResource } from "@/lib/mcp/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      resource: mcpResource(),
      authorization_servers: [mcpOrigin()],
      scopes_supported: [...MCP_SCOPES],
      resource_documentation: `${mcpOrigin()}/integrations/mcp`,
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
