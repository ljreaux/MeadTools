import assert from "node:assert/strict";
import test from "node:test";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import { calcOG } from "@meadtools/core/gravity";
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

test("backsweetening intent without a target asks for the finished gravity", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.999,
    backsweeteningIntent: true,
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 }
  });

  assert.equal(result.status, "needs_input");
  if (result.status !== "needs_input") return;
  assert.ok(result.questions.some((question) => question.id === "backsweetening_target"));
});

test("fixed secondary fruit supplies backsweetening when no target is provided", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 5, unit: "gal" },
    targetOriginalGravity: 1.12,
    fermentationFinalGravity: 0.999,
    backsweeteningIntent: true,
    ingredients: [
      { name: "Honey", role: "adjustable_fermentable" },
      { name: "Blueberry", category: "fruit", brix: 10, amount: { kind: "weight", value: 7.5, unit: "lb" } },
      { name: "Blueberry", category: "fruit", brix: 10, secondary: true, amount: { kind: "weight", value: 7.5, unit: "lb" } }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.ok(result.derived.gravity.backsweetenedFg > 0.999);
  assert.equal(result.recipeData.ingredients.some((ingredient) => ingredient.lineId === "backsweetening-sweetener"), false);
  assert.ok(result.assumptions.some((assumption) => assumption.includes("Fixed secondary additions provide the backsweetening")));
});

test("a fixed recipe with an OG target preserves the target as gravity in its warning", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 10, unit: "L" },
    targetOriginalGravity: 1.106,
    fermentationFinalGravity: 0.996,
    ingredients: [
      { name: "Honey", amount: { kind: "weight", value: 2.8, unit: "kg" } },
      { name: "Cherry, Sweet", category: "fruit", brix: 12, amount: { kind: "weight", value: 2.7, unit: "kg" } },
      { name: "Cherry, Tart", category: "fruit", brix: 12, amount: { kind: "weight", value: 0.8, unit: "kg" } }
    ],
    nutrients: {
      ...nutrientPlan,
      schedule: "dap",
      numberOfAdditions: 3,
      goFermType: "none"
    },
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  const warning = result.warnings.find((candidate) => candidate.includes("fixed fermentables"));
  assert.match(warning ?? "", /original gravity of 1\.\d{3}/);
  assert.match(warning ?? "", /requested 1\.106/);
  assert.match(warning ?? "", /increase a fixed fermentable or reduce the finished batch volume/);
  assert.doesNotMatch(warning ?? "", /% target/);
});

test("secondary fruit that exceeds the stated sweetness target is retained without extra honey", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 5, unit: "gal" },
    targetOriginalGravity: 1.12,
    fermentationFinalGravity: 0.999,
    backsweetening: { targetFinalGravity: 1.001 },
    ingredients: [
      { name: "Honey", role: "adjustable_fermentable" },
      { name: "Blueberry", category: "fruit", brix: 10, amount: { kind: "weight", value: 7.5, unit: "lb" } },
      { name: "Blueberry", category: "fruit", brix: 10, secondary: true, amount: { kind: "weight", value: 7.5, unit: "lb" } }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: true, type: "kmeta", phReading: 3.5 }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.ok(result.derived.gravity.backsweetenedFg >= 1.001);
  assert.equal(result.recipeData.ingredients.some((ingredient) => ingredient.lineId === "backsweetening-sweetener"), false);
  assert.ok(result.assumptions.some((assumption) => assumption.includes("No additional sweetener was calculated")));
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

test("an explicit fill-liquid amount remains fixed and water balances the batch", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 10, unit: "L" },
    targetOriginalGravity: 1.075,
    fermentationFinalGravity: 0.999,
    ingredients: [
      {
        name: "Apple Juice",
        category: "juice",
        brix: 11,
        amount: { kind: "volume", value: 8, unit: "L" },
        role: "fill_liquid"
      },
      { name: "Wildflower Honey", role: "adjustable_fermentable" }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  const cider = result.recipeData.ingredients.find((ingredient) => ingredient.name === "Apple Juice");
  assert.equal(cider?.amounts.volume.value, "8");
  assert.ok(result.recipeData.ingredients.some((ingredient) => ingredient.name === "Water"));
});

test("fixed ingredients that already fill the target volume return a concrete conflict", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.075,
    fermentationFinalGravity: 0.999,
    ingredients: [
      {
        name: "Apple Juice",
        category: "juice",
        brix: 11,
        amount: { kind: "volume", value: 1, unit: "gal" }
      },
      {
        name: "Wildflower Honey",
        amount: { kind: "weight", value: 3, unit: "lb" }
      }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.match(result.message, /fixed ingredients/i);
  assert.match(result.message, /larger finished batch volume/i);
});

