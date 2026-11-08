import assert from "node:assert/strict";
import test from "node:test";
import {
  createInventoryStockRequestBodySchema,
  updateInventoryCurrencyRequestBodySchema,
  updateInventoryStockRequestBodySchema,
} from "../src/zod/inventory";
import {
  inventoryCostLineSchema,
  publicCostSummarySchema,
  updateBrewCostRequestBodySchema,
  updateInventoryCostExclusionsRequestBodySchema,
} from "../src/zod/inventory-costs";

const op = "6f1e0c5e-6b3a-4c1d-9a51-2f8d2b0f5c11";
const price = { amount: 30, currency: "USD", per: { value: 5, unit: "kg" } };
const kg = (value: number) => ({ value, unit: "kg" });

test("prices are recorded only with stock creation, receipts or explicit valuation", () => {
  assert.equal(createInventoryStockRequestBodySchema.parse({ operation_id: op,
    stock: { name: "Honey", category: "honey", quantity: kg(5) } }).price, null);
  assert.ok(createInventoryStockRequestBodySchema.safeParse({ operation_id: op, price,
    stock: { name: "Honey", category: "honey", quantity: kg(5) } }).success);
  const change = { operation_id: op, quantity: kg(1), expected_balance: kg(5), price };
  assert.ok(updateInventoryStockRequestBodySchema.safeParse({ ...change, action: "receipt" }).success);
  assert.equal(updateInventoryStockRequestBodySchema.safeParse({ ...change, action: "manual_use" }).success, false);
  assert.equal(updateInventoryStockRequestBodySchema.safeParse({ ...change, action: "correction" }).success, false);
  assert.ok(updateInventoryStockRequestBodySchema.safeParse({ action: "set_unit_cost", operation_id: op, price }).success);
  assert.equal(updateInventoryStockRequestBodySchema.safeParse({ action: "set_unit_cost", operation_id: op,
    price: { ...price, amount: -1 } }).success, false);
});

test("currencies are ISO 4217 codes", () => {
  assert.ok(updateInventoryCurrencyRequestBodySchema.safeParse({ currency: "EUR" }).success);
  for (const currency of ["eur", "EURO", "ZZZ", ""])
    assert.equal(updateInventoryCurrencyRequestBodySchema.safeParse({ currency }).success, false);
});

test("public summaries never carry lines, stock or unit costs", () => {
  const parsed = publicCostSummarySchema.parse({
    basis: "recorded_usage", totals: [{ currency: "USD", amount: 9 }], complete: true,
    mixed_currencies: false, per_liter: 2, volume_liters: 4.5,
    lines: [{ stock_id: "secret", unit_cost: 6 }], missing: {},
  });
  assert.deepEqual(Object.keys(parsed).sort(),
    ["basis", "complete", "mixed_currencies", "per_bottle", "per_liter", "totals", "volume_liters"]);
});

test("brew recalculation is an explicit, retry-keyed action", () => {
  assert.ok(updateBrewCostRequestBodySchema.safeParse({ action: "recalculate", operation_id: op }).success);
  assert.equal(updateBrewCostRequestBodySchema.safeParse({ action: "recalculate" }).success, false);
  assert.ok(updateBrewCostRequestBodySchema.safeParse({ action: "share", share_cost_summary: true }).success);
});

test("cost exclusions name an ingredient to exclude or an existing choice to include", () => {
  const parsed = updateInventoryCostExclusionsRequestBodySchema.parse({ action: "exclude", name: " Water " });
  assert.deepEqual(parsed, { action: "exclude", name: "Water", catalog_reference: null });
  assert.ok(updateInventoryCostExclusionsRequestBodySchema.safeParse({ action: "exclude", name: "Water",
    catalog_reference: { catalog: "ingredient", id: "12" } }).success);
  assert.equal(updateInventoryCostExclusionsRequestBodySchema.safeParse({ action: "exclude", name: " " }).success, false);
  assert.ok(updateInventoryCostExclusionsRequestBodySchema.safeParse({ action: "include", id: op }).success);
  assert.equal(updateInventoryCostExclusionsRequestBodySchema.safeParse({ action: "include", id: "water" }).success, false);
  assert.equal(inventoryCostLineSchema.shape.status.safeParse("excluded").success, true);
});

test("one recorded use can be excluded from a single brew by its cost line key", () => {
  const key = `${op}/bottle:14fa7156-4504-45b4-ad8a-0ba988e91717`;
  assert.ok(updateBrewCostRequestBodySchema.safeParse({ action: "exclude_use", key, excluded: true }).success);
  assert.ok(updateBrewCostRequestBodySchema.safeParse({ action: "exclude_use", key: `${op}/addition`, excluded: false }).success);
  for (const bad of ["addition", `${op}/`, `not-a-uuid/addition`, `${op}/a/b`])
    assert.equal(updateBrewCostRequestBodySchema.safeParse({ action: "exclude_use", key: bad, excluded: true }).success, false, bad);
  assert.equal(inventoryCostLineSchema.shape.exclusion.safeParse("use").success, true);
  assert.equal(inventoryCostLineSchema.shape.exclusion.safeParse("stock").success, false);
});
