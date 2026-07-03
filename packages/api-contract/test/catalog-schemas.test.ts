import assert from "node:assert/strict";
import test from "node:test";
import {
  additiveResponseSchema,
  createAdditiveRequestBodySchema,
  createIngredientRequestBodySchema,
  createYeastRequestBodySchema,
  ingredientByIdResponseSchema,
  updateIngredientRequestBodySchema,
  yeastLookupResponseSchema
} from "../src/zod/catalog";

test("catalog response schemas accept current API payload shapes", () => {
  assert.equal(
    additiveResponseSchema.safeParse({
      id: "1",
      created_at: "2026-07-02T00:00:00.000Z",
      name: "Potassium sorbate",
      dosage: 0.5,
      unit: "g"
    }).success,
    true
  );
  assert.equal(ingredientByIdResponseSchema.safeParse(null).success, true);
  assert.equal(
    yeastLookupResponseSchema.safeParse([
      {
        id: 1,
        brand: "Lalvin",
        name: "D-47",
        nitrogen_requirement: "Low",
        tolerance: "14",
        low_temp: "59",
        high_temp: "68"
      }
    ]).success,
    true
  );
});

test("catalog mutation schemas preserve current request contracts", () => {
  assert.equal(
    createAdditiveRequestBodySchema.safeParse({
      name: "Oak",
      dosage: "2",
      unit: "fl oz"
    }).success,
    true
  );
  assert.equal(
    createIngredientRequestBodySchema.safeParse({
      name: "Honey",
      sugar_content: 82,
      water_content: 18,
      category: "sugar"
    }).success,
    true
  );
  assert.equal(
    updateIngredientRequestBodySchema.safeParse({ name: "Clover honey" })
      .success,
    true
  );
  assert.equal(
    createYeastRequestBodySchema.safeParse({
      brand: "Custom producer",
      name: "House culture",
      nitrogen_requirement: "Medium",
      tolerance: 16,
      low_temp: 55,
      high_temp: 75
    }).success,
    true
  );
});

test("catalog schemas reject contract mismatches", () => {
  assert.equal(
    additiveResponseSchema.safeParse({
      id: "1",
      created_at: "2026-07-02T00:00:00.000Z",
      name: "Oak",
      dosage: "2",
      unit: "grams"
    }).success,
    false
  );
  assert.equal(
    createIngredientRequestBodySchema.safeParse({
      name: "Honey",
      sugar_content: "82",
      water_content: 18,
      category: "sugar"
    }).success,
    false
  );
  assert.equal(
    createYeastRequestBodySchema.safeParse({
      brand: "Lalvin",
      name: "D-47",
      nitrogen_requirement: "Extreme",
      tolerance: 14,
      low_temp: 59,
      high_temp: 68
    }).success,
    false
  );
});
