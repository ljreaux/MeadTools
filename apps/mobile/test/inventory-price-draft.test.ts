import assert from "node:assert/strict";
import test from "node:test";

import type { PurchasePrice } from "@meadtools/inventory-domain";
import type { InventoryStockHistoryResponse } from "@meadtools/api-contract";

import { parseStockPrice, priceUnits } from "../src/inventory/price-draft";
import { buildStockCommand, type StockDraft } from "../src/inventory/stock-draft";

const operation = "94d08cb3-c82b-4d65-b290-512dbf72502d";
const stockId = "7dc4446a-d7f0-45a4-bc9b-2a0aa14b0563";
const entered = { amount: "18,2500", perAmount: "", perUnit: "kg" } as const;
const kg = { value: 3, unit: "kg" } as const;
const draft: StockDraft = {
  name: "Honey", category: "honey", unit: "kg", amount: "3", notes: "", catalogReference: null
};
const review: InventoryStockHistoryResponse = {
  stock: {
    id: stockId, name: "Honey", category: "honey", quantity: { value: 6, unit: "kg" }, notes: null,
    catalogReference: null, reconciliation_required: false, cost: { unit_cost: 4, currency: "USD" }
  },
  adjustments: [], has_more: false, cost_events: []
};

test("blank price is unknown, explicit zero is priced, and a receipt defaults to the quantity added", () => {
  assert.equal(parseStockPrice({ ...entered, amount: "" }, null, "kg", kg), null);
  assert.deepEqual(parseStockPrice({ ...entered, amount: "0" }, "USD", "kg", kg), { amount: 0, currency: "USD", per: kg });
  assert.deepEqual(parseStockPrice(entered, "USD", "kg", kg), { amount: 18.25, currency: "USD", per: kg });
  assert.equal(parseStockPrice(entered, null, "kg", kg), "invalid");
  assert.equal(parseStockPrice({ ...entered, amount: "1.23456" }, "USD", "kg", kg), "invalid");
  assert.equal(parseStockPrice(entered, "USD", "kg", null), "invalid");
  assert.equal(priceUnits("kg").some((unit) => unit === "L"), false);
  assert.deepEqual(priceUnits("units"), ["units"]);
});

test("receipt includes the price with the reviewed balance and valuation leaves quantity out", () => {
  const price: PurchasePrice = { amount: 18.25, currency: "USD", per: kg };
  const created = buildStockCommand("add", draft, undefined, operation, price);
  assert.deepEqual(created?.kind === "create" ? created.input.price : undefined, price);
  assert.deepEqual(buildStockCommand("receipt", draft, review, operation, price), {
    kind: "update", stockId,
    input: { action: "receipt", operation_id: operation, quantity: kg, expected_balance: review.stock.quantity, note: null, price }
  });
  assert.deepEqual(buildStockCommand("set_unit_cost", { ...draft, amount: "" }, review, operation, price), {
    kind: "update", stockId, input: { action: "set_unit_cost", operation_id: operation, price, note: null }
  });
  assert.equal(buildStockCommand("set_unit_cost", draft, review, operation), null);
});
