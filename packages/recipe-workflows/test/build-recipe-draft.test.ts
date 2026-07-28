import assert from "node:assert/strict";
import test from "node:test";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import { recipeDataV2Schema } from "@meadtools/schemas";
import { buildRecipeDraft } from "../src/build-recipe-draft";

const nutrientPlan = {
  enabled: true as const,
  yeastBrand: "Lalvin",
  yeastStrain: "71B",
  nitrogenRequirement: "Medium" as const,
  schedule: "tosna" as const,
  numberOfAdditions: 4,
  goFermType: "Go-Ferm" as const
};

test("general recipe intake asks for recipe composition instead of assuming a style", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 3, unit: "gal" },
    fermentationFinalGravity: 1.01,
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "needs_input");
  if (result.status !== "needs_input") return;
  assert.equal(result.questions[0]?.id, "recipe_ingredients");
});

test("general recipe drafting solves honey and water around explicit fruit inputs", () => {
  const result = buildRecipeDraft({
    name: "Blackberry draft",
    style: "melomel",
    batchVolume: { value: 3, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 1.01,
    ingredients: [
      { name: "Honey", role: "adjustable_fermentable" },
      {
        name: "Blackberries",
        category: "fruit",
        brix: 10,
        amount: { kind: "weight", value: 6, unit: "lb" }
      }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.equal(result.operation, "build_recipe_draft");
  assert.ok(Math.abs(result.derived.gravity.ogPrimary - 1.1) < 0.00001);
  assert.ok(result.recipeData.ingredients.some((ingredient) => ingredient.name === "Blackberries"));
  assert.ok(result.recipeData.ingredients.some((ingredient) => ingredient.name === "Water"));
  assert.deepEqual(
    result.derived,
    calculateRecipeDerivedApiResponse(recipeDataV2Schema.parse(result.recipeData)).derived
  );
});

test("a named honey varietal can be the adjustable fermentable", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1.25, unit: "gal" },
    targetOriginalGravity: 1.075,
    fermentationFinalGravity: 1.01,
    ingredients: [
      {
        name: "Apple Juice",
        category: "juice",
        brix: 11,
        amount: { kind: "volume", value: 1, unit: "gal" }
      },
      { name: "Wildflower Honey", role: "adjustable_fermentable" }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.ok(result.recipeData.ingredients.some((ingredient) => ingredient.name === "Wildflower Honey"));
  assert.ok(result.recipeData.ingredients.some((ingredient) => ingredient.name === "Water"));
});

test("a selected fill liquid replaces water without needing a stated amount", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1.25, unit: "gal" },
    targetOriginalGravity: 1.075,
    fermentationFinalGravity: 1.01,
    ingredients: [
      { name: "Apple Juice", category: "juice", brix: 11, role: "fill_liquid" },
      { name: "Wildflower Honey", role: "adjustable_fermentable" }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.ok(result.recipeData.ingredients.some((ingredient) => ingredient.name === "Apple Juice"));
  assert.ok(!result.recipeData.ingredients.some((ingredient) => ingredient.name === "Water"));
});

test("enabled stabilization defaults to potassium metabisulfite and pH 3.5", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    fermentationFinalGravity: 1.01,
    ingredients: [{ name: "Honey", amount: { kind: "weight", value: 3, unit: "lb" } }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: true }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.equal(result.recipeData.stabilizers.type, "kmeta");
  assert.equal(result.recipeData.stabilizers.phReading, "3.5");
  assert.ok(result.assumptions.some((assumption) => assumption.includes("assumed pH of 3.5")));
});

test("backsweetening adds a calculated secondary sweetener to the saved recipe payload", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.999,
    backsweetening: { targetFinalGravity: 1.015 },
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    nutrients: nutrientPlan
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  const backsweeteningHoney = result.recipeData.ingredients.find(
    (ingredient) => ingredient.lineId === "backsweetening-sweetener"
  );
  assert.equal(backsweeteningHoney?.secondary, true);
  assert.ok(Number(backsweeteningHoney?.amounts.weight.value) > 0);
  assert.ok(Math.abs(result.derived.gravity.backsweetenedFg - 1.015) < 0.00001);
  assert.equal(result.recipeData.stabilizers.adding, true);
});

test("a user-supplied unlisted yeast can provide its own nutrient requirement", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    fermentationFinalGravity: 0.999,
    ingredients: [{ name: "Honey", amount: { kind: "weight", value: 3, unit: "lb" } }],
    nutrients: {
      ...nutrientPlan,
      yeastBrand: "Lallemand",
      yeastStrain: "Belle Saison",
      nitrogenRequirement: "Medium"
    },
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.equal(result.recipeData.nutrients?.selected.yeastId, undefined);
  assert.equal(result.recipeData.nutrients?.selected.yeastStrain, "Belle Saison");
  assert.equal(result.recipeData.nutrients?.selected.nitrogenRequirement, "Medium");
});

