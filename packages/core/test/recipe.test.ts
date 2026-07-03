import assert from "node:assert/strict";
import test from "node:test";
import { blendValues } from "../src/blend";
import { parseNumber } from "../src/numeric";
import {
  calculateBlend,
  calculateHoneyAndWaterL,
  convertAdditiveAmount,
  dosageToAmount,
  isEffectivelyEmptyNumericInput,
  normalizeIngredientLine,
  shouldConvertAdditiveAmount,
  VOLUME_TO_L
} from "../src/recipe";

test("numeric parsing preserves supported decimal separators", () => {
  assert.equal(parseNumber("1,25"), 1.25);
  assert.equal(parseNumber("1٫25"), 1.25);
  assert.equal(parseNumber(1.25), 1.25);
  assert.ok(Number.isNaN(parseNumber("")));
});

test("blendValues preserves weighted blending and empty behavior", () => {
  assert.deepEqual(
    blendValues([
      [1, 3],
      [1.1, 1]
    ]),
    { blendedValue: 1.025, totalVolume: 4 }
  );
  assert.deepEqual(blendValues([]), { blendedValue: 0, totalVolume: 0 });
  assert.deepEqual(calculateBlend([]), { sg: 1, volumeL: 0 });
});

test("ingredient normalization uses kilograms and liters", () => {
  const normalized = normalizeIngredientLine({
    lineId: "ingredient",
    secondary: false,
    category: "sugar",
    brix: "79,6",
    amounts: {
      weight: { value: "2.2046226218", unit: "lb" },
      volume: { value: "1", unit: "gal" }
    }
  });

  assert.equal(normalized.brix, 79.6);
  assert.equal(normalized.weightKg, 0.9999999999778757);
  assert.equal(normalized.volumeL, VOLUME_TO_L.gal);
});

test("honey and water targeting preserves volume", () => {
  const result = calculateHoneyAndWaterL(1.1, 5);

  assert.ok(Math.abs(result.honeyL + result.waterL - 5) < 1e-12);
  assert.throws(() => calculateHoneyAndWaterL(0.9, 5));
  assert.throws(() => calculateHoneyAndWaterL(2, 5));
});

test("additive conversions preserve dimension and formatting rules", () => {
  assert.equal(
    convertAdditiveAmount({
      amountStr: "1",
      fromUnit: "kg",
      toUnit: "g"
    }),
    "1000.000"
  );
  assert.equal(
    convertAdditiveAmount({
      amountStr: "1",
      fromUnit: "g",
      toUnit: "ml"
    }),
    "1"
  );
  assert.equal(dosageToAmount({ dosage: 2, totalVolumeL: 3.785411784 }), "2.000");
  assert.equal(
    shouldConvertAdditiveAmount({
      amountStr: "1",
      fromUnit: "g",
      toUnit: "kg",
      amountTouched: false,
      amountDim: "weight"
    }),
    true
  );
});

test("empty numeric input detection accepts localized zero placeholders", () => {
  assert.equal(isEffectivelyEmptyNumericInput(""), true);
  assert.equal(isEffectivelyEmptyNumericInput("00,000"), true);
  assert.equal(isEffectivelyEmptyNumericInput("0٫0"), true);
  assert.equal(isEffectivelyEmptyNumericInput("0.1"), false);
});
