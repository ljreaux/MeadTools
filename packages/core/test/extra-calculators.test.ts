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

test("gravity calculator helpers match the web pages' previous wiring", async () => {
  const { refractometerCorrectedSg, toBrix, toSG } = await import("../src/gravity");
  const { temperatureCorrection, toFahrenheit } = await import("../src/temperature");
  const {
    estimatedOriginalGravityResult,
    gravityToBrix,
    gravityToSg,
    isImplausibleAbv,
    refractometerCorrection,
    standaloneAlcohol,
    temperatureCorrectedGravity
  } = await import("../src/extra-calculators");

  assert.equal(gravityToSg(1.05, "SG"), 1.05);
  assert.equal(gravityToSg(12, "Brix"), toSG(12));
  assert.equal(gravityToBrix(12, "Brix"), 12);
  assert.equal(gravityToBrix(1.05, "SG"), toBrix(1.05));

  // Web defaults: OG 1.1 SG, FG 8.5 Brix, factor 1.
  const refrac = refractometerCorrection({
    originalGravity: 1.1,
    originalGravityScale: "SG",
    finalGravity: 8.5,
    finalGravityScale: "Brix",
    correctionFactor: 1
  });
  const expectedSg = refractometerCorrectedSg(toBrix(1.1), 8.5, 1);
  assert.equal(refrac.correctedSg, expectedSg);
  assert.equal(refrac.correctedBrix, toBrix(expectedSg));
  assert.deepEqual(
    { abvPercent: refrac.abvPercent, delle: refrac.delle },
    standaloneAlcohol(1.1, expectedSg)
  );

  const brixOg = refractometerCorrection({
    originalGravity: 24,
    originalGravityScale: "Brix",
    finalGravity: 1.01,
    finalGravityScale: "SG",
    correctionFactor: 1.04
  });
  assert.equal(brixOg.originalGravitySg, toSG(24));
  assert.equal(brixOg.correctedSg, refractometerCorrectedSg(24, toBrix(1.01), 1.04));

  // Web defaults: 1.1 measured at 90 °F, calibrated at 68 °F.
  assert.equal(temperatureCorrectedGravity({ measuredSg: 1.1, currentTemp: 90, calibrationTemp: 68, scale: "F" }).sg,
    temperatureCorrection(1.1, 90, 68));
  const celsius = temperatureCorrectedGravity({ measuredSg: 1.05, currentTemp: 30, calibrationTemp: 20, scale: "C" });
  assert.equal(celsius.sg, temperatureCorrection(1.05, toFahrenheit(30), toFahrenheit(20)));
  assert.equal(celsius.brix, toBrix(celsius.sg));

  // Web defaults: hydrometer 1.0, refractometer 5 Brix.
  const est = estimatedOriginalGravityResult(1, 5);
  assert.equal(est.sg, 1.054);
  assert.equal(est.brix, toBrix(1.054));
  assert.deepEqual({ abvPercent: est.abvPercent, delle: est.delle }, standaloneAlcohol(1.054, 1));
  assert.deepEqual(
    { abvPercent: estimatedOriginalGravityResult(Number.NaN, 5).abvPercent },
    { abvPercent: 0 }
  );

  assert.equal(isImplausibleAbv(12), false);
  assert.equal(isImplausibleAbv(23.004), false);
  assert.equal(isImplausibleAbv(23.01), true);
  assert.equal(isImplausibleAbv(-0.01), true);
  assert.equal(isImplausibleAbv(-0.001), false);
});

test("roundForDisplay matches the web display rounding", async () => {
  const { roundForDisplay } = await import("../src/numeric");
  assert.equal(roundForDisplay(1.23456, 3), 1.235);
  assert.equal(roundForDisplay(-0.0001, 2), 0);
  assert.ok(Object.is(roundForDisplay(-0, 2), 0));
  assert.equal(roundForDisplay(Number.NaN, 2), 0);
  assert.equal(roundForDisplay(12.5, 0), 13);
});

