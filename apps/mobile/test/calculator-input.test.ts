import assert from "node:assert/strict";
import test from "node:test";

import { webPageUrl } from "../src/config/api";
import {
  calculatorInputText,
  convertTemperatureText,
  formatCalculatorResult,
  localizeDecimalText,
  readCalculatorNumber,
  readCalculatorNumbers
} from "../src/tools/calculator-input";
import { toolGroups } from "../src/tools/tool-list";

test("calculator fields accept either decimal separator", () => {
  assert.equal(readCalculatorNumber("1.050"), 1.05);
  assert.equal(readCalculatorNumber("1,050"), 1.05);
  assert.equal(readCalculatorNumber(" 12 "), 12);
  assert.equal(readCalculatorNumber("-0,5"), -0.5);
});

test("empty, half-typed and invalid fields have no value", () => {
  for (const text of ["", "1.", "1,", "abc", "1.2.3", "1.000,5"]) {
    assert.equal(readCalculatorNumber(text), null, text);
  }
  assert.deepEqual(readCalculatorNumbers(["1.1", "1,0"] as const), [1.1, 1]);
  assert.equal(readCalculatorNumbers(["1.1", ""] as const), null);
});

test("results use the web's display rounding with the device locale", () => {
  assert.equal(formatCalculatorResult("en", 1.0504, 3, true), "1.050");
  assert.equal(formatCalculatorResult("de", 1.0504, 3, true), "1,050");
  assert.equal(formatCalculatorResult("en", 13.456, 2), "13.46");
  assert.equal(formatCalculatorResult("en", -0.0001, 2), "0");
  assert.equal(formatCalculatorResult("en", Number.NaN, 2), "0");
  assert.equal(formatCalculatorResult("en", 1234.5, 0), "1,235");
});

test("prefilled values use the locale's separator without grouping", () => {
  assert.equal(calculatorInputText("en", 1.105), "1.105");
  assert.equal(calculatorInputText("de", 1.105), "1,105");
  assert.equal(calculatorInputText("en", 1000), "1000");
});

test("typed temperatures convert when the scale changes", () => {
  assert.equal(convertTemperatureText("en", "68", "F", "C"), "20");
  assert.equal(convertTemperatureText("en", "90", "F", "C"), "32.2");
  assert.equal(convertTemperatureText("de", "32,2", "C", "F"), "90");
  assert.equal(convertTemperatureText("en", "", "F", "C"), "");
  assert.equal(convertTemperatureText("en", "68", "F", "F"), "68");
});

test("every tool route is under the Tools tab and the article link uses the app's server", () => {
  for (const tool of toolGroups.flatMap((group) => group.tools)) {
    assert.match(tool.href, /^\/tools\/[a-z-]+$/);
  }
  assert.equal(
    webPageUrl("/woodlandbrew-abv-without-og", "https://meadtools.com"),
    "https://meadtools.com/woodlandbrew-abv-without-og"
  );
});

test("typed stabilizer volumes convert with the web's factor and rounding", async () => {
  const { convertStabilizerVolumeText } = await import("../src/tools/calculator-input");
  assert.equal(convertStabilizerVolumeText("en", "1", "gal", "lit"), "3.785");
  assert.equal(convertStabilizerVolumeText("de", "5", "lit", "gal"), "1,321");
  assert.equal(convertStabilizerVolumeText("en", "", "gal", "lit"), "");
  assert.equal(convertStabilizerVolumeText("en", "2", "gal", "gal"), "2");
});

test("batch volumes convert with each calculator's factor", async () => {
  const { convertVolumeText } = await import("../src/tools/calculator-input");
  assert.equal(convertVolumeText("en", "5", "gal", "lit", 3.78541), "18.927");
  assert.equal(convertVolumeText("de", "18,927", "lit", "gal", 3.78541), "5");
  assert.equal(convertVolumeText("en", "1", "gal", "lit", 3.785), "3.785");
  assert.equal(convertVolumeText("en", "", "gal", "lit", 3.785), "");
});

test("catalog names map to the web's camelCase translation keys", async () => {
  const { catalogLabelKey } = await import("../src/tools/calculator-input");
  assert.equal(catalogLabelKey("Table Sugar"), "tableSugar");
  assert.equal(catalogLabelKey("Belgian Candi Syrup"), "belgianCandiSyrup");
  assert.equal(catalogLabelKey("Honey"), "honey");
  assert.equal(catalogLabelKey("Boiled Bread Yeast (BBY)"), "boiledBreadYeastBby");
});

test("filled-in decimals use the locale's separator; typed text is unchanged", () => {
  assert.equal(localizeDecimalText("de", "0.45"), "0,45");
  assert.equal(localizeDecimalText("en", "0.45"), "0.45");
  assert.equal(localizeDecimalText("en", "1.50"), "1.50");
  assert.equal(localizeDecimalText("en", "1."), "1.");
  assert.equal(localizeDecimalText("de", "13.33333333333333"), "13,33333333333333");
  assert.equal(localizeDecimalText("de", "10"), "10");
  assert.equal(localizeDecimalText("de", "1,5"), "1,5");
  assert.equal(localizeDecimalText("de", ""), "");
});
