import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/recipes/derived/route";
import calculateRecipeDerivedApiResponse from "@/lib/utils/calculateRecipeDerivedApiResponse";
import {
  calculateRecipeStabilizerResults
} from "@/lib/utils/calculateRecipeDerivedState";
import {
  backsweetenedMetricDerivedGolden,
  backsweetenedMetricRecipeFixture,
  emptyDerivedGolden,
  emptyRecipeFixture,
  traditionalDerivedGolden,
  traditionalRecipeFixture
} from "@/lib/utils/__fixtures__/recipeDerivedFixtures";

test("traditional recipe derived state matches the golden fixture", () => {
  const result = calculateRecipeDerivedApiResponse(traditionalRecipeFixture);

  assert.deepEqual(result.recipeData, traditionalRecipeFixture);
  assert.deepEqual(result.derived, traditionalDerivedGolden);
});

test("backsweetened metric recipe derived state matches the golden fixture", () => {
  const result = calculateRecipeDerivedApiResponse(
    backsweetenedMetricRecipeFixture
  );

  assert.deepEqual(result.recipeData, backsweetenedMetricRecipeFixture);
  assert.deepEqual(result.derived, backsweetenedMetricDerivedGolden);
});

test("empty recipe behavior remains explicit during extraction", () => {
  const result = calculateRecipeDerivedApiResponse(emptyRecipeFixture);

  assert.deepEqual(result.derived, emptyDerivedGolden);
});

test("stabilizer pH is rounded to one decimal before lookup", () => {
  const base = {
    addingStabilizers: true,
    stabilizerType: "kmeta" as const,
    totalVolumeL: 3.78541,
    abv: 12
  };

  const roundedDown = calculateRecipeStabilizerResults({
    ...base,
    phReading: "3.44"
  });
  const roundedUp = calculateRecipeStabilizerResults({
    ...base,
    phReading: "3.45"
  });

  assert.equal(roundedDown.sulfite, (3.78541 * 32) / 570);
  assert.equal(roundedUp.sulfite, (3.78541 * 39) / 570);
});

test("derived recipe POST serializes the same golden result", async () => {
  const request = new NextRequest("http://localhost/api/recipes/derived", {
    method: "POST",
    body: JSON.stringify(traditionalRecipeFixture),
    headers: {
      "content-type": "application/json"
    }
  });

  const response = await POST(request);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    recipeData: traditionalRecipeFixture,
    derived: traditionalDerivedGolden
  });
});

test("derived recipe POST rejects malformed recipe data", async () => {
  const request = new NextRequest("http://localhost/api/recipes/derived", {
    method: "POST",
    body: JSON.stringify({ version: 2 }),
    headers: {
      "content-type": "application/json"
    }
  });

  const response = await POST(request);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid recipe data payload."
  });
});
