import "server-only";
import { publicAppOrigin } from "@/lib/public-origin";

export { MCP_SCOPE, MCP_ACCOUNT_READ_SCOPE, MCP_SCOPES } from "@meadtools/recipe-agent";

export function mcpOrigin() {
  return publicAppOrigin();
}

export function mcpResource() {
  return `${mcpOrigin()}/mcp`;
}

export function protectedResourceMetadataUrl() {
  return `${mcpOrigin()}/.well-known/oauth-protected-resource/mcp`;
}
