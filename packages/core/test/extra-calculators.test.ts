import assert from "node:assert/strict";
import test from "node:test";
import {
  estimatedOriginalGravity,
  sulfiteAddition,
  sorbateAddition,
  primingSugarBase,
  benchTrial,
  bottlesToFill,
  bottleBreakdown,
  bottleVolumeLiters,
  juiceLabelEstimate,
  sulfitePpmForPh
} from "../src/extra-calculators";

test("extracted formulas retain representative web results and rounding", () => {
  assert.equal(estimatedOriginalGravity(1, 5), 1.054);
  assert.equal(
    sulfiteAddition(1, "gal", 50, "kMeta").sulfiteGrams,
    (3.785 * 50) / 570
  );
  assert.equal(sulfiteAddition(3.785, "lit", 75, "naMeta").campdenTablets, 1);
  assert.equal(sorbateAddition(1, "gal", 12), (100 / 0.75) * 0.003785411784);
  assert.equal(
    primingSugarBase(68, 2.4, 5),
    15.195 * 5 * (2.4 - 3.0378 + 5.0062e-2 * 68 - 2.6555e-4 * 68 ** 2)
  );
  assert.deepEqual(benchTrial(1, 10, 100, 5, "liter"), {
    adjunctAmount: 0.1,
    adjunctConcentration: 990,
    scaledAdjunct: 1,
    scaledBatch: 5
  });
  assert.deepEqual(benchTrial(1, 10, 100, 5, "gallon"), {
    adjunctAmount: 0.1,
    adjunctConcentration: 990,
    scaledAdjunct: 3.7472,
    scaledBatch: 18.736
  });
});
test("bottle calculations keep nominal conversions and whole-bottle ceiling", () => {
  assert.equal(bottlesToFill(1, 0.75), 2);
  assert.equal(bottlesToFill(-1, 0.75), 0);
  assert.equal(bottleVolumeLiters(500, "ml"), 0.5);
  assert.equal(bottleVolumeLiters(33.814, "fl_oz"), 1);
  assert.deepEqual(bottleBreakdown(1, [{ sizeLiters: 0.75, quantity: 2 }]), {
    totalBottledLiters: 1.5,
    remainingLiters: -0.5
  });
});
test("juice rounding and all pH lookup thresholds remain compatible", () => {
  assert.deepEqual(juiceLabelEstimate(24, "g", 240, "ml", 4), {
    brix: 10,
    specificGravity: 1.04,
    totalSugar: 96
  });
  for (const [ph, ppm] of [
    [2, 11],
    [2.9, 11],
    [3, 13],
    [3.1, 16],
    [3.2, 21],
    [3.3, 26],
    [3.4, 32],
    [3.5, 39],
    [3.6, 50],
    [3.7, 63],
    [3.8, 98],
    [3.9, 123],
    [4.2, 123]
  ])
    assert.equal(sulfitePpmForPh(ph), ppm);
  assert.equal(sulfitePpmForPh(3.76), 98);
});
