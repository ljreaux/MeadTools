import assert from "node:assert/strict";
import test from "node:test";
import { recipeDerivedStateResponseBodySchema } from "@meadtools/api-contract/schemas";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import { recipeDataV2Schema } from "@meadtools/schemas/recipe";
import { representativeRecipeConversations } from "../eval/representative-conversations";
import {
  chatbotRecipeWorkflowResultSchema,
  createTraditionalMead,
  explainRecipe,
  refineTraditionalMead
} from "../src/index";

test("incomplete intake returns stable structured questions", () => {
  const result = createTraditionalMead({});

  assert.equal(result.status, "needs_input");
  if (result.status !== "needs_input") return;

  assert.deepEqual(
    result.questions.map((question) => question.id),
    [
      "batch_volume",
      "target_original_gravity",
      "fermentation_final_gravity",
      "nutrient_intent",
      "stabilizer_intent"
    ]
  );
  assert.equal(chatbotRecipeWorkflowResultSchema.safeParse(result).success, true);
});

test("traditional draft passes the shared recipe schema and real calculation engine", () => {
  const result = createTraditionalMead({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.996,
    nutrients: { enabled: false },
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;

  const authoritativeRecipe = recipeDataV2Schema.parse(result.recipeData);
  const recalculated = calculateRecipeDerivedApiResponse(authoritativeRecipe);

  assert.equal(
    recipeDerivedStateResponseBodySchema.safeParse(recalculated).success,
    true
  );
  assert.deepEqual(result.derived, recalculated.derived);
  assert.ok(Math.abs(result.derived.gravity.ogPrimary - 1.1) < 0.00001);
  assert.ok(Math.abs(result.derived.volume.total - 1) < 0.00001);
  assert.equal(result.recipeData.notes.primary[0]?.content.length, 2);
  assert.equal(result.recipeData.flags?.private, true);
});

test("explicit nutrient inputs are validated and calculated", () => {
  const result = createTraditionalMead({
    batchVolume: { value: 5, unit: "L" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.998,
    nutrients: {
      enabled: true,
      yeastBrand: "Lalvin",
      yeastStrain: "D-47",
      nitrogenRequirement: "Low",
      schedule: "tosna",
      numberOfAdditions: 4,
      goFermType: "Go-Ferm"
    },
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;

  assert.equal(recipeDataV2Schema.safeParse(result.recipeData).success, true);
  assert.equal(result.recipeData.nutrients?.selected.yeastStrain, "D-47");
  assert.ok(Number.isFinite(result.derived.nutrients.targetYanPpm));
  assert.ok(result.derived.nutrients.numberOfAdditions > 0);
});

test("nutrient schedule selects the matching authoritative calculation inputs", () => {
  const result = createTraditionalMead({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.09,
    fermentationFinalGravity: 0.998,
    nutrients: {
      enabled: true,
      yeastBrand: "Lalvin",
      yeastStrain: "71B",
      nitrogenRequirement: "Medium",
      schedule: "justK",
      numberOfAdditions: 3,
      goFermType: "Go-Ferm"
    },
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;

  assert.deepEqual(result.recipeData.nutrients?.selected.selectedNutrients, {
    fermO: false,
    fermK: true,
    dap: false,
    other: false
  });
  assert.ok(result.derived.nutrients.nutrientAdditions.totalGrams.fermK > 0);
  assert.equal(result.derived.nutrients.nutrientAdditions.totalGrams.fermO, 0);
});

test("semantic gravity errors use the error result variant", () => {
  const result = createTraditionalMead({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.05,
    fermentationFinalGravity: 1.06,
    nutrients: { enabled: false },
    stabilizers: { enabled: false }
  });

  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.code, "invalid_input");
});

test("traditional refinement requires an explicit target rather than interpreting ambiguity", () => {
  const created = createTraditionalMead({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.996,
    nutrients: { enabled: false },
    stabilizers: { enabled: false }
  });
  assert.equal(created.status, "recipe");
  if (created.status !== "recipe") return;

  const result = refineTraditionalMead({ activeRecipeData: created.recipeData });
  assert.equal(result.status, "needs_input");
  if (result.status !== "needs_input") return;
  assert.equal(result.questions[0]?.id, "refinement_target");
});

test("traditional refinement recalculates an active draft through shared contracts", () => {
  const created = createTraditionalMead({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.996,
    nutrients: { enabled: false },
    stabilizers: { enabled: false }
  });
  assert.equal(created.status, "recipe");
  if (created.status !== "recipe") return;

  const result = refineTraditionalMead({
    activeRecipeData: created.recipeData,
    targetOriginalGravity: 1.12
  });
  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;

  assert.equal(result.operation, "refine_traditional");
  assert.ok(Math.abs(result.derived.gravity.ogPrimary - 1.12) < 0.00001);
  assert.ok(Math.abs(result.derived.volume.total - 1) < 0.00001);
  assert.equal(result.recipeData.fg, "0.996");
  assert.equal(recipeDataV2Schema.safeParse(result.recipeData).success, true);
  assert.deepEqual(
    result.derived,
    calculateRecipeDerivedApiResponse(result.recipeData).derived
  );
});

test("traditional refinement rejects drafts outside its two-ingredient boundary", () => {
  const created = createTraditionalMead({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.996,
    nutrients: { enabled: false },
    stabilizers: { enabled: false }
  });
  assert.equal(created.status, "recipe");
  if (created.status !== "recipe") return;

  const result = refineTraditionalMead({
    activeRecipeData: {
      ...created.recipeData,
      ingredients: [
        ...created.recipeData.ingredients,
        {
          lineId: "unexpected-fruit",
          name: "Fruit",
          ref: { kind: "custom" },
          category: "fruit",
          brix: "10",
          secondary: true,
          amounts: {
            weight: { value: "1", unit: "lb" },
            volume: { value: "0.1", unit: "gal" },
            basis: "volume"
          }
        }
      ]
    },
    targetOriginalGravity: 1.12
  });
  assert.equal(result.status, "error");
  if (result.status !== "error") return;
  assert.equal(result.code, "invalid_input");
});

test("recipe explanations return engine-derived ABV facts without changing the draft", () => {
  const created = createTraditionalMead({
    batchVolume: { value: 1, unit: "gal" },
    targetOriginalGravity: 1.1,
    fermentationFinalGravity: 0.996,
    nutrients: { enabled: false },
    stabilizers: { enabled: false }
  });
  assert.equal(created.status, "recipe");
  if (created.status !== "recipe") return;

  const result = explainRecipe({
    activeRecipeData: created.recipeData,
    topic: "abv"
  });
  assert.equal(result.status, "recipe");
  if (result.status !== "recipe") return;

  assert.equal(result.operation, "explain_recipe");
  assert.equal(result.explanation?.topic, "abv");
  assert.equal(result.explanation?.facts[0]?.value, result.derived.gravity.ogPrimary);
  assert.equal(result.explanation?.facts[2]?.value, result.derived.alcohol.abv);
  assert.deepEqual(result.recipeData, created.recipeData);
});

test("foundation conversation evaluations produce their expected result variant", () => {
  const evaluations = representativeRecipeConversations.filter(
    (evaluation) => evaluation.readiness === "foundation"
  );

  assert.ok(evaluations.length >= 3);
  for (const evaluation of evaluations) {
    const result =
      evaluation.workflow === "create"
        ? createTraditionalMead(evaluation.toolInput ?? {})
        : evaluation.workflow === "refine"
          ? refineTraditionalMead(evaluation.toolInput ?? {})
          : explainRecipe(evaluation.toolInput ?? {});
    assert.equal(result.status, evaluation.expectedStatus, evaluation.id);
  }
});
