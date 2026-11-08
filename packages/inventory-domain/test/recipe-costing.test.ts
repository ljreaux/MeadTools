import assert from "node:assert/strict";
import test from "node:test";
import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import { recipeDataV2Schema, type RecipeDataV2 } from "@meadtools/schemas";
import { estimateRecipeCost, recipeCostLines, type CostStock } from "../src/recipe-costing";

const recipe: RecipeDataV2 = recipeDataV2Schema.parse({
  version: 2,
  unitDefaults: { weight: "kg", volume: "L" },
  ingredients: [
    { lineId: "honey", name: "Clover honey", ref: { kind: "catalog", ingredientId: 1 }, category: "sugar",
      brix: "79.6", secondary: false,
      amounts: { weight: { value: "1.5", unit: "kg" }, volume: { value: "1.06", unit: "L" }, basis: "weight" } },
    { lineId: "water", name: "Water", ref: { kind: "custom" }, category: "water", brix: "0", secondary: false,
      amounts: { weight: { value: "4", unit: "kg" }, volume: { value: "4", unit: "L" }, basis: "volume" } },
    { lineId: "empty", name: "", ref: { kind: "custom" }, category: "sugar", brix: "0", secondary: false,
      amounts: { weight: { value: "0", unit: "kg" }, volume: { value: "0", unit: "L" }, basis: "weight" } },
  ],
  fg: "1.000",
  additives: [
    { lineId: "oak", name: "Oak cubes", amount: "10", unit: "g", amountTouched: true, amountDim: "weight" },
    { lineId: "pinch", name: "Cinnamon", amount: "1", unit: "pinch", amountTouched: true, amountDim: "unknown" },
  ],
  stabilizers: { adding: false, takingPh: false, phReading: "3.6", type: "kmeta" },
  notes: { primary: [], secondary: [] },
  nutrients: {
    version: 2,
    inputs: { volume: "5", volumeUnits: "liter", sg: "1.100", offsetPpm: "0", numberOfAdditions: "4",
      goFermType: "none", yeastAmountG: "5", yeastAmountTouched: true },
    selected: { yeastBrand: "Lalvin", yeastStrain: "D-47", yeastId: 7, nitrogenRequirement: "Low", schedule: "tosna",
      selectedNutrients: { fermO: true, fermK: false, dap: false, other: false } },
    settings: { yanContribution: { fermO: "40", fermK: "100", dap: "210", other: "0" },
      maxGpl: { fermO: "2.5", fermK: "0", dap: "0", other: "0" }, maxGplTouched: false,
      other: { name: "", usesOrganicMultiplier: false } },
    adjustments: { adjustAllowed: false, providedYanPpm: { fermO: "40", fermK: "0", dap: "0", other: "0" } },
  },
});

const item = (id: string, name: string, category: string, value: number, unit: CostStock["quantity"]["unit"],
  unitCost: number | null, catalogReference: CostStock["catalogReference"] = null): CostStock => ({
  id, name, category, quantity: { value, unit }, reconciliation_required: false, catalogReference,
  cost: { unitCost, currency: unitCost === null ? null : "USD" },
});

test("recipe lines use each ingredient's basis and calculated nutrient/yeast amounts", () => {
  const { lines, batchLiters } = recipeCostLines(recipe);
  // The same derivation the recipe builder shows, not a separate formula.
  const fermO = calculateRecipeDerivedApiResponse(recipe).derived.nutrients.nutrientAdditions.totalGrams.fermO;
  assert.deepEqual(lines.map((line) => [line.key, line.quantity]), [
    ["ingredient:honey", { value: 1.5, unit: "kg" }],
    ["ingredient:water", { value: 4, unit: "L" }],
    ["additive:oak", { value: 10, unit: "g" }],
    ["additive:pinch", null],
    ["yeast", { value: 5, unit: "g" }],
    ["nutrient:fermO", { value: Math.round(fermO * 1e6) / 1e6, unit: "g" }],
  ]);
  assert.ok(fermO > 0);
  assert.deepEqual(lines[0].catalogReference, { catalog: "ingredient", id: "1" });
  assert.deepEqual(lines[4].catalogReference, { catalog: "yeast", id: "7" });
  assert.ok(batchLiters && batchLiters > 0);
});

