import assert from "node:assert/strict";
import test from "node:test";
import { formatBottleSize, formatStoredBottleSize } from "./bottleUnits";
import { productionBottleDisplaySize, bottleDisplayMatches } from "@meadtools/inventory-domain";
test("stored bottle sizes display exactly as entered, even within a mixed collection", () => {
  assert.equal(formatStoredBottleSize({ size_liters: .354882, display_size: { value: 12, unit: "fl_oz" } }, "en"), "12 fl oz");
  assert.equal(formatStoredBottleSize({ size_liters: .75, display_size: { value: 750, unit: "mL" } }, "en"), "750 mL");
  assert.equal(formatBottleSize({ value: .75, unit: "L" }, "de"), "0,75 L");
  assert.equal(formatStoredBottleSize({ size_liters: .75 }, "en"), "0.75 L");
});
test("packaging preserves presets and custom units while rejecting inconsistent metadata", () => {
  assert.deepEqual(productionBottleDisplaySize({ label: "750 mL", sizeLiters: .75 }), { value: 750, unit: "mL" });
  assert.deepEqual(productionBottleDisplaySize({ label: "22oz", sizeLiters: .65 }), { value: 22, unit: "fl_oz" });
  assert.deepEqual(productionBottleDisplaySize({ label: "750ml", sizeLiters: .750123 }), { value: .750123, unit: "L" });
  assert.deepEqual(productionBottleDisplaySize({ label: "Custom", sizeLiters: Math.round(24 / 33.814 * 1e6) / 1e6, customSizeValue: 24, customSizeUnits: "fl_oz" }), { value: 24, unit: "fl_oz" });
  assert.equal(bottleDisplayMatches(.65, { value: 22, unit: "fl_oz" }), true);
  assert.equal(bottleDisplayMatches(.75, { value: 12, unit: "fl_oz" }), false);
});
