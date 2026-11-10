const MCP_DRAFT_PREFIX = "#mcp-";
const MCP_DRAFT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isMcpDraftId(id: unknown): id is string {
  return typeof id === "string" && id.length === 36 && MCP_DRAFT_ID.test(id);
}

export function mcpDraftIdFromFragment(fragment: string) {
  return fragment.startsWith(MCP_DRAFT_PREFIX)
    ? fragment.slice(MCP_DRAFT_PREFIX.length)
    : null;
}

export function mcpDraftUrl(origin: string, id: string) {
  if (!isMcpDraftId(id)) throw new Error("Invalid MCP draft ID.");
  return new URL(`/recipe-draft${MCP_DRAFT_PREFIX}${id}`, origin).href;
}
