import assert from "node:assert/strict";
import test from "node:test";

import {
  getMeasuredSecondaryVolumeState,
  needsSupplementalStabilizers
} from "@/lib/brews/stabilizerVolume";

test("a measured secondary volume remains the baseline after supplemental stabilizers", () => {
  const timeline = [
    {
      id: "primary-volume",
      datetime: "2026-01-01T00:00:00.000Z",
      type: "VOLUME",
      data: { liters: 12 }
    },
    {
      id: "secondary-addition",
      datetime: "2026-01-02T00:00:00.000Z",
      type: "ADDITION",
      data: {
        kind: "INGREDIENT",
        recipeIngredientId: "secondary-juice",
        meta: { stage: "SECONDARY" }
      }
    },
    {
      id: "measured-volume",
      datetime: "2026-01-03T00:00:00.000Z",
      type: "VOLUME",
      data: { liters: 16 }
    }
  ];

  const measuredVolume = getMeasuredSecondaryVolumeState({
    entries: timeline,
    secondaryIngredientIds: ["secondary-juice"],
    allSecondaryIngredientsLogged: true
  });

  assert.deepEqual(measuredVolume, {
    hasMeasuredVolume: true,
    baseVolumeL: 12
  });

  assert.equal(
    needsSupplementalStabilizers({
      currentSecondaryVolumeL: 4,
      currentAdjustedVolumeL: 16,
      latestSecondaryVolumeL: 4,
      latestAdjustedVolumeL: 15,
      thresholdL: 0.04
    }),
    true
  );
  assert.equal(
    needsSupplementalStabilizers({
      currentSecondaryVolumeL: 4,
      currentAdjustedVolumeL: 16,
      latestSecondaryVolumeL: 4,
      latestAdjustedVolumeL: 16,
      thresholdL: 0.04
    }),
    false
  );
  assert.equal(
    needsSupplementalStabilizers({
      currentSecondaryVolumeL: 4,
      currentAdjustedVolumeL: 17,
      latestSecondaryVolumeL: 4,
      latestAdjustedVolumeL: 16,
      thresholdL: 0.04
    }),
    true
  );
});
