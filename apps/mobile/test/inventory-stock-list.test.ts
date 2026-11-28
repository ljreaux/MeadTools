import assert from "node:assert/strict";
import test from "node:test";

import type { InventoryStockItem } from "@meadtools/api-contract";

import { queryStockList, stockFilterOptions } from "../src/inventory/stock-list";

function item(name: string, category: InventoryStockItem["category"], review = false): InventoryStockItem {
  return {
    id: name,
    name,
    category,
    catalogReference: null,
    quantity: { value: 1, unit: category === "packaging" ? "units" : "kg" },
    notes: null,
    reconciliation_required: review,
    cost: { unit_cost: null, currency: null }
  };
}

const stock = [
  item("Wildflower", "honey"),
  item("Orange Blossom", "honey", true),
  item("Blueberries", "fruit"),
  item("750 mL Bottles", "packaging")
];
const options = { search: "", filter: "all" as const, locale: "en", categoryLabel: (c: string) => `Label ${c}` };

test("keeps the server order when nothing is filtered", () => {
  assert.deepEqual(queryStockList(stock, options).map(({ name }) => name), stock.map(({ name }) => name));
});

test("filters by category and by review state", () => {
  assert.deepEqual(queryStockList(stock, { ...options, filter: "honey" }).map(({ name }) => name),
    ["Wildflower", "Orange Blossom"]);
  assert.deepEqual(queryStockList(stock, { ...options, filter: "review" }).map(({ name }) => name),
    ["Orange Blossom"]);
});

test("searches names and category labels within the chosen filter", () => {
  assert.deepEqual(queryStockList(stock, { ...options, search: " BLUE " }).map(({ name }) => name), ["Blueberries"]);
  assert.deepEqual(queryStockList(stock, { ...options, search: "label packaging" }).map(({ name }) => name),
    ["750 mL Bottles"]);
  assert.deepEqual(queryStockList(stock, { ...options, filter: "fruit", search: "wild" }), []);
});

test("offers only the categories in use, and review only when needed", () => {
  const all = ["honey", "fruit", "yeast", "additive", "packaging"] as const;
  assert.deepEqual(stockFilterOptions(stock, all), ["all", "review", "honey", "fruit", "packaging"]);
  assert.deepEqual(stockFilterOptions([item("Wildflower", "honey")], all), ["all", "honey"]);
});
