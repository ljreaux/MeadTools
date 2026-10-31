import assert from "node:assert/strict";
import test from "node:test";
import { selectMcpConsentScope, canReadMcpAccount, normalizeMcpScope, refreshMcpScope, mcpAccountReadToolNames, isMcpAccountReadTool } from "../src/mcp-permissions";

test("account reads require the separate known capability", () => {
  assert.equal(canReadMcpAccount("mcp:tools"), false);
  assert.equal(canReadMcpAccount("mcp:tools mcp:account:read"), true);
  assert.equal(normalizeMcpScope("mcp:account:read mcp:tools"), "mcp:tools mcp:account:read");
  for (const invalid of ["", "mcp:account:read", "mcp:tools mcp:write", "mcp:tools mcp:tools", "mcp:tools ", null]) {
    assert.equal(normalizeMcpScope(invalid), null);
  }
  assert.equal(mcpAccountReadToolNames.length, 7);
  for (const name of mcpAccountReadToolNames) assert.equal(isMcpAccountReadTool(name), true);
  assert.equal(isMcpAccountReadTool("search_ingredients"), false);
});

test("refresh never upgrades legacy credentials and persists reductions", () => {
  const expanded = "mcp:tools mcp:account:read";
  assert.equal(refreshMcpScope("mcp:tools"), "mcp:tools");
  assert.equal(refreshMcpScope("mcp:tools", expanded), null);
  assert.equal(refreshMcpScope(expanded), expanded);
  assert.equal(refreshMcpScope(expanded, "mcp:tools"), "mcp:tools");
  assert.equal(refreshMcpScope("mcp:tools", "mcp:write"), null);
  assert.equal(refreshMcpScope(expanded, ""), null);
});


test("consent defaults to basic access and cannot exceed the requested scopes", () => {
  const expanded = "mcp:tools mcp:account:read";
  assert.equal(selectMcpConsentScope(expanded, false), "mcp:tools");
  assert.equal(selectMcpConsentScope(expanded, true), expanded);
  assert.equal(selectMcpConsentScope("mcp:tools", false), "mcp:tools");
  assert.equal(selectMcpConsentScope("mcp:tools", true), null);
  assert.equal(selectMcpConsentScope("mcp:tools mcp:write", false), null);
});
