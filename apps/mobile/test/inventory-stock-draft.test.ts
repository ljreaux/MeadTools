import assert from "node:assert/strict";
import test from "node:test";

import type { InventoryStockHistoryResponse } from "@meadtools/api-contract";

import { buildStockCommand, type StockDraft } from "../src/inventory/stock-draft";

const stockId = "7dc4446a-d7f0-45a4-bc9b-2a0aa14b0563";
const operationId = "94d08cb3-c82b-4d65-b290-512dbf72502d";
const draft: StockDraft = {
  name: " Spring Honey ",
  category: "honey",
  unit: "kg",
  amount: "2,5",
  notes: "",
  catalogReference: null
};
const review: InventoryStockHistoryResponse = {
  stock: {
    id: stockId,
    name: "Spring Honey",
    category: "honey",
    catalogReference: { catalog: "ingredient", id: "7" },
    quantity: { value: 6, unit: "lb" },
    notes: null,
    reconciliation_required: false,
    cost: { unit_cost: null, currency: null }
  },
  adjustments: [],
  has_more: false,
  cost_events: []
};

test("builds stock in the entered unit and rejects fractional packaging and excessive precision", () => {
  assert.deepEqual(buildStockCommand("add", draft, undefined, operationId), {
    kind: "create",
    input: {
      stock: { name: "Spring Honey", category: "honey", quantity: { value: 2.5, unit: "kg" }, notes: null, catalogReference: null },
      price: null,
      operation_id: operationId
    }
  });
  assert.equal(buildStockCommand("add", { ...draft, category: "packaging", unit: "units" }, undefined, operationId), null);
  assert.equal(buildStockCommand("add", { ...draft, amount: "1.0000001" }, undefined, operationId), null);
});

test("adjusts the reviewed balance in its saved unit, with zero reserved for physical counts", () => {
  assert.deepEqual(buildStockCommand("manual_use", draft, review, operationId), {
    kind: "update",
    stockId,
    input: {
      action: "manual_use", operation_id: operationId, note: null,
      quantity: { value: 2.5, unit: "lb" }, expected_balance: { value: 6, unit: "lb" }
    }
  });
  assert.equal(buildStockCommand("receipt", { ...draft, amount: "0" }, review, operationId), null);
  assert.ok(buildStockCommand("correction", { ...draft, amount: "0" }, review, operationId));
});

test("keeps catalog links when supplied during an edit and requires a revision for reconciliation", () => {
  assert.deepEqual(buildStockCommand("details", { ...draft, catalogReference: review.stock.catalogReference }, review, operationId), {
    kind: "update",
    stockId,
    input: {
      action: "details", operation_id: operationId, name: "Spring Honey",
      catalogReference: { catalog: "ingredient", id: "7" }, notes: null
    }
  });
  assert.equal(buildStockCommand("reconcile", draft, review, operationId), null);
  const revision = "a".repeat(64);
  assert.deepEqual(buildStockCommand("reconcile", draft, { ...review, reconciliation: { revision, uses: [] } }, operationId), {
    kind: "update",
    stockId,
    input: { action: "reconcile", operation_id: operationId, revision, quantity: { value: 2.5, unit: "lb" }, note: null }
  });
});
