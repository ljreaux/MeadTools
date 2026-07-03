import assert from "node:assert/strict";
import test from "node:test";
import { recipeDataV2Schema } from "@meadtools/schemas/recipe";
import { traditionalRecipeFixture } from "@/lib/utils/__fixtures__/recipeDerivedFixtures";
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
