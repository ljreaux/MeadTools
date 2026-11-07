import assert from "node:assert/strict";
import test from "node:test";
import {
  bottleRowFromPackaging,
  getPackagingBottleRows,
} from "@/components/extraCalcs/BottlingCalculator";
const id = "00000000-0000-4000-8000-000000000001";
test("editing packaging preserves durable identity and actual capacity rather than inferring from its label", () => {
  const saved = {
    id,
    label: "750ml",
    quantity: 4,
    sizeLiters: 0.750123,
    totalLiters: 3.000492,
  };
  const restored = bottleRowFromPackaging(saved);
  assert.equal(restored.id, id);
  assert.equal(restored.size, "custom");
  assert.equal(restored.customSizeValue, "0.750123");
  const again = getPackagingBottleRows([restored], (row) =>
    Number(row.customSizeValue),
  );
  assert.equal(again[0].id, id);
  assert.equal(again[0].sizeLiters, saved.sizeLiters);
});
test("custom converted capacities use the same six-place identity as inventory", () => {
  const restored = bottleRowFromPackaging({
    id,
    label: "Custom",
    quantity: 2,
    sizeLiters: 0.710086,
    totalLiters: 1.420172,
  });
  assert.equal(
    getPackagingBottleRows([restored], () => 24 / 33.814)[0].sizeLiters,
    Math.round((24 / 33.814) * 1e6) / 1e6,
  );
});
test("editing custom packaging restores its selected size and unit", () => {
  const saved = { id, label: "Custom", quantity: 2, sizeLiters: Math.round(24 / 33.814 * 1e6) / 1e6,
    totalLiters: 24 / 33.814 * 2, customSizeValue: 24, customSizeUnits: "fl_oz" as const };
  const restored = bottleRowFromPackaging(saved);
  assert.equal(restored.size, "custom");
  assert.equal(restored.customSizeValue, "24");
  assert.equal(restored.customSizeUnits, "fl_oz");
});
