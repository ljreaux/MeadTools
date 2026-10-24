import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createInventoryStockRequestBodySchema, updateInventoryStockRequestBodySchema, inventoryStockItemSchema } from "../src/zod/inventory";
const quantity = { value: 2, unit: "kg" };
test("stock creation validates shared quantities and rejects owner injection", () => {
  const input = { operation_id: randomUUID(), stock: { name: "Honey", category: "honey", quantity } };
  assert.equal(createInventoryStockRequestBodySchema.parse(input).stock.notes, null);
  assert.equal(createInventoryStockRequestBodySchema.safeParse({ ...input, user_id: 1 }).success, false);
  for (const value of [-1, 1.0000001, 1_000_000_001]) assert.equal(createInventoryStockRequestBodySchema.safeParse({ ...input, stock: { ...input.stock, quantity: { ...quantity, value } } }).success, false);
});
test("all balance changes require an expected prior quantity; archive cannot change stock", () => {
  for (const action of ["receipt", "manual_use", "correction"]) {
    const input = { operation_id: randomUUID(), action, quantity };
    assert.equal(updateInventoryStockRequestBodySchema.safeParse(input).success, false);
    assert.ok(updateInventoryStockRequestBodySchema.safeParse({ ...input, expected_balance: quantity }).success);
  }
  assert.equal(updateInventoryStockRequestBodySchema.safeParse({ action: "archive", operation_id: randomUUID(), quantity }).success, false);
  assert.ok(inventoryStockItemSchema.safeParse({ id: randomUUID(), name: "Honey", category: "honey", quantity, reconciliation_required: false }).success);
});

test("packaging creation and stock responses preserve whole-unit counts", () => {
  const stock = { name: "750 mL bottles", category: "packaging", quantity: { value: 24, unit: "units" } };
  assert.ok(createInventoryStockRequestBodySchema.safeParse({ operation_id: randomUUID(), stock }).success);
  const item = { ...stock, id: randomUUID(), reconciliation_required: false };
  assert.ok(inventoryStockItemSchema.safeParse(item).success);
  for (const quantity of [{ value: 0.5, unit: "units" }, { value: 24, unit: "L" }]) {
    assert.equal(createInventoryStockRequestBodySchema.safeParse({ operation_id: randomUUID(), stock: { ...stock, quantity } }).success, false);
    assert.equal(inventoryStockItemSchema.safeParse({ ...item, quantity }).success, false);
  }
});
