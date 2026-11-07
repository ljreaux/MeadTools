import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createFinishedMeadRequestBodySchema, updateFinishedMeadRequestBodySchema } from "../src/zod/inventory";

test("finished-mead requests bind changes to a reviewed revision and forbid ownership injection", () => {
  const create = { operation_id: randomUUID(), mead: { name: "My collection", bottles: [{ size_liters: 0.75, quantity: 12 }] } };
  assert.ok(createFinishedMeadRequestBodySchema.safeParse(create).success);
  assert.equal(createFinishedMeadRequestBodySchema.safeParse({ ...create, user_id: 4 }).success, false);
  const change = { operation_id: randomUUID(), action: "manual_use", size_liters: 0.75, quantity: 1 };
  assert.equal(updateFinishedMeadRequestBodySchema.safeParse(change).success, false);
  assert.ok(updateFinishedMeadRequestBodySchema.safeParse({ ...change, expected_revision: "a".repeat(64) }).success);
  for (const quantity of [0, -1, 0.5])
    assert.equal(updateFinishedMeadRequestBodySchema.safeParse({ ...change, expected_revision: "a".repeat(64), quantity }).success, false);
  assert.ok(updateFinishedMeadRequestBodySchema.safeParse({ ...change, action: "correction", expected_revision: "a".repeat(64), quantity: 0 }).success);
});
