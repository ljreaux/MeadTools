import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalIngredientSearchTerms,
  ingredientSearchTerms
} from "./ingredient-search";

test("ingredient chat lookup includes common singular forms", () => {
  assert.deepEqual(ingredientSearchTerms("raspberries"), ["raspberries", "raspberry"]);
  assert.deepEqual(ingredientSearchTerms("peaches"), ["peaches", "peach"]);
  assert.deepEqual(ingredientSearchTerms("blackberries"), ["blackberries", "blackberry"]);
  assert.deepEqual(ingredientSearchTerms("Himbeeren"), ["Himbeeren", "Himbeere"]);
  assert.deepEqual(ingredientSearchTerms("fresh apple cider"), ["fresh apple cider", "fresh", "apple", "cider"]);
  assert.deepEqual(ingredientSearchTerms("honey"), ["honey"]);
});

test("ingredient chat lookup resolves localized catalog names to canonical terms", () => {
  const english = { raspberry: "Raspberry", blueberry: "Blueberry" };
  const german = { raspberry: "Himbeere", blueberry: "Blaubeere" };

  assert.deepEqual(
    canonicalIngredientSearchTerms("Himbeeren", english, [german]),
    ["Raspberry"]
  );
  assert.deepEqual(
    canonicalIngredientSearchTerms("Blaubeeren", english, [german]),
    ["Blueberry"]
  );
});
