import assert from "node:assert/strict";
import test from "node:test";
import { createEquipmentRequestBodySchema, updateEquipmentRequestBodySchema, equipmentItemSchema } from "../src/zod/equipment";

const id = "00000000-0000-4000-8000-000000000001";
test("equipment contracts share vessel capacity validation and reject owner injection", () => {
  const equipment = { name: "Carboy", type: "vessel", capacity: { value: 5, unit: "L" } };
  assert.equal(createEquipmentRequestBodySchema.safeParse({ operation_id: id, equipment }).success, true);
  for (const value of [
    { ...equipment, capacity: { value: 5, unit: "kg" } },
    { ...equipment, capacity: { value: -1, unit: "L" } },
    { ...equipment, type: "other" }, { ...equipment, user_id: 2 },
  ]) assert.equal(createEquipmentRequestBodySchema.safeParse({ operation_id: id, equipment: value }).success, false);
  assert.equal(equipmentItemSchema.safeParse({ ...equipment, id, brew: null, capacity: { value: 5, unit: "kg" } }).success, false);
});
test("assignment contracts require the expected prior brew and explicit reassignment flag", () => {
  assert.equal(updateEquipmentRequestBodySchema.safeParse({ action: "assign", operation_id: id, brew_id: id, expected_brew_id: null }).success, true);
  assert.equal(updateEquipmentRequestBodySchema.safeParse({ action: "assign", operation_id: id, brew_id: id }).success, false);
  assert.equal(updateEquipmentRequestBodySchema.safeParse({ action: "assign", operation_id: id, brew_id: "foreign", expected_brew_id: null }).success, false);
  assert.equal(updateEquipmentRequestBodySchema.safeParse({ action: "archive", operation_id: id }).success, true);
});
