import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWirelessHydrometerChartData,
  hydrometerMetricSamples,
  sampleChartExtrema
} from "../src/hydrometer";

const reading = {
  datetime: "2026-11-27T00:00:00Z",
  gravity: 1.1,
  calculated_gravity: null,
  temperature: 68,
  temp_units: "F" as const,
  battery: 3.7
};
test("wireless points sort by time, prefer calibrated gravity and normalize mixed temperatures", () => {
  const input = [
    {
      ...reading,
      datetime: "2026-11-28T00:00:00Z",
      calculated_gravity: 1.02,
      temperature: 20,
      temp_units: "C" as const
    },
    reading
  ];
  const points = buildWirelessHydrometerChartData(input, "C");
  assert.deepEqual(
    points.map((point) => [point.gravity, point.temperature]),
    [
      [1.1, 20],
      [1.02, 20]
    ]
  );
  assert.equal(points[0].abv, 0);
  assert.ok(points[1].abv! > 0);
  assert.equal(input[0].temp_units, "C");
  assert.equal(hydrometerMetricSamples(points, "gravity", "SG")[1].value, 1.02);
  assert.ok(hydrometerMetricSamples(points, "gravity", "Brix")[1].value > 4);
});
test("invalid timestamps never establish original gravity; zero calibration and battery are not discarded", () => {
  const points = buildWirelessHydrometerChartData([
    { ...reading, datetime: "invalid", gravity: 1.5 },
    reading,
    { ...reading, calculated_gravity: 0, battery: 0 }
  ]);
  assert.equal(points.length, 2);
  assert.equal(points[0].abv, 0);
  assert.equal(points[1].gravity, 0);
  assert.equal(points[1].battery, 0);
  assert.deepEqual(buildWirelessHydrometerChartData([]), []);
});
test("large series preserve spikes, dips and endpoints within the rendering limit", () => {
  const points = Array.from({ length: 10_000 }, (_, i) => ({
    date: new Date(i * 1000).toISOString(),
    value: i === 4000 ? 100 : i === 4001 ? -80 : 1
  }));
  const sampled = sampleChartExtrema(points, 400);
  assert.ok(sampled.length <= 400);
  assert.deepEqual(sampled[0], points[0]);
  assert.deepEqual(sampled.at(-1), points.at(-1));
  assert.ok(sampled.some((point) => point.value === 100));
  assert.ok(sampled.some((point) => point.value === -80));
  assert.equal(points.length, 10_000);
  assert.throws(() => sampleChartExtrema(points, 2));
});
test("chart sampling handles empty, constant, duplicate-time and invalid readings", () => {
  assert.deepEqual(sampleChartExtrema([]), []);
  const point = { date: reading.datetime, value: 0 };
  assert.deepEqual(
    sampleChartExtrema([point, point, { ...point, date: "bad" }, { ...point, value: NaN }]),
    [point, point]
  );
});
