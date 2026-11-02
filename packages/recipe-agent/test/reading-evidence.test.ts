import assert from "node:assert/strict";
import test from "node:test";
import { summarizeManualGravityChange } from "../src/index";

const reading = (gravity: number | null, datetime: string, provenance = "measured", type = "GRAVITY") =>
  ({ gravity, datetime, provenance, type });
const first = "2026-10-07T00:00:00Z", last = "2026-10-09T00:00:00Z";

test("gravity direction is chronological across offset-aware dates and does not mutate inputs", () => {
  const entries = [reading(1.055, "2026-10-08T19:00:00-05:00"), reading(1.1, first)];
  const before = structuredClone(entries);
  const result = summarizeManualGravityChange(entries);
  assert.equal(result.direction, "decreased");
  assert.equal(result.first?.gravitySg, 1.1);
  assert.equal(result.last?.gravitySg, 1.055);
  assert.deepEqual(entries, before);
});

test("increasing and unchanged measured values remain observations rather than stability verdicts", () => {
  for (const [end, direction] of [[1.01, "increased"], [1, "unchanged"]] as const) {
    const result = summarizeManualGravityChange([reading(1, first), reading(end, last)]);
    assert.equal(result.direction, direction);
    assert.equal(result.stabilityAssessment, "not_assessed");
    assert.equal(result.coverage, "returned_manual_page");
  }
});

test("single, missing and simultaneous readings do not establish a temporal gravity change", () => {
  for (const entries of [[], [reading(1.1, first)], [reading(1.1, first), reading(1.055, first)]]) {
    const result = summarizeManualGravityChange(entries);
    assert.equal(result.direction, null);
    assert.equal(result.netChangeSg, null);
    assert.equal(result.stabilityAssessment, "not_assessed");
  }
});

test("recipe targets, unknown provenance, non-gravity and non-finite data do not become measurements", () => {
  const result = summarizeManualGravityChange([
    reading(1.1, first), reading(0.99, last, "recipe_target"), reading(1, last, "unknown"),
    reading(0.98, last, "derived_estimate"), reading(NaN, last), reading(Infinity, last),
    reading(null, last), reading(1, "invalid"), reading(0.97, last, "measured", "NOTE"),
  ]);
  assert.equal(result.measurementCount, 1);
  assert.equal(result.direction, null);
});

test("a recorded numeric zero is preserved", () => {
  const result = summarizeManualGravityChange([reading(0, first), reading(0, last)]);
  assert.equal(result.measurementCount, 2);
  assert.equal(result.first?.gravitySg, 0);
  assert.equal(result.netChangeSg, 0);
  assert.equal(result.direction, "unchanged");
});


test("a dated gravity decrease does not assess activity at its endpoint or now", () => {
  const result = summarizeManualGravityChange([reading(1.1, first), reading(1.055, last)]);
  assert.equal(result.direction, "decreased");
  assert.equal(result.activityAssessment, "not_assessed");
});
