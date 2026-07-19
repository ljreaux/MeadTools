import assert from "node:assert/strict";
import test from "node:test";
import { nutrientDataV2Schema } from "../src/nutrient";
import { isRecipeDataV2, recipeDataV2Schema } from "../src/recipe";

const nutrient = {
  version: 2,
  inputs: {
    volume: "1",
    volumeUnits: "gal",
    sg: "1.100",
    offsetPpm: "0",
    numberOfAdditions: "4",
    goFermType: "Go-Ferm",
    yeastAmountG: "5",
    yeastAmountTouched: true
  },
  selected: {
    yeastBrand: "Lalvin",
    yeastStrain: "D-47",
    nitrogenRequirement: "Low",
    schedule: "tosna",
    selectedNutrients: {
      fermO: true,
      fermK: false,
      dap: false,
      other: false
    }
  },
  settings: {
    yanContribution: {
      fermO: "40",
      fermK: "100",
      dap: "210",
      other: "0"
    },
    maxGpl: {
      fermO: "2.5",
      fermK: "0",
      dap: "0",
      other: "0"
    },
    maxGplTouched: false,
    other: { name: "", usesOrganicMultiplier: false }
  },
  adjustments: {
    adjustAllowed: false,
    providedYanPpm: {
      fermO: "0",
      fermK: "0",
      dap: "0",
      other: "0"
    }
  }
} as const;

const recipe = {
  version: 2,
  unitDefaults: {
    weight: "lb",
    volume: "gal"
  },
  ingredients: [
    {
      lineId: "honey",
      name: "Honey",
      ref: { kind: "custom" },
      category: "sugar",
      brix: "79.6",
      secondary: false,
      amounts: {
        weight: { value: "3", unit: "lb" },
        volume: { value: "0.25", unit: "gal" },
        basis: "weight"
      }
    }
  ],
  fg: "1.000",
  additives: [
    {
      lineId: "oak",
      name: "Oak",
      amount: "1",
      unit: "g",
      amountTouched: true,
      amountDim: "weight"
    }
  ],
  stabilizers: {
    adding: true,
    takingPh: true,
    phReading: "3.5",
    type: "kmeta"
  },
  notes: {
    primary: [{ lineId: "note", content: ["Pitch", "Day 0"] }],
    secondary: []
  },
  nutrients: nutrient,
  flags: {
    advanced: true,
    private: false
  }
} as const;

test("recipe v2 schema accepts a complete shared DTO", () => {
  assert.equal(recipeDataV2Schema.safeParse(recipe).success, true);
  assert.equal(isRecipeDataV2(recipe), true);
});

test("nutrient v2 schema validates nested schedules and inputs", () => {
  assert.equal(nutrientDataV2Schema.safeParse(nutrient).success, true);
  assert.equal(
    nutrientDataV2Schema.safeParse({
      ...nutrient,
      selected: { ...nutrient.selected, schedule: "invented" }
    }).success,
    false
  );
});

test("nutrient v2 schema defaults the organic multiplier for saved recipes", () => {
  const legacyNutrient = {
    ...nutrient,
    settings: {
      ...nutrient.settings,
      other: { name: nutrient.settings.other.name }
    }
  };

  const parsed = nutrientDataV2Schema.parse(legacyNutrient);
  assert.equal(parsed.settings.other.usesOrganicMultiplier, false);

  const parsedRecipe = recipeDataV2Schema.parse({
    ...recipe,
    nutrients: legacyNutrient
  });
  assert.equal(parsedRecipe.nutrients?.settings.other.usesOrganicMultiplier, false);
});

test("recipe schema rejects version, unit, and nested shape mismatches", () => {
  assert.equal(recipeDataV2Schema.safeParse({ ...recipe, version: 1 }).success, false);
  assert.equal(
    recipeDataV2Schema.safeParse({
      ...recipe,
      unitDefaults: { ...recipe.unitDefaults, volume: "bucket" }
    }).success,
    false
  );
  assert.equal(
    recipeDataV2Schema.safeParse({
      ...recipe,
      ingredients: [
        {
          ...recipe.ingredients[0],
          amounts: {
            ...recipe.ingredients[0].amounts,
            weight: { value: 3, unit: "lb" }
          }
        }
      ]
    }).success,
    false
  );
});

test("recipe schema accepts omitted optional nutrients and flags", () => {
  const { nutrients: _nutrients, flags: _flags, ...minimalRecipe } = recipe;
  assert.equal(recipeDataV2Schema.safeParse(minimalRecipe).success, true);
});
