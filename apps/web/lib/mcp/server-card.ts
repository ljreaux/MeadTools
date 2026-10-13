import "server-only";

import { isMcpRolloutEnabled } from "@/lib/mcp/access";
import { mcpOrigin, mcpResource } from "@/lib/mcp/metadata";

/** Public discovery document for the optional MCP Server Card extension. */
export function getMcpServerCard() {
  if (!isMcpRolloutEnabled()) return new Response(null, { status: 404 });

  const card = {
    $schema: "https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json",
    name: "com.meadtools/mcp",
    title: "MeadTools",
    version: "0.1.0",
    description: "Read-only mead recipe, ingredient, yeast, wiki, and calculation tools.",
    websiteUrl: mcpOrigin(),
    remotes: [{ type: "streamable-http", url: mcpResource() }],
  };

  return new Response(JSON.stringify(card), {
    headers: {
      "Content-Type": "application/mcp-server-card+json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
