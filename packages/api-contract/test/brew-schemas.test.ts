import assert from "node:assert/strict";
import test from "node:test";
import {
  brewEntryIdConflictErrorResponseSchema,
  brewEntryResponseSchema,
  brewDetailNotFoundErrorResponseSchema,
  brewRecipeSnapshotResponseSchema,
  createBrewEntryRequestBodySchema,
  brewInventoryErrorResponseSchema,
  brewInventorySelectionSchema,
  deleteBrewEntryRequestBodySchema,
  updateBrewEntryRequestBodySchema,
  publicBrewFetchErrorResponseSchema,
  updateBrewRequestBodySchema
} from "../src/zod/brews";

test("inventory selections are optional and accept only an explicit owned-stock choice or untracked mode", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const inventory = { mode: "deduct", operation_id: id, stock_id: id,
    expected: { stock_id: id, deducted: { value: 1, unit: "kg" } } };
  assert.equal(createBrewEntryRequestBodySchema.safeParse({ type: "ADDITION", inventory }).success, true);
  assert.equal(updateBrewEntryRequestBodySchema.safeParse({ inventory }).success, true);
  assert.equal(deleteBrewEntryRequestBodySchema.safeParse({ inventory }).success, true);
  assert.equal(deleteBrewEntryRequestBodySchema.safeParse({}).success, true);
  assert.equal(brewInventorySelectionSchema.safeParse({ mode: "untracked" }).success, true);
  for (const invalid of [
    { ...inventory, stock_id: "not-an-id" }, { ...inventory, operation_id: "not-an-id" },
    { ...inventory, user_id: 2 }, { mode: "untracked", stock_id: id },
    { ...inventory, expected: { stock_id: id, deducted: { value: -1, unit: "kg" } } },
    { ...inventory, expected: { stock_id: id, deducted: { value: 1, unit: "bags" } } },
  ]) assert.equal(brewInventorySelectionSchema.safeParse(invalid).success, false);
  assert.equal(brewInventoryErrorResponseSchema.safeParse({
    error: "Insufficient stock", code: "INSUFFICIENT_STOCK", shortage: 1, unit: "kg",
  }).success, true);
});

test("brew entry schemas preserve nullable readings and arbitrary JSON data", () => {
  assert.equal(
    brewEntryResponseSchema.safeParse({
      id: "entry",
      datetime: "2026-07-02T00:00:00.000Z",
      type: "GRAVITY",
      title: null,
      note: null,
      gravity: 1.1,
      temperature: null,
      temp_units: null,
      data: { readingRole: "OG" },
      user_id: 1
    }).success,
    true
  );
  assert.equal(
    createBrewEntryRequestBodySchema.safeParse({
      type: "STAGE_CHANGE",
      stage_to: "SECONDARY",
      client_entry_id: "00000000-0000-4000-8000-000000000001",
      data: null
    }).success,
    true
  );
});

test("brew update schema preserves partial and nullable fields", () => {
  assert.equal(
    updateBrewRequestBodySchema.safeParse({
      name: null,
      current_volume_liters: null,
      end_date: null
    }).success,
    true
  );
  assert.equal(
    updateBrewRequestBodySchema.safeParse({
      update_recipe_snapshot: true,
      expected_snapshotted_at: "2026-10-09T00:00:00.000Z",
      expected_recipe_content_key: "plan-key"
    }).success,
    true
  );
});

test("brew schemas reject invalid enums while preserving literal errors", () => {
  assert.equal(
    createBrewEntryRequestBodySchema.safeParse({ type: "UNKNOWN" }).success,
    false
  );
  assert.equal(
    createBrewEntryRequestBodySchema.safeParse({
      type: "NOTE",
      client_entry_id: "not-a-uuid"
    }).success,
    false
  );
  assert.equal(
    brewEntryIdConflictErrorResponseSchema.safeParse({
      error: "Entry ID is already in use"
    }).success,
    true
  );
  assert.equal(
    publicBrewFetchErrorResponseSchema.safeParse({
      error: "Failed to fetch public brew"
    }).success,
    true
  );
  assert.equal(
    brewDetailNotFoundErrorResponseSchema.safeParse({ error: "Brew not found" }).success,
    true
  );
  assert.equal(
    brewDetailNotFoundErrorResponseSchema.safeParse({ error: "User not found" }).success,
    true
  );
});

test("brew snapshot contract accepts legacy fields without accepting non-objects", () => {
  assert.equal(brewRecipeSnapshotResponseSchema.safeParse({ name: "Older recipe" }).success, true);
  assert.equal(brewRecipeSnapshotResponseSchema.safeParse({ dataV2: { version: 1 } }).success, true);
  assert.equal(brewRecipeSnapshotResponseSchema.safeParse("recipe").success, false);
  assert.equal(brewRecipeSnapshotResponseSchema.safeParse({
    name: "Current",
    sourceUserId: 2,
    sourceUsername: "maker",
    previousSnapshots: [{ name: "Earlier", dataV2: { version: 2 } }]
  }).success, true);
});
