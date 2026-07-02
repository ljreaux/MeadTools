import assert from "node:assert/strict";
import test from "node:test";
import {
  calcABV,
  calcOG,
  calcSb,
  refractometerCorrectedSg,
  temperatureCorrection,
  toBrix,
  toCelsius,
  toFahrenheit,
  toSG
} from "../src/index";

const gravityCases = [
  {
    og: 1,
    fg: 1,
    brix: -0.001999999999895863,
    abv: 0
  },
  {
    og: 1.06,
    fg: 1.012,
    brix: 14.722719040000072,
    abv: 6.301357740153278
  },
  {
    og: 1.1,
    fg: 1.02,
    brix: 23.745840000000186,
    abv: 10.634482944738897
  },
  {
    og: 1.14,
    fg: 1.04,
    brix: 32.21623136000005,
    abv: 13.498744605941045
  }
] as const;

test("gravity calculations preserve legacy outputs", () => {
  for (const { og, fg, brix, abv } of gravityCases) {
    assert.equal(toBrix(og), brix);
    assert.equal(calcABV(og, fg), abv);
    assert.ok(Math.abs(calcOG(abv, fg) - og) < 1e-12);
  }
});

test("gravity conversion and correction preserve legacy outputs", () => {
  assert.equal(toSG(0), 1.00001);
  assert.equal(toSG(10), 1.040062874);
  assert.equal(toSG(30), 1.1292951980000001);
  assert.equal(refractometerCorrectedSg(23.77705, 8.5), 0.99749370955);
  assert.equal(refractometerCorrectedSg(23.77705, 8.5, 1.04), 0.9975901053365385);
  assert.equal(calcSb(1.1), 1.067);
});

test("calcOG preserves legacy validation behavior", () => {
  assert.throws(
    () => calcOG(-1, 1.012),
    new RangeError("ABV must be a non-negative finite number")
  );
  assert.throws(
    () => calcOG(Number.NaN, 1.012),
    new RangeError("ABV must be a non-negative finite number")
  );
  assert.throws(
    () => calcOG(6.5, 0),
    new RangeError("FG must be a positive finite number")
  );
  assert.throws(
    () => calcOG(100, 1.01),
    new RangeError("ABV is outside the supported OG range")
  );
});

test("temperature calculations preserve legacy outputs", () => {
  assert.equal(toFahrenheit(0), 32);
  assert.equal(toFahrenheit(20), 68);
  assert.equal(toCelsius(32), 0);
  assert.equal(toCelsius(68), 20);
  assert.equal(temperatureCorrection(1.1, 80, 60), 1.1025627064313608);
  assert.equal(temperatureCorrection(1.05, 20, 20), 1.05);
});
