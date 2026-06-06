import assert from "node:assert/strict";
import test from "node:test";
import {
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
