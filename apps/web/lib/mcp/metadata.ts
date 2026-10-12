import "server-only";
import { publicAppOrigin } from "@/lib/public-origin";

export const MCP_SCOPE = "mcp:tools";

export function mcpOrigin() {
  return publicAppOrigin();
}

export function mcpResource() {
  return `${mcpOrigin()}/mcp`;
}

export function protectedResourceMetadataUrl() {
  return `${mcpOrigin()}/.well-known/oauth-protected-resource`;
}
