import { NextResponse } from "next/server";
import { MCP_SCOPES, mcpOrigin } from "@/lib/mcp/metadata";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const origin = mcpOrigin();
  return NextResponse.json({
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [...MCP_SCOPES],
    authorization_response_iss_parameter_supported: true,
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