test("a full-volume juice base explains why a gravity-targeted cyser cannot fit", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.086,
    fermentationFinalGravity: 1.01,
    ingredients: [
      {
        name: "Apple Juice",
        category: "juice",
        brix: 10.3,
        amount: { kind: "volume", value: 1, unit: "gal" }
      },
      { name: "Wildflower Honey", role: "adjustable_fermentable" }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.match(result.message, /Apple Juice.*requested 1 gal/i);
  assert.match(result.message, /no room left for Wildflower Honey and water/i);
  assert.match(result.message, /larger batch/i);
});

test("a target ABV gravity includes fixed secondary fruit in the final blend", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 5, unit: "gal" },
    targetOriginalGravity: 1.119,
    fermentationFinalGravity: 0.999,
    ingredients: [
      { name: "Honey", role: "adjustable_fermentable" },
      {
        name: "Blackberry",
        category: "fruit",
        brix: 7.86,
        amount: { kind: "weight", value: 5, unit: "lb" }
      },
      {
        name: "Blackberry",
        category: "fruit",
        brix: 7.86,
        secondary: true,
        amount: { kind: "weight", value: 5, unit: "lb" }
      }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.ok(result.derived.gravity.ogPrimary > 1.119);
  assert.ok(result.derived.alcohol.abv > 15.9 && result.derived.alcohol.abv < 16.1);
});

test("vanilla is retained as an additive rather than requiring Brix", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 3, unit: "gal" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.999,
    ingredients: [
      { name: "Honey", role: "adjustable_fermentable" },
    ],
    additives: [{ name: "Vanilla bean", amount: 1, unit: "whole bean", secondary: true }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.deepEqual(result.recipeData.additives[0]?.name, "Vanilla bean");
});

test("general recipe drafting preserves a catalog ingredient reference", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    fermentationFinalGravity: 1.01,
    ingredients: [
      {
        name: "Blackberries",
        catalogId: 42,
        category: "fruit",
        brix: 10,
        amount: { kind: "weight", value: 2, unit: "lb" }
      }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.deepEqual(result.recipeData.ingredients[0]?.ref, {
    kind: "catalog",
    ingredientId: 42
  });
});

test("general recipe drafting asks for brix rather than inventing fruit characteristics", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    fermentationFinalGravity: 1.01,
    ingredients: [{ name: "Blackberries", amount: { kind: "weight", value: 2, unit: "lb" } }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "needs_input");
  if (result.status !== "needs_input") return;
  assert.equal(result.questions[0]?.id, "ingredient_0_brix");
});

test("an unspecified honey amount asks for a gravity target rather than a guessed amount", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    fermentationFinalGravity: 0.999,
    ingredients: [
      { name: "Honey" },
      {
        name: "Blackberries",
        category: "fruit",
        brix: 10,
        amount: { kind: "weight", value: 4, unit: "lb" }
      }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "needs_input");
  if (result.status !== "needs_input") return;
  assert.equal(result.questions[0]?.id, "gravity_target");
  assert.ok(result.questions.every((question) => !/amount.*Honey/i.test(question.prompt)));
});

test("an unspecified primary honey amount becomes the adjustable fermentable after a target is supplied", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.999,
    ingredients: [
      { name: "Honey" },
      {
        name: "Blackberries",
        category: "fruit",
        brix: 10,
        amount: { kind: "weight", value: 4, unit: "lb" }
      }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.ok(result.recipeData.ingredients.some((ingredient) => ingredient.name === "Honey"));
});

test("general recipe drafting requires a nutrient plan and rejects nutrient opt-out", () => {
  const incomplete = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    fermentationFinalGravity: 1.01,
    ingredients: [{ name: "Honey", amount: { kind: "weight", value: 3, unit: "lb" } }],
    stabilizers: { enabled: false }
  });
  assert.equal(incomplete.status, "needs_input");
  if (incomplete.status === "needs_input") {
    assert.ok(incomplete.questions.some((question) => question.id === "nutrient_plan"));
    assert.ok(incomplete.questions.every((question) => question.id !== "nutrient_intent"));
  }

  const optedOut = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    fermentationFinalGravity: 1.01,
    ingredients: [{ name: "Honey", amount: { kind: "weight", value: 3, unit: "lb" } }],
    nutrients: { enabled: false },
    stabilizers: { enabled: false }
  });
  assert.equal(optedOut.status, "error");
});
