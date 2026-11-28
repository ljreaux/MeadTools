import assert from "node:assert/strict";
import test from "node:test";

import type { RecipeDerivedState } from "@meadtools/core/derived";
import type { RecipeDataV2 } from "@meadtools/schemas";

import { queryRecipeList, summarizeDerivedRecipe, summarizeRecipe } from "../src/recipes/recipe-summary";

function derived(overrides: Partial<RecipeDerivedState>): RecipeDerivedState {
  return {
    primaryVolumeL: 20,
    ogPrimary: 1.1,
    abv: 13.5,
    bottlingVolume: 5,
    backsweetenedFg: 1.012,
    volumeUnit: "gal",
    ...overrides
  } as RecipeDerivedState;
}

const data = (fg: string) => ({ fg }) as RecipeDataV2;

test("summarizes a complete recipe", () => {
  assert.deepEqual(summarizeDerivedRecipe(data("0.998"), derived({})), {
    og: 1.1,
    fg: 0.998,
    finishedGravity: 1.012,
    abv: 13.5,
    bottlingVolume: 5,
    volumeUnit: "gal"
  });
});

test("leaves estimates out until the recipe has the data for them", () => {
  const noVolume = summarizeDerivedRecipe(data("0.998"), derived({ primaryVolumeL: 0, bottlingVolume: 0 }));
  assert.equal(noVolume.og, null);
  assert.equal(noVolume.abv, null);
  assert.equal(noVolume.finishedGravity, null);
  assert.equal(noVolume.bottlingVolume, null);
  assert.equal(noVolume.fg, 0.998);

  const noFg = summarizeDerivedRecipe(data(""), derived({}));
  assert.equal(noFg.fg, null);
  assert.equal(noFg.abv, null);
  assert.equal(noFg.finishedGravity, null);
  assert.equal(noFg.og, 1.1);
});

test("a missing recipe has no summary", () => {
  assert.equal(summarizeRecipe(null), null);
  assert.equal(summarizeRecipe(undefined), null);
});

const recipes = [
  { id: 3, name: "Key Lime Pie" },
  { id: 10, name: "blueberry ancho" },
  { id: 7, name: "  " },
  { id: 12, name: "Recipe 2" },
  { id: 11, name: "Recipe 10" }
];
const options = { search: "", locale: "en", fallbackName: "Untitled" };

test("lists the newest recipes first by default", () => {
  assert.deepEqual(
    queryRecipeList(recipes, { ...options, sort: "newest" }).map(({ id }) => id),
    [12, 11, 10, 7, 3]
  );
});

test("sorts by name ignoring case, with numbers in natural order", () => {
  assert.deepEqual(
    queryRecipeList(recipes, { ...options, sort: "name" }).map(({ id }) => id),
    [10, 3, 12, 11, 7]
  );
});

test("searches names, including the fallback name for unnamed recipes", () => {
  assert.deepEqual(
    queryRecipeList(recipes, { ...options, search: " RECIPE ", sort: "newest" }).map(({ id }) => id),
    [12, 11]
  );
  assert.deepEqual(
    queryRecipeList(recipes, { ...options, search: "untitled", sort: "newest" }).map(({ id }) => id),
    [7]
  );
});

test("does not reorder the caller's array", () => {
  const input = [...recipes];
  queryRecipeList(input, { ...options, sort: "name" });
  assert.deepEqual(input, recipes);
});
