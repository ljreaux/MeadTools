import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedMcpRedirect } from "./redirect-uri";

test("accepts registered HTTPS callbacks for other MCP clients", () => {
  assert.equal(isAllowedMcpRedirect("https://claude.ai/api/mcp/auth_callback"), true);
  assert.equal(isAllowedMcpRedirect("https://chatgpt.com/connector_platform_oauth_redirect"), true);
  assert.equal(isAllowedMcpRedirect("https://assistant.example:8443/oauth/callback?source=mcp"), true);
});

test("accepts loopback callbacks for desktop clients", () => {
  assert.equal(isAllowedMcpRedirect("http://127.0.0.1:49152/oauth/callback"), true);
  assert.equal(isAllowedMcpRedirect("http://[::1]:49152/callback"), true);
  assert.equal(isAllowedMcpRedirect("http://localhost:49152/callback"), true);
});

test("rejects insecure or ambiguous callbacks", () => {
  for (const uri of [
    "http://assistant.example/callback",
    "https://user:password@assistant.example/callback",
    "https://assistant.example/callback#token",
    "https://assistant.example/callback#",
    "file:///tmp/callback",
    "javascript:alert(1)",
    "not-a-url",
    `https://assistant.example/${"a".repeat(2_048)}`,
  ]) {
    assert.equal(isAllowedMcpRedirect(uri), false, uri);
  }
});
