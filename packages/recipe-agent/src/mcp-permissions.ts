/** Explicit MCP capabilities. Account access never follows from mcp:tools alone. */
export const MCP_SCOPE = "mcp:tools";
export const MCP_ACCOUNT_READ_SCOPE = "mcp:account:read";
export const MCP_SCOPES = [MCP_SCOPE, MCP_ACCOUNT_READ_SCOPE] as const;
export const mcpAccountReadToolNames = [
  "list_brews", "get_brew", "get_brew_timeline", "get_brew_sensor_history", "summarize_brew_sensor_history", "list_recipes", "get_recipe",
] as const;

/** Canonicalize known scopes; reject empty, unknown, duplicate or incomplete grants. */
export function normalizeMcpScope(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 128) return null;
  const scopes = value.split(" ");
  if (!scopes.includes(MCP_SCOPE) || new Set(scopes).size !== scopes.length ||
    scopes.some(scope => !MCP_SCOPES.some(known => known === scope))) return null;
  return MCP_SCOPES.filter(scope => scopes.includes(scope)).join(" ");
}

/** Refresh can preserve or reduce a grant, never add a capability. */
export function refreshMcpScope(granted: string, requested?: string): string | null {
  const current = normalizeMcpScope(granted);
  if (!current) return null;
  const next = requested === undefined ? current : normalizeMcpScope(requested);
  return next && next.split(" ").every(scope => current.split(" ").includes(scope)) ? next : null;
}

export function canReadMcpAccount(scope: string): boolean {
  return normalizeMcpScope(scope)?.split(" ").includes(MCP_ACCOUNT_READ_SCOPE) ?? false;
}

export function isMcpAccountReadTool(name: string): boolean {
  return mcpAccountReadToolNames.some(tool => tool === name);
}

/** Consent may reduce the client's requested access, never expand it. */
export function selectMcpConsentScope(requested: string, accountRead: boolean): string | null {
  const scope = normalizeMcpScope(requested);
  if (!scope || typeof accountRead !== "boolean") return null;
  if (!accountRead) return MCP_SCOPE;
  return canReadMcpAccount(scope) ? scope : null;
}
