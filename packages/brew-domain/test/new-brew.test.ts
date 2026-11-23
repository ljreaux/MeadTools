import assert from "node:assert/strict";
import test from "node:test";

import { newBrewName, searchNewBrewRecipes } from "../src/new-brew";

const recipes = [
  { id: 1, name: "Traditional Wildflower" },
  { id: 2, name: "Key Lime Pie" },
  { id: 3, name: "Blueberry Ancho" }
];

test("recipe search keeps the order when blank and matches names fuzzily", () => {
  assert.deepEqual(searchNewBrewRecipes(recipes, "  ").map((r) => r.id), [1, 2, 3]);
  assert.deepEqual(searchNewBrewRecipes(recipes, "key lime").map((r) => r.id), [2]);
  assert.deepEqual(searchNewBrewRecipes(recipes, "bluebery").map((r) => r.id), [3]);
  assert.deepEqual(searchNewBrewRecipes(recipes, "zzzz"), []);
});

test("a blank brew name falls back to the recipe name", () => {
  assert.equal(newBrewName("  January batch ", "Key Lime Pie"), "January batch");
  assert.equal(newBrewName("   ", "Key Lime Pie"), "Key Lime Pie");
});