test("estimates price confident matches and label everything else without deducting stock", () => {
  const stock = [
    item("honey", "Wildflower", "honey", 10, "kg", 6, { catalog: "ingredient", id: "1" }),
    item("oak", "Oak cubes", "additive", 100, "g", 0.05),
    item("yeast", "D-47", "yeast", 3, "units", 1.5, { catalog: "yeast", id: "7" }),
    item("fermo", "Fermaid O", "additive", 500, "g", null, { catalog: "nutrient", id: "fermO" }),
  ];
  const before = JSON.stringify(stock);
  const estimate = estimateRecipeCost(recipe, stock);
  assert.equal(JSON.stringify(stock), before);
  assert.equal(estimate.basis, "recipe_estimate");
  assert.deepEqual(Object.fromEntries(estimate.lines.map((line) => [line.key, [line.status, line.cost]])), {
    "ingredient:honey": ["priced", 9],
    "ingredient:water": ["unmatched", null],
    "additive:oak": ["priced", 0.5],
    "additive:pinch": ["incompatible", null],
    // A packet stock cannot price a gram amount without a known packet size.
    yeast: ["unmatched", null],
    "nutrient:fermO": ["unpriced", null],
  });
  assert.equal(estimate.complete, false);
  assert.deepEqual(estimate.totals, [{ currency: "USD", amount: 9.5 }]);
  assert.equal(estimate.shortLines, 0);
  assert.ok(estimate.perLiter && estimate.perLiter > 0);
});

test("estimates flag planned amounts beyond stock on hand without changing the cost", () => {
  const estimate = estimateRecipeCost(recipe, [
    item("honey", "Wildflower", "honey", 1000, "g", 0.006, { catalog: "ingredient", id: "1" }),
  ]);
  const honey = estimate.lines.find((line) => line.key === "ingredient:honey")!;
  assert.deepEqual(honey.shortage, { value: 500, unit: "g" });
  assert.equal(honey.cost, 9);
  assert.equal(estimate.shortLines, 1);
});

test("estimates mark excluded ingredients and stay complete when the rest is priced", () => {
  const stock = [
    item("honey", "Wildflower", "honey", 10, "kg", 6, { catalog: "ingredient", id: "1" }),
    item("oak", "Oak cubes", "additive", 100, "g", 0.05),
    item("yeast", "D-47", "yeast", 50, "g", 0.2, { catalog: "yeast", id: "7" }),
    item("fermo", "Fermaid O", "additive", 500, "g", 0.08, { catalog: "nutrient", id: "fermO" }),
  ];
  const estimate = estimateRecipeCost(recipe, stock, [
    { name: "Water", catalogReference: null },
    { name: "Cinnamon", catalogReference: null },
  ]);
  const status = Object.fromEntries(estimate.lines.map((line) => [line.key, line.status]));
  assert.equal(status["ingredient:water"], "excluded");
  assert.equal(status["additive:pinch"], "excluded");
  assert.equal(estimate.excludedLines, 2);
  assert.equal(estimate.complete, true);
});

test("ingredient exclusions never spread through a shared stock item's name", () => {
  const stock = [item("oak", "French oak cubes", "additive", 100, "g", 0.05)];
  const line = (exclusions: { name: string; catalogReference: null }[]) =>
    estimateRecipeCost({ ...recipe, additives: recipe.additives.map((row) => ({ ...row, name: row.name === "Oak cubes" ? "French oak" : row.name })) }, stock, exclusions)
      .lines.find((row) => row.key === "additive:oak")!;
  assert.equal(line([{ name: "French oak cubes", catalogReference: null }]).status, "priced");
  assert.equal(line([{ name: "French oak", catalogReference: null }]).status, "excluded");
});

test("ambiguous name matches are reported instead of guessed", () => {
  const estimate = estimateRecipeCost(recipe, [
    item("a", "Oak cubes", "additive", 100, "g", 0.05),
    item("b", "Oak cubes", "additive", 100, "g", 0.08),
  ]);
  assert.equal(estimate.lines.find((line) => line.key === "additive:oak")!.status, "ambiguous");
});
