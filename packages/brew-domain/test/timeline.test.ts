import assert from "node:assert/strict";
import test from "node:test";

import type { BrewViewEntry } from "../src/projection";
import { projectBrewTimeline } from "../src/timeline";

function entry(id: string, type: BrewViewEntry["type"], data: BrewViewEntry["data"] = null): BrewViewEntry {
  return {
    id,
    datetime: "2026-10-01T12:00:00.000Z",
    type,
    title: null,
    note: null,
    gravity: null,
    temperature: null,
    temp_units: null,
    data
  };
}

test("timeline sorts newest first, keeps stage context, and omits internal readings", () => {
  const first = { ...entry("first", "NOTE"), datetime: "2026-09-30T12:00:00.000Z" };
  const second = { ...entry("second", "GRAVITY"), gravity: 1.042 };
  const hidden = entry("hidden", "GRAVITY", { hidden: true });
  const nutrientBasis = entry("basis", "GRAVITY", { source: "nutrient_basis" });
  const abvEstimate = entry("abv", "GRAVITY", { source: "abv_estimate" });
  const timeline = projectBrewTimeline({
    entries: [first, hidden, second, nutrientBasis, abvEstimate],
    entries_by_stage: [{ stage: "PRIMARY", entries: [first, second] }]
  });

  assert.deepEqual(timeline.map((item) => item.id), ["second", "first"]);
  assert.equal(timeline[0]?.stage, "PRIMARY");
  assert.deepEqual(timeline[0]?.detail, { kind: "gravity", value: 1.042, role: "GENERAL" });
});

test("timeline projects measurements, additions, stage changes, and partial legacy entries", () => {
  const timeline = projectBrewTimeline({
    entries: [
      { ...entry("og", "GRAVITY", { readingRole: "OG" }), gravity: 1.1 },
      { ...entry("temp", "TEMPERATURE"), temperature: 20.4, temp_units: "C" },
      entry("ph", "PH", { ph: 3.42 }),
      entry("volume", "VOLUME", { liters: 3.8, displayValue: 1, displayUnit: "gal" }),
      entry("packaging", "PACKAGING", {
        packagedVolumeLiters: 3.8,
        bottleRows: [{ quantity: 2 }, { quantity: 3 }]
      }),
      entry("addition", "ADDITION", { name: "Honey", amount: 2.5, unit: "lb" }),
      entry("stage", "STAGE_CHANGE", { from: "PRIMARY", to: "SECONDARY" }),
      entry("legacy", "VOLUME", { liters: "bad" }),
      { ...entry("invalid-date", "NOTE"), datetime: "bad" }
    ],
    entries_by_stage: []
  });

  const details = new Map(timeline.map((item) => [item.id, item.detail]));
  assert.deepEqual(details.get("og"), { kind: "gravity", value: 1.1, role: "OG" });
  assert.deepEqual(details.get("temp"), { kind: "temperature", value: 20.4, unit: "C" });
  assert.deepEqual(details.get("ph"), { kind: "ph", value: 3.42 });
  assert.deepEqual(details.get("volume"), { kind: "volume", value: 1, unit: "gal", packages: null });
  assert.deepEqual(details.get("packaging"), { kind: "volume", value: 3.8, unit: "L", packages: 5 });
  assert.deepEqual(details.get("addition"), { kind: "addition", name: "Honey", amount: 2.5, unit: "lb" });
  assert.deepEqual(details.get("stage"), { kind: "stage", from: "PRIMARY", to: "SECONDARY" });
  assert.equal(details.get("legacy"), null);
  assert.equal(timeline.at(-1)?.id, "invalid-date");
});
