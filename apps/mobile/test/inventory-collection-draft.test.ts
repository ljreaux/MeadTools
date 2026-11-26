import assert from "node:assert/strict";
import test from "node:test";

import type { InventoryOrganizedStock, InventoryOrganizationResponse } from "@meadtools/api-contract";

import { buildMeadReceipt, buildNewMead, buildStorageChange, possibleStorageParents } from "../src/inventory/collection-draft";

const id = "7dc4446a-d7f0-45a4-bc9b-2a0aa14b0563";
const operation = "94d08cb3-c82b-4d65-b290-512dbf72502d";
const revision = "a".repeat(64);
const ml = { key: "one", size: "750", unit: "mL", count: "4" } as const;

test("new meads preserve entered sizes and reject duplicate canonical sizes or fractional bottles", () => {
  const created = buildNewMead(operation, "Test", "", [ml, { key: "two", size: "0,375", unit: "L", count: "2" }]);
  assert.deepEqual(created?.mead.bottles, [
    { size_liters: 0.75, display_size: { value: 750, unit: "mL" }, quantity: 4 },
    { size_liters: 0.375, display_size: { value: 0.375, unit: "L" }, quantity: 2 }
  ]);
  assert.equal(buildNewMead(operation, "Test", "", [ml, { ...ml, unit: "L", size: "0.75" }]), null);
  assert.equal(buildNewMead(operation, "Test", "", [{ ...ml, count: "0.5" }]), null);
});

test("receipts use the saved canonical size for a nominal preset and revision for either size choice", () => {
  const saved = { id, size_liters: 0.355, display_size: { value: 12, unit: "fl_oz" }, quantity: 2 } as const;
  assert.deepEqual(buildMeadReceipt(operation, revision, "3", "", saved), {
    operation_id: operation, expected_revision: revision, action: "receipt", size_liters: 0.355, quantity: 3, note: null
  });
  assert.deepEqual(buildMeadReceipt(operation, revision, "3", "", ml), {
    operation_id: operation, expected_revision: revision, action: "receipt", size_liters: 0.75, display_size: { value: 750, unit: "mL" }, quantity: 3, note: null
  });
  assert.equal(buildMeadReceipt(operation, revision, "0", "", ml), null);
});

test("storage keeps the reviewed revision, trims positions and enforces the available balance", () => {
  const stock: InventoryOrganizedStock = {
    id, name: "Mead", mead_id: id, bottle_size_liters: 0.75, display_size: null,
    quantity: { value: 4, unit: "units" }, revision, allocations: []
  };
  const row = { key: "one", locationId: id, position: " C3 ", amount: "3" };
  assert.deepEqual(buildStorageChange(stock, [row], operation), {
    unlocated: 1,
    input: { operation_id: operation, expected_revision: revision, allocations: [{ location_id: id, position: "C3", quantity: 3 }] }
  });
  assert.equal(buildStorageChange(stock, [row, { ...row, position: "C3", amount: "1" }], operation), null);
  assert.equal(buildStorageChange(stock, [{ ...row, amount: "5" }], operation), null);
  assert.equal(buildStorageChange(stock, [{ ...row, amount: "2.5" }], operation), null);
  assert.equal(buildStorageChange({ ...stock, mead_id: null }, [{ ...row, amount: "2.5" }], operation)?.unlocated, 1.5);
  assert.equal(buildStorageChange({ ...stock, mead_id: null }, [{ ...row, amount: "2.5" }], operation, true), null);
});

test("a location cannot choose itself, its child or its grandchild as a parent", () => {
  const locations: InventoryOrganizationResponse["locations"] = [
    { id: "root", parent_id: null, name: "Root", path: "Root", version: 1 },
    { id: "room", parent_id: "root", name: "Room", path: "Root → Room", version: 1 },
    { id: "shelf", parent_id: "room", name: "Shelf", path: "Root → Room → Shelf", version: 1 },
    { id: "box", parent_id: "shelf", name: "Box", path: "Root → Room → Shelf → Box", version: 1 }
  ];
  assert.deepEqual(possibleStorageParents(locations, "room").map(({ id: parent }) => parent), ["root"]);
  assert.deepEqual(possibleStorageParents(locations), locations);
});
