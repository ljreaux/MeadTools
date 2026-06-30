import assert from "node:assert/strict";
import test from "node:test";
import {
  calcABV,
  calcOG,
  refractometerCorrectedSg,
  toBrix,
  toSG
} from "@/lib/utils/unitConverter";
import {
  formatBrixDisplay,
  formatSgDisplay
} from "@/lib/utils/gravityFormatting";

test("refractometerCorrectedSg matches existing correction formula", () => {
  const ogBrix = toBrix(1.1);
  const fgBrix = 8.5;
  const expected = -0.002349 * ogBrix + 0.006276 * fgBrix + 1;

  assert.equal(refractometerCorrectedSg(ogBrix, fgBrix, 1), expected);
});

test("gravity display formatters use fixed SG and Brix precision", () => {
  assert.equal(formatSgDisplay(1.04, "en"), "1.040");
  assert.equal(formatBrixDisplay(10, "Brix", "en"), "10.00 Brix");
});

test("toSG keeps Brix conversion usable for pre-fermentation readings", () => {
  assert.equal(Number(toSG(10).toFixed(3)), 1.040);
});

test("calcOG reverses calcABV for typical brewing gravities", () => {
  for (const [og, fg] of [
    [1.06, 1.012],
    [1.1, 1.02],
    [1.14, 1.04]
  ]) {
    const abv = calcABV(og, fg);
    assert.ok(Math.abs(calcOG(abv, fg) - og) < 1e-12);
  }
});

test("calcOG returns FG for zero ABV", () => {
  assert.equal(calcOG(0, 1.012), 1.012);
});

test("calcOG rejects invalid inputs", () => {
  assert.throws(() => calcOG(-1, 1.012), RangeError);
  assert.throws(() => calcOG(Number.NaN, 1.012), RangeError);
  assert.throws(() => calcOG(6.5, 0), RangeError);
});
