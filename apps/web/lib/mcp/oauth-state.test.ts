import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedMcpOAuthState } from "./oauth-state";

test("accepts Gemini's long OAuth state while bounding its size", () => {
  assert.equal(isAllowedMcpOAuthState("s".repeat(1_400)), true);
  assert.equal(isAllowedMcpOAuthState("short"), false);
  assert.equal(isAllowedMcpOAuthState("s".repeat(2_049)), false);
});
