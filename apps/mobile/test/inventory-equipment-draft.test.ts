import assert from "node:assert/strict";
import test from "node:test";

import { buildEquipmentAssignment, buildEquipmentDetails, type EquipmentDraft } from "../src/inventory/equipment-draft";

const operationId = "94d08cb3-c82b-4d65-b290-512dbf72502d";
const first = "7dc4446a-d7f0-45a4-bc9b-2a0aa14b0563";
const second = "4982354b-8403-4503-af9b-1a71bcbdb79d";
const brew = { id: first, name: "First brew", recipe_name: null };
const draft: EquipmentDraft = {
  name: " Carboy ",
  type: "vessel",
  capacity: "5,25",
  unit: "gal",
  notes: "  Cellar ",
  quantity: "2"
};

test("equipment uses the shared capacity and quantity limits, and tools have no capacity", () => {
  assert.deepEqual(buildEquipmentDetails(draft, operationId), {
    operation_id: operationId,
    quantity: 2,
    equipment: { name: "Carboy", type: "vessel", capacity: { value: 5.25, unit: "gal" }, notes: "Cellar" }
  });
  assert.equal(buildEquipmentDetails({ ...draft, quantity: "101" }, operationId), null);
  assert.equal(buildEquipmentDetails({ ...draft, quantity: "1.5" }, operationId), null);
  assert.equal(buildEquipmentDetails({ ...draft, capacity: "0" }, operationId), null);
  assert.equal(buildEquipmentDetails({ ...draft, capacity: "" }, operationId)?.equipment.capacity, null);
  assert.equal(buildEquipmentDetails({ ...draft, type: "other" }, operationId)?.equipment.capacity, null);
});

test("assignment carries reviewed occupancy and requires explicit reassignment only when switching brews", () => {
  assert.deepEqual(buildEquipmentAssignment({ type: "vessel", brew: null }, first, operationId), {
    action: "assign", operation_id: operationId, brew_id: first, expected_brew_id: null, reassign: false
  });
  assert.deepEqual(buildEquipmentAssignment({ type: "vessel", brew }, second, operationId), {
    action: "assign", operation_id: operationId, brew_id: second, expected_brew_id: first, reassign: true
  });
  assert.deepEqual(buildEquipmentAssignment({ type: "vessel", brew }, null, operationId), {
    action: "assign", operation_id: operationId, brew_id: null, expected_brew_id: first, reassign: false
  });
  assert.equal(buildEquipmentAssignment({ type: "vessel", brew }, first, operationId), null);
  assert.equal(buildEquipmentAssignment({ type: "other", brew: null }, first, operationId), null);
});
