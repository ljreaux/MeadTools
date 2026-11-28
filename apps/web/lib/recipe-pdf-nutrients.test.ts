import assert from "node:assert/strict";
import test from "node:test";
import { createInstance } from "i18next";

import { calculateRecipeDerivedState } from "@meadtools/core/derived";
import { initialNutrientData } from "@meadtools/core/nutrients";

import { createRecipePdfModel } from "../components/recipeBuilder/recipePdfModel";
import { traditionalRecipeFixture } from "./utils/__fixtures__/recipeDerivedFixtures";

test("the first recipe PDF resolves auto nutrient amounts and respects manual adjustments", async () => {
  const i18n = createInstance();
  await i18n.init({ lng: "en", resources: {} });
  const data = { ...traditionalRecipeFixture, nutrients: initialNutrientData() };
  const derived = calculateRecipeDerivedState(data);
  const nutrientData = derived.nutrientValueForRecipe;
  nutrientData.inputs.numberOfAdditions = "3";
  nutrientData.selected.schedule = "tosna";
  nutrientData.selected.selectedNutrients = { fermO: true, fermK: false, dap: false, other: false };
  nutrientData.adjustments.providedYanPpm = { fermO: "0", fermK: "0", dap: "0", other: "0" };
  const recipe = {
    data,
    derived,
    stabilizers: {
      addingStabilizers: false,
      stabilizerType: "kmeta" as const,
      sulfite: 0,
      campden: 0,
      sorbate: 0
    }
  };

  const automatic = createRecipePdfModel({ recipe, nutrientData, t: i18n.t, i18n });
  assert.match(automatic.nutrients.perAddition[0], /^[1-9]|^0\.[0-9]*[1-9]/);
  assert.match(automatic.nutrients.total[0], /^[1-9]/);

  const manual = {
    ...nutrientData,
    adjustments: { ...nutrientData.adjustments, adjustAllowed: true }
  };
  const manualReport = createRecipePdfModel({ recipe, nutrientData: manual, t: i18n.t, i18n });
  assert.deepEqual(manualReport.nutrients.perAddition, ["0g Fermaid O"]);
  assert.deepEqual(manualReport.nutrients.total, ["0g Fermaid O"]);
});
