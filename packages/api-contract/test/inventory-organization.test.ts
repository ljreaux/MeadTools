import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import {
  updateInventoryStorageRequestBodySchema,
  updateInventoryOrganizationRequestBodySchema,
  updateInventoryStockRequestBodySchema,
  updateFinishedMeadRequestBodySchema,
} from "../src/zod/inventory";
test("organization and moves reject foreign ownership injection and duplicate positions", () => {
  const label = {
    action: "create_label",
    name: "Competition",
    operation_id: randomUUID(),
  };
  assert.ok(
    updateInventoryOrganizationRequestBodySchema.safeParse(label).success,
  );
  assert.equal(
    updateInventoryOrganizationRequestBodySchema.safeParse({
      ...label,
      user_id: 8,
    }).success,
    false,
  );
  const row = { location_id: randomUUID(), position: "C3", quantity: 1 };
  const storage = {
    operation_id: randomUUID(),
    expected_revision: "a".repeat(64),
    allocations: [row],
  };
  assert.ok(updateInventoryStorageRequestBodySchema.safeParse(storage).success);
  assert.equal(
    updateInventoryStorageRequestBodySchema.safeParse({
      ...storage,
      allocations: [row, row],
    }).success,
    false,
  );
  assert.equal(
    updateInventoryStorageRequestBodySchema.safeParse({
      ...storage,
      expected_revision: "old",
    }).success,
    false,
  );
});
test("manual use accepts an optional location source without changing legacy requests", () => {
  const source = { location_id: randomUUID(), position: "C3" };
  const stock = {
    action: "manual_use",
    operation_id: randomUUID(),
    quantity: { value: 1, unit: "units" },
    expected_balance: { value: 5, unit: "units" },
  };
  assert.ok(updateInventoryStockRequestBodySchema.safeParse(stock).success);
  assert.ok(
    updateInventoryStockRequestBodySchema.safeParse({
      ...stock,
      storage_source: source,
    }).success,
  );
  assert.equal(
    updateInventoryStockRequestBodySchema.safeParse({
      ...stock,
      action: "receipt",
      storage_source: source,
    }).success,
    false,
  );
  const mead = {
    action: "manual_use",
    operation_id: randomUUID(),
    expected_revision: "a".repeat(64),
    quantity: 1,
    size_liters: 0.75,
    storage_source: "unlocated",
  };
  assert.ok(updateFinishedMeadRequestBodySchema.safeParse(mead).success);
  assert.equal(
    updateFinishedMeadRequestBodySchema.safeParse({
      ...mead,
      action: "correction",
    }).success,
    false,
  );
});
