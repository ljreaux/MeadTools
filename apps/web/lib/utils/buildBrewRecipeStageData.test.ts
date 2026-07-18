import assert from "node:assert/strict";
import test from "node:test";
import { recipeDataV2Schema } from "@meadtools/schemas/recipe";
import { calcABV } from "@meadtools/core/gravity";
import {
  backsweetenedMetricRecipeFixture,
  traditionalRecipeFixture
} from "@/lib/utils/__fixtures__/recipeDerivedFixtures";
import { buildBrewRecipeStageData } from "@/lib/utils/buildBrewRecipeStageData";
import type { RecipeData } from "@/types/recipeData";

test("renders an existing V2 snapshot that predates newly required nested fields", () => {
  const existingSnapshotData = structuredClone(traditionalRecipeFixture) as RecipeData;

  // Recipe snapshots created before IngredientRef was introduced do not have
  // this field. New API input should reject that shape, but brew history must
  // continue to render it.
  delete (existingSnapshotData.ingredients[0] as Partial<RecipeData["ingredients"][number]>).ref;

  assert.equal(recipeDataV2Schema.safeParse(existingSnapshotData).success, false);

  const stageData = buildBrewRecipeStageData({
    recipeSnapshot: {
      id: 1,
      name: "Existing traditional mead",
      version: 2,
      dataV2: existingSnapshotData,
      snapshottedAt: "2026-01-01T00:00:00.000Z"
    },
    currentVolumeLiters: null,
    latestGravity: null,
    entries: []
  });

  assert.equal(stageData.snapshot?.id, 1);
  assert.equal(stageData.planned.ingredients.length, 2);
  assert.equal(stageData.planned.ingredients[1]?.name, "Wildflower Honey");
  assert.ok(stageData.derived);
  assert.ok(stageData.derived.gravity.ogPrimary > 1);
});

test("uses a recorded post-secondary volume as the measured total for ABV", () => {
  const stageData = buildBrewRecipeStageData({
    recipeSnapshot: {
      id: 2,
      name: "Backsweetened mead",
      version: 2,
      dataV2: backsweetenedMetricRecipeFixture,
      snapshottedAt: "2026-01-01T00:00:00.000Z"
    },
    currentVolumeLiters: 5,
    latestGravity: 1.01,
    entries: [
      {
        id: "og",
        datetime: "2026-01-01T00:00:00.000Z",
        type: "GRAVITY",
        title: "Original gravity",
        note: null,
        gravity: 1.1,
        data: { readingRole: "OG", source: "measured" }
      },
      {
        id: "fg",
        datetime: "2026-01-02T00:00:00.000Z",
        type: "GRAVITY",
        title: "Final gravity",
        note: null,
        gravity: 1.01,
        data: { readingRole: "FG", source: "measured" }
      },
      {
        id: "primary-volume",
        datetime: "2026-01-03T00:00:00.000Z",
        type: "VOLUME",
        title: "Volume recorded",
        note: null,
        gravity: null,
        data: { liters: 4 }
      },
      {
        id: "cherry",
        datetime: "2026-01-04T00:00:00.000Z",
        type: "ADDITION",
        title: "Cherry Juice",
        note: null,
        gravity: null,
        data: {
          kind: "INGREDIENT",
          source: "recipe_ingredient",
          name: "Cherry Juice",
          amount: 0.75,
          unit: "L",
          recipeIngredientId: "metric-cherry",
          meta: { stage: "SECONDARY" }
        }
      },
      {
        id: "measured-secondary-volume",
        datetime: "2026-01-05T00:00:00.000Z",
        type: "VOLUME",
        title: "Volume recorded",
        note: null,
        gravity: null,
        data: { liters: 5 }
      }
    ]
  });

  const expectedAbv = (calcABV(1.1, 1.01) * 4) / 5;
  assert.ok(stageData.actual.currentAbv != null);
  assert.ok(Math.abs(stageData.actual.currentAbv - expectedAbv) < 0.000001);
});
