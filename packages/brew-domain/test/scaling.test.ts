import assert from "node:assert/strict";
import test from "node:test";

import {
  getBrewTrackingScaleRatio,
  roundEditableAmount,
  scaleAdditiveSuggestions,
  scaleSecondaryIngredientSuggestions,
  type AdditiveSuggestionLine,
  type IngredientSuggestionLine
} from "../src/scaling";

const secondaryIngredient: IngredientSuggestionLine = {
  lineId: "secondary-honey",
  name: "Honey",
  secondary: true,
  amounts: {
    basis: "weight",
    weight: { value: "2.5", unit: "lb" },
    volume: { value: "0.75", unit: "gal" }
  }
};

const additive: AdditiveSuggestionLine = {
  lineId: "tannin",
  name: "Tannin",
  amount: "1.234",
  unit: "g"
};

test("getBrewTrackingScaleRatio requires positive finite volumes", () => {
  assert.equal(getBrewTrackingScaleRatio(null, 4), null);
  assert.equal(getBrewTrackingScaleRatio(2, 0), null);
  assert.equal(getBrewTrackingScaleRatio(Number.NaN, 4), null);
  assert.equal(getBrewTrackingScaleRatio(2, Number.POSITIVE_INFINITY), null);
  assert.equal(getBrewTrackingScaleRatio(2, 4), 0.5);
});

test("roundEditableAmount preserves established rounding boundaries", () => {
  assert.equal(roundEditableAmount(1.234), 1.23);
  assert.equal(roundEditableAmount(1.235), 1.24);
  assert.equal(roundEditableAmount(-0), 0);
  assert.equal(roundEditableAmount(Number.NaN), 0);
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

test("scaling returns empty maps when a scale ratio is unavailable", () => {
  assert.equal(
    scaleSecondaryIngredientSuggestions({
      lines: [secondaryIngredient],
      loggedIds: new Set(),
      currentVolumeL: null,
      recipeBaseVolumeL: 4
    }).size,
    0
  );
  assert.equal(
    scaleAdditiveSuggestions({
      lines: [additive],
      loggedIds: new Set(),
      currentVolumeL: 2,
      recipeBaseVolumeL: 0
    }).size,
    0
  );
});
