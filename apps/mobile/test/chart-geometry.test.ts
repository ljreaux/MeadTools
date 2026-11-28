import assert from "node:assert/strict";
import test from "node:test";
import { chartGeometry, overlayChartGeometry } from "../src/charts/chart-geometry";
test("a lone or constant reading has finite coordinates and a visible range", () => {
  const point = { date: "2026-11-27T00:00:00Z", value: 1.05 };
  const geometry = chartGeometry([point], 300, 180)!;
  assert.equal(geometry.x(Date.parse(point.date)), 150);
  assert.equal(geometry.y(point.value), 90);
  assert.ok(geometry.high > geometry.low);
  assert.doesNotMatch(geometry.polyline, /NaN|Infinity/);
});
test("spacing follows elapsed time rather than reading index", () => {
  const samples = [0, 1000, 10000].map((time) => ({
    date: new Date(time).toISOString(),
    value: time
  }));
  const geometry = chartGeometry(samples, 300, 180)!;
  assert.equal(geometry.x(1000), 30);
  assert.equal(geometry.x(10000), 300);
  assert.equal(chartGeometry([], 300, 180), null);
});

test("overlaid readings share elapsed time and keep independent numeric scales", () => {
  const samples = (pairs: number[][]) =>
    pairs.map(([time, value]) => ({ date: new Date(time).toISOString(), value }));
  const chart = overlayChartGeometry(
    [
      {
        key: "gravity",
        samples: samples([
          [0, 1.1],
          [10000, 1]
        ])
      },
      {
        key: "temperature",
        samples: samples([
          [5000, 68],
          [10000, 72]
        ])
      }
    ],
    300,
    210
  )!;
  assert.equal(chart.from, 0);
  assert.equal(chart.to, 10000);
  assert.equal(chart.x(5000), 150);
  assert.match(chart.lines[1].polyline, /^150\.00,/);
  assert.ok(chart.lines[0].geometry.high < chart.lines[1].geometry.low);
  assert.deepEqual(chart.times, [0, 5000, 10000]);
  assert.equal(overlayChartGeometry([], 300, 210), null);
});