test("stabilizer helpers match the web stabilizer hook", async () => {
  const {
    convertStabilizerVolume,
    DEFAULT_STABILIZER_PH,
    SORBATE_MAX_ABV,
    sorbateAddition,
    stabilizerAdditions,
    sulfiteAddition,
    sulfitePpmForPh
  } = await import("../src/extra-calculators");

  assert.equal(convertStabilizerVolume(1, "gal", "lit"), 3.785);
  assert.equal(convertStabilizerVolume(5, "lit", "gal"), 1.321);
  assert.equal(convertStabilizerVolume(5, "lit", "lit"), 5);

  // Web defaults: 1 gal, 12% ABV, no reading (pH 3.6), potassium.
  const defaults = stabilizerAdditions({ volume: 1, unit: "gal", abv: 12, ph: null, type: "kMeta" });
  assert.equal(defaults.sulfitePpm, sulfitePpmForPh(DEFAULT_STABILIZER_PH));
  assert.equal(defaults.sulfitePpm, 50);
  assert.equal(defaults.sorbateGrams, sorbateAddition(1, "gal", 12));
  assert.deepEqual(
    { sulfiteGrams: defaults.sulfiteGrams, campdenTablets: defaults.campdenTablets },
    sulfiteAddition(1, "gal", 50, "kMeta")
  );

  const reading = stabilizerAdditions({ volume: 20, unit: "lit", abv: 14, ph: 3.34, type: "naMeta" });
  assert.equal(reading.sulfitePpm, 26);
  assert.deepEqual(
    { sulfiteGrams: reading.sulfiteGrams, campdenTablets: reading.campdenTablets },
    sulfiteAddition(20, "lit", 26, "naMeta")
  );

  assert.equal(sorbateAddition(1, "gal", SORBATE_MAX_ABV), 0);
  // Above 16% ABV no sorbate is needed: 0, never a negative dose.
  assert.equal(stabilizerAdditions({ volume: 5, unit: "lit", abv: 16.5, ph: null, type: "kMeta" }).sorbateGrams, 0);
  assert.ok(sorbateAddition(5, "lit", 16.5) < 0);
});

test("priming sugar helpers match the web priming sugar hook", async () => {
  const {
    PRIMING_TEMPERATURE_RANGE,
    primingBottleSizes,
    primingSugarBase,
    primingSugarOptions,
    primingSugarTable
  } = await import("../src/extra-calculators");
  const { toFahrenheit } = await import("../src/temperature");

  const options = primingSugarOptions([
    { name: "Honey", sugar_content: "79.6", category: "sugar" },
    { name: "Corn Sugar", sugar_content: "100", category: "sugar" },
    { name: "Apple", sugar_content: "10", category: "fruit" },
    { name: "Brown Sugar", sugar_content: "98.1", category: "sugar" },
    { name: "Table Sugar", sugar_content: "99.8", category: "sugar" }
  ]);
  assert.deepEqual(options.map((option) => option.label), ["Corn Sugar", "Table Sugar", "Brown Sugar", "Honey"]);
  assert.equal(options[0].amount, 1);
  assert.equal(options[3].amount, 100 / 79.6);

  const [corn] = primingSugarTable({
    temperature: 68,
    temperatureScale: "F",
    co2Volumes: 2.4,
    volume: 5,
    volumeUnit: "gal",
    sugars: options
  });
  const base = primingSugarBase(68, 2.4, 5);
  assert.equal(corn.totalGrams, base);
  assert.deepEqual(
    corn.perBottle.map((bottle) => bottle.grams),
    primingBottleSizes.map(({ size }) => base / (5 / size))
  );

  const [litersCelsius] = primingSugarTable({
    temperature: 20,
    temperatureScale: "C",
    co2Volumes: 2.4,
    volume: 18.92705,
    volumeUnit: "lit",
    sugars: options
  });
  assert.equal(litersCelsius.totalGrams, primingSugarBase(toFahrenheit(20), 2.4, 18.92705 / 3.78541));

  const [empty] = primingSugarTable({ temperature: 68, temperatureScale: "F", co2Volumes: 2.4, volume: 0, volumeUnit: "gal", sugars: options });
  assert.deepEqual(empty.perBottle.map((bottle) => bottle.grams), [0, 0, 0, 0, 0]);
  assert.deepEqual(PRIMING_TEMPERATURE_RANGE.C, { min: 0, max: 44 });
});

test("bottling helpers match the web bottling calculator", async () => {
  const { bottlesToFinish, bottlingStatus } = await import("../src/extra-calculators");

  assert.equal(bottlingStatus(0.1), "ok");
  assert.equal(bottlingStatus(-0.1), "ok");
  assert.equal(bottlingStatus(0.11), "warn");
  assert.equal(bottlingStatus(-0.11), "error");

  // 5 gal batch, 10 x 750 ml already bottled in another row: 11.43 L left.
  const target = 5 * 3.78541;
  assert.equal(bottlesToFinish({ targetLiters: target, bottledLiters: 7.5, rowLiters: 0, perBottleLiters: 0.75 }), 16);
  // The row's own bottles are not counted against it.
  assert.equal(bottlesToFinish({ targetLiters: target, bottledLiters: 7.5 + 3, rowLiters: 3, perBottleLiters: 0.75 }), 16);
  assert.equal(bottlesToFinish({ targetLiters: target, bottledLiters: 20, rowLiters: 0, perBottleLiters: 0.75 }), 0);
  assert.equal(bottlesToFinish({ targetLiters: target, bottledLiters: 0, rowLiters: 0, perBottleLiters: 0 }), 0);
  // An unreadable volume gives 0 bottles, not NaN.
  assert.equal(bottlesToFinish({ targetLiters: Number.NaN, bottledLiters: 0, rowLiters: 0, perBottleLiters: 0.75 }), 0);
  assert.equal(bottlesToFinish({ targetLiters: target, bottledLiters: 7.5, rowLiters: Number.NaN, perBottleLiters: 0.75 }), 0);
});
