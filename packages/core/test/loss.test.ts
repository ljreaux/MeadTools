import assert from "node:assert/strict";
import test from "node:test";
import { calculateRecipeDerivedState, type RecipeDerivedInput } from "../src/derived";
import {
  estimatePrimaryLossPercentage,
  estimateSecondaryLossPercentage
} from "../src/loss";
import { normalizeIngredientLine, type IngredientLineInput } from "../src/recipe";

function line(
  lineId: string,
  category: string,
  volumeL: number,
  brix: string,
  secondary = false,
): IngredientLineInput {
  return {
    lineId,
    category,
    secondary,
    brix,
    amounts: {
      weight: { value: String(volumeL), unit: "kg" },
      volume: { value: String(volumeL), unit: "L" },
    },
  };
}

const recipe: RecipeDerivedInput = {
  version: 2,
  unitDefaults: { weight: "kg", volume: "L" },
  ingredients: [
    line("water", "water", 3, "0"),
    line("honey", "sugar", 1, "79.6"),
    line("fruit", "fruit", 2, "10"),
    line("backsweetening", "sugar", 1, "79.6", true),
  ],
  fg: "1.01",
  stabilizers: { adding: false, takingPh: false, phReading: "3.6", type: "kmeta" },
};

test("older recipes without loss and disabled loss preserve the same calculations", () => {
  const original = calculateRecipeDerivedState(recipe);
  const disabled = calculateRecipeDerivedState({
    ...recipe,
    lossAdjustment: { enabled: false, mode: "manual", percentage: 50 },
  });
  const zero = calculateRecipeDerivedState({
    ...recipe,
    lossAdjustment: { enabled: true, mode: "manual", percentage: 0 },
  });

  assert.equal(original.lossPercentage, 0);
  assert.equal(original.totalVolumeL, 7);
  assert.equal(disabled.totalVolumeL, original.totalVolumeL);
  assert.equal(disabled.backsweetenedFg, original.backsweetenedFg);
  assert.equal(disabled.abv, original.abv);
  assert.equal(zero.totalVolumeL, original.totalVolumeL);
  assert.equal(zero.backsweetenedFg, original.backsweetenedFg);
  assert.equal(zero.abv, original.abv);
});

test("automatic estimate reflects primary solid ingredient share, including fruit-heavy batches", () => {
  const normalized = recipe.ingredients.map(normalizeIngredientLine);
  assert.equal(estimatePrimaryLossPercentage(normalized), 25);
  assert.equal(
    estimatePrimaryLossPercentage([
      line("fruit", "fruit", 4, "10"),
      line("honey", "sugar", 1, "79.6"),
    ].map(normalizeIngredientLine)),
    53,
  );
  assert.equal(estimatePrimaryLossPercentage([]), null);
  assert.equal(
    estimatePrimaryLossPercentage([
      { ...line("catalog-juice", "fruit", 3, "7.26"), name: "Cranberry Juice" },
      line("honey", "sugar", 1, "79.6"),
    ].map(normalizeIngredientLine)),
    5,
  );
  assert.equal(
    estimatePrimaryLossPercentage([
      line("secondary", "fruit", 2, "10", true),
    ].map(normalizeIngredientLine)),
    null,
  );
});

test("secondary ingredient suggestion uses only secondary solids and the post-transfer base", () => {
  const lines = [
    line("primary-fruit", "fruit", 5, "10"),
    line("secondary-fruit", "fruit", 2, "10", true),
    line("secondary-juice", "fruit", 1, "7", true),
  ];
  lines[2].name = "Cherry Juice";
  assert.equal(
    estimateSecondaryLossPercentage(lines.map(normalizeIngredientLine), 4),
    22,
  );
  assert.equal(
    estimateSecondaryLossPercentage([line("primary", "fruit", 5, "10")].map(normalizeIngredientLine), 4),
    5,
  );
  assert.equal(estimateSecondaryLossPercentage([], 0), null);
});

test("manual loss changes transfer volume and backsweetened results without changing OG", () => {
  const original = calculateRecipeDerivedState(recipe);
  const adjusted = calculateRecipeDerivedState({
    ...recipe,
    lossAdjustment: { enabled: true, mode: "manual", percentage: 50 },
  });

  assert.equal(adjusted.primaryVolumeL, 6);
  assert.equal(adjusted.postLossPrimaryVolumeL, 3);
  assert.equal(adjusted.lossVolumeL, 3);
  assert.equal(adjusted.totalVolumeL, 4);
  assert.equal(adjusted.ogPrimary, original.ogPrimary);
  assert.ok(adjusted.backsweetenedFg > original.backsweetenedFg);
  assert.ok(adjusted.abv < original.abv);
});

test("loss without secondary additions changes yield but not FG or ABV", () => {
  const noSecondary = { ...recipe, ingredients: recipe.ingredients.filter((line) => !line.secondary) };
  const original = calculateRecipeDerivedState(noSecondary);
  const adjusted = calculateRecipeDerivedState({
    ...noSecondary,
    lossAdjustment: { enabled: true, mode: "manual", percentage: 40 },
  });

  assert.ok(Math.abs(adjusted.totalVolumeL - original.primaryVolumeL * 0.6) < 1e-12);
  assert.equal(adjusted.backsweetenedFg, original.backsweetenedFg);
  assert.equal(adjusted.abv, original.abv);
});

test("secondary loss changes bottling yield only, after secondary additions", () => {
  const primaryOnly = calculateRecipeDerivedState({
    ...recipe,
    lossAdjustment: { enabled: true, mode: "manual", percentage: 50 },
  });
  const adjusted = calculateRecipeDerivedState({
    ...recipe,
    lossAdjustment: {
      enabled: true,
      mode: "manual",
      percentage: 50,
      secondary: { enabled: true, percentage: 20 },
    },
  });

  assert.equal(adjusted.totalVolumeL, 4);
  assert.equal(adjusted.secondaryLossPercentage, 20);
  assert.equal(adjusted.secondaryLossVolumeL, 0.8);
  assert.equal(adjusted.bottlingVolumeL, 3.2);
  assert.equal(adjusted.abv, primaryOnly.abv);
  assert.equal(adjusted.backsweetenedFg, primaryOnly.backsweetenedFg);

  const secondaryOnly = calculateRecipeDerivedState({
    ...recipe,
    lossAdjustment: {
      enabled: false,
      mode: "manual",
      percentage: 0,
      secondary: { enabled: true, percentage: 20 },
    },
  });
  assert.equal(secondaryOnly.totalVolumeL, 7);
  assert.equal(secondaryOnly.bottlingVolumeL, 5.6);
});

test("malformed percentages in old snapshots fall back to disabled calculations", () => {
  const original = calculateRecipeDerivedState(recipe);
  for (const percentage of [-1, 100, Number.NaN, Number.POSITIVE_INFINITY]) {
    const calculated = calculateRecipeDerivedState({
      ...recipe,
      lossAdjustment: { enabled: true, mode: "manual", percentage },
    });
    assert.equal(calculated.totalVolumeL, original.totalVolumeL);
    assert.equal(calculated.abv, original.abv);
  }
  for (const percentage of [-1, 100, Number.NaN, Number.POSITIVE_INFINITY]) {
    const calculated = calculateRecipeDerivedState({
      ...recipe,
      lossAdjustment: {
        enabled: false,
        mode: "manual",
        percentage: 0,
        secondary: { enabled: true, percentage },
      },
    });
    assert.equal(calculated.bottlingVolumeL, original.totalVolumeL);
  }
});
