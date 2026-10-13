import assert from "node:assert/strict";
import test from "node:test";
import {
  mcpTokenCreateBodySchema,
  mcpTokenListResponseSchema,
} from "../src/zod/mcp";

test("MCP connection names are bounded and do not accept extra fields", () => {
  assert.deepEqual(mcpTokenCreateBodySchema.parse({ label: "  Claude Desktop  " }), {
    label: "Claude Desktop",
  });
  assert.equal(mcpTokenCreateBodySchema.safeParse({ label: "" }).success, false);
  assert.equal(mcpTokenCreateBodySchema.safeParse({ label: "x".repeat(81) }).success, false);
  assert.equal(mcpTokenCreateBodySchema.safeParse({ label: "Client", userId: 1 }).success, false);
});

test("MCP connection listing requires a valid endpoint and dates", () => {
  const response = { endpoint: "https://meadtools.com/mcp", tokens: [{
    id: "f9949f9c-9917-4d68-b9d2-79f814673f3b",
    label: "Claude Desktop",
    createdAt: "2026-10-11T12:00:00.000Z",
    expiresAt: "2027-01-09T12:00:00.000Z",
    lastUsedAt: null,
  }] };
  assert.equal(mcpTokenListResponseSchema.safeParse(response).success, true);
  assert.equal(mcpTokenListResponseSchema.safeParse({ ...response, endpoint: "not-a-url" }).success, false);
  assert.equal(mcpTokenListResponseSchema.safeParse({ ...response, tokens: [{
    ...response.tokens[0], expiresAt: "tomorrow",
  }] }).success, false);
});
