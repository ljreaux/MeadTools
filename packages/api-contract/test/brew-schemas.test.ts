import assert from "node:assert/strict";
import test from "node:test";
import {
  brewEntryResponseSchema,
  createBrewEntryRequestBodySchema,
  publicBrewFetchErrorResponseSchema,
  updateBrewRequestBodySchema
} from "../src/zod/brews";

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
});

test("brew schemas reject invalid enums while preserving literal errors", () => {
  assert.equal(
    createBrewEntryRequestBodySchema.safeParse({ type: "UNKNOWN" }).success,
    false
  );
  assert.equal(
    publicBrewFetchErrorResponseSchema.safeParse({
      error: "Failed to fetch public brew"
    }).success,
    true
  );
});
