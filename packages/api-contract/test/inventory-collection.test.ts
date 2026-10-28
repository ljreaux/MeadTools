import assert from "node:assert/strict";
import test from "node:test";
import { inventoryTransferRequestBodySchema } from "../src/zod/inventory";
const collection = { version: 1, consumables: [], meads: [], labels: [], locations: [], assignments: [], allocations: [] };
const operation_id = "bcb3e0bb-1248-4d43-92b7-3f496abf9584";
test("collection transfer contracts keep existing consumables requests and add explicit collection actions", () => {
  assert.ok(inventoryTransferRequestBodySchema.safeParse({ action: "export", format: "csv" }).success);
  assert.ok(inventoryTransferRequestBodySchema.safeParse({ action: "export_collection" }).success);
  assert.ok(inventoryTransferRequestBodySchema.safeParse({ action: "import_collection", operation_id, collection }).success);
  assert.equal(inventoryTransferRequestBodySchema.safeParse({ action: "import_collection", operation_id, collection, mode: "update" }).success, false);
  assert.equal(inventoryTransferRequestBodySchema.safeParse({ action: "import_collection", collection }).success, false);
  assert.equal(inventoryTransferRequestBodySchema.safeParse({ action: "import_collection", operation_id, collection: { ...collection, user_id: 1 } }).success, false);
});
test("collection imports reject invalid cross-sheet references at the HTTP boundary", () => {
  assert.equal(inventoryTransferRequestBodySchema.safeParse({ action: "import_collection", operation_id, collection: { ...collection, allocations: [{ stock_key: "foreign-id", location_key: "foreign-location", position: "", quantity: 1 }] } }).success, false);
});
