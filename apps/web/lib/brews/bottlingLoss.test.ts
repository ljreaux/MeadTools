import assert from "node:assert/strict";
import test from "node:test";
import {
  getBottlingVolumePrefill,
  hasCurrentPostAdditionMeasurement
} from "./bottlingLoss";

const secondaryTimeline = [
  {
    type: "VOLUME",
    datetime: "2026-01-01T00:00:00.000Z",
    data: { liters: 3 }
  },
  {
    type: "ADDITION",
    datetime: "2026-01-02T00:00:00.000Z",
    data: {
      kind: "INGREDIENT",
      recipeIngredientId: "fruit",
      meta: { stage: "SECONDARY" }
    }
  },
  {
    type: "VOLUME",
    datetime: "2026-01-03T00:00:00.000Z",
    data: { liters: 4 }
  }
];

test("only the current post-addition reading is eligible for a secondary loss prefill", () => {
  const args = {
    entries: secondaryTimeline,
    secondaryIngredientIds: ["fruit"],
    loggedIngredientIds: ["fruit"]
  };
  assert.equal(hasCurrentPostAdditionMeasurement({ ...args, currentVolumeL: 4 }), true);
  assert.equal(hasCurrentPostAdditionMeasurement({ ...args, currentVolumeL: 3 }), false);
  assert.equal(hasCurrentPostAdditionMeasurement({
    ...args,
    entries: secondaryTimeline.slice(0, 2),
    currentVolumeL: 3
  }), false);
  assert.equal(hasCurrentPostAdditionMeasurement({
    ...args,
    loggedIngredientIds: [],
    currentVolumeL: 4
  }), false);
});

test("secondary loss adjusts a post-addition measurement once", () => {
  assert.deepEqual(getBottlingVolumePrefill({
    currentVolumeL: 4,
    effectiveVolumeL: 4,
    recipeBottlingVolumeL: 3.8,
    secondaryLossPercentage: 20,
    hasPostAdditionMeasurement: true
  }), { volumeL: 3.2, source: "adjusted_measurement" });
});

test("a measurement before secondary additions stays unadjusted", () => {
  assert.deepEqual(getBottlingVolumePrefill({
    currentVolumeL: 3,
    effectiveVolumeL: 3,
    recipeBottlingVolumeL: 3.8,
    secondaryLossPercentage: 20,
    hasPostAdditionMeasurement: false
  }), { volumeL: 3, source: "measurement" });
});

test("existing brews without secondary loss keep their measured volume", () => {
  assert.deepEqual(getBottlingVolumePrefill({
    currentVolumeL: 4,
    effectiveVolumeL: 4.75,
    recipeBottlingVolumeL: null,
    secondaryLossPercentage: null,
    hasPostAdditionMeasurement: true
  }), { volumeL: 4, source: "measurement" });
});

test("recipe estimate fills in when no measurement exists", () => {
  assert.deepEqual(getBottlingVolumePrefill({
    currentVolumeL: null,
    effectiveVolumeL: 4.75,
    recipeBottlingVolumeL: 3.8,
    secondaryLossPercentage: 20,
    hasPostAdditionMeasurement: false
  }), { volumeL: 3.8, source: "recipe_estimate" });
});

test("invalid loss never reduces a measured volume", () => {
  assert.deepEqual(getBottlingVolumePrefill({
    currentVolumeL: 4,
    effectiveVolumeL: 4,
    recipeBottlingVolumeL: 3.8,
    secondaryLossPercentage: 100,
    hasPostAdditionMeasurement: true
  }), { volumeL: 4, source: "measurement" });
});