test("a fruit-mass volume conflict explains fruit contribution without calling it liquid", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 10, unit: "L" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.999,
    ingredients: [
      { name: "Honey", role: "adjustable_fermentable" },
      { name: "Blueberry", category: "fruit", brix: 10, amount: { kind: "weight", value: 5, unit: "kg" } },
      { name: "Blueberry", category: "fruit", brix: 10, secondary: true, amount: { kind: "weight", value: 5, unit: "kg" } }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.match(result.message, /stated primary fruit load/i);
  assert.match(result.message, /fruit mass as fruit, not as a liquid measurement/i);
});

test("a mistakenly retained dynamic role cannot hide a fixed-volume conflict", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.075,
    fermentationFinalGravity: 0.999,
    ingredients: [
      {
        name: "Apple Juice",
        category: "juice",
        brix: 11,
        amount: { kind: "volume", value: 1, unit: "gal" },
        role: "fill_liquid"
      },
      {
        name: "Wildflower Honey",
        amount: { kind: "weight", value: 3, unit: "lb" },
        role: "adjustable_fermentable"
      }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.match(result.message, /fixed ingredients/i);
  assert.match(result.message, /larger finished batch volume/i);
});

test("an unquantified water line is treated as the automatic volume balance", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.999,
    ingredients: [
      { name: "Honey", role: "adjustable_fermentable" },
      { name: "Water" }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.ok(result.recipeData.ingredients.some((ingredient) => ingredient.name === "Water"));
});

test("fixed fermentables calculate their resulting gravity without an adjustable confirmation", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 5, unit: "L" },
    targetOriginalGravity: 1.108,
    fermentationFinalGravity: 0.999,
    ingredients: [
      { name: "Honey", amount: { kind: "weight", value: 1.7, unit: "kg" } },
      { name: "Blueberry", category: "fruit", brix: 10, amount: { kind: "weight", value: 250, unit: "g" } }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.ok(result.recipeData.ingredients.some((ingredient) => ingredient.name === "Honey"));
  assert.ok(result.recipeData.ingredients.some((ingredient) => ingredient.name === "Water"));
});

test("a fixed fermentable amount explains an ABV mismatch without changing the recipe", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 2, unit: "gal" },
    targetOriginalGravity: 1.092,
    fermentationFinalGravity: 0.999,
    ingredients: [{ name: "Orange Blossom Honey", amount: { kind: "weight", value: 6, unit: "lb" } }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.ok(result.warnings.some((warning) => /supplied fixed fermentables calculate to/i.test(warning)));
  assert.ok(result.warnings.some((warning) => /reduce a fixed fermentable or increase the finished batch volume/i.test(warning)));
  assert.ok(result.assumptions.some((assumption) => /All ingredient amounts were supplied explicitly/i.test(assumption)));
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

test("a target ABV applies to the finished backsweetened batch", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: calcOG(14, 0.999),
    fermentationFinalGravity: 0.999,
    backsweetening: { targetFinalGravity: 1.015 },
    ingredients: [{ name: "Wildflower Honey", role: "adjustable_fermentable" }],
    nutrients: nutrientPlan
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.ok(Math.abs(result.derived.alcohol.abv - 14) < 0.01);
  assert.ok(Math.abs(result.derived.gravity.backsweetenedFg - 1.015) < 0.00001);
  assert.ok(Math.abs(result.derived.volume.total - 1) < 0.00001);
  assert.ok(!result.warnings.some((warning) => warning.includes("ABV differs")));
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
    additives: [{ name: "Vanilla bean", amount: 1, unit: "units", secondary: true }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;
  assert.deepEqual(result.recipeData.additives[0]?.name, "Vanilla bean");
});

test("recipe drafts reject additive units outside the recipe-builder contract", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 3, unit: "gal" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.999,
    ingredients: [{ name: "Honey", role: "adjustable_fermentable" }],
    additives: [{ name: "Vanilla bean", amount: 1, unit: "bean" }],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.code, "invalid_input");
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

test("a secondary volume that leaves no primary must returns a recipe feasibility error", () => {
  const result = buildRecipeDraft({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.999,
    ingredients: [
      { name: "Honey", category: "honey", brix: 81, role: "adjustable_fermentable" },
      {
        name: "Raspberry Juice",
        category: "fruit juice",
        brix: 10,
        amount: { kind: "volume", value: 1, unit: "gal" },
        secondary: true
      }
    ],
    nutrients: nutrientPlan,
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.match(result.message, /finished batch volume is too small/i);
});
