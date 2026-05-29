import assert from "node:assert/strict";
import test from "node:test";
import {
  getBrewTrackingScaleRatio,
  scaleAdditiveSuggestions,
  scaleSecondaryIngredientSuggestions
} from "@/lib/utils/brewTrackingScaling";
import type { AdditiveLine, IngredientLine } from "@/types/recipeData";

const secondaryIngredient: IngredientLine = {
  lineId: "secondary-honey",
  name: "Honey",
  ref: { kind: "custom" },
  category: "sugar",
  brix: "79.6",
  secondary: true,
  amounts: {
    basis: "weight",
    weight: { value: "2.5", unit: "lb" },
    volume: { value: "0.75", unit: "gal" }
  }
};

const additive: AdditiveLine = {
  lineId: "tannin",
  name: "Tannin",
  amount: "1.234",
  unit: "g",
  amountTouched: false,
  amountDim: "weight"
};

test("getBrewTrackingScaleRatio requires positive current and recipe volumes", () => {
  assert.equal(getBrewTrackingScaleRatio(null, 4), null);
  assert.equal(getBrewTrackingScaleRatio(2, 0), null);
  assert.equal(getBrewTrackingScaleRatio(2, 4), 0.5);
});

test("scaleSecondaryIngredientSuggestions scales only unlogged secondary rows", () => {
  const scaled = scaleSecondaryIngredientSuggestions({
    lines: [
      secondaryIngredient,
      { ...secondaryIngredient, lineId: "logged-secondary" },
      { ...secondaryIngredient, lineId: "primary", secondary: false }
    ],
    loggedIds: new Set(["logged-secondary"]),
    currentVolumeL: 2,
    recipeBaseVolumeL: 4
  });

  assert.deepEqual(Array.from(scaled.keys()), ["secondary-honey"]);
  assert.equal(scaled.get("secondary-honey")?.basisAmount, 1.25);
  assert.equal(scaled.get("secondary-honey")?.volumeAmount, 0.38);
});

test("scaleAdditiveSuggestions scales only unlogged additives", () => {
  const scaled = scaleAdditiveSuggestions({
    lines: [additive, { ...additive, lineId: "logged-additive" }],
    loggedIds: new Set(["logged-additive"]),
    currentVolumeL: 2,
    recipeBaseVolumeL: 4
  });

  assert.deepEqual(Array.from(scaled.keys()), ["tannin"]);
  assert.equal(scaled.get("tannin")?.amount, 0.62);
});
