import { calculateRecipeDerivedApiResponse } from "@meadtools/core/derived";
import type { RecipeDataV2 } from "@meadtools/schemas";
import { parseNumber } from "@meadtools/core/numeric";
import { nutrientReference } from "./catalog";
import {
  costLine,
  costPerLiter,
  matchesCostExclusion,
  summarizeCosts,
  type CostExclusion,
  type CostSummary,
  type StockCost,
} from "./costing";
import type { InventoryLine } from "./entry-lines";
import { normalizeQuantityUnit, quantitySchema, type Quantity } from "./quantity";
import type { CatalogReference } from "./schemas";
import { matchInventoryStock, type MatchStock } from "./stock-matching";

/** Saved recipe data (also the brew's recipe snapshot). */
export type RecipeCostInput = RecipeDataV2;

export type RecipeCostLine = Omit<InventoryLine, "quantity"> & {
  /** Null when the recipe amount or unit cannot be represented. */
  quantity: Quantity | null;
};

function quantityOf(value: number, unit: unknown): Quantity | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  try {
    return quantitySchema.parse({
      value: Math.round(value * 1_000_000) / 1_000_000,
      unit: normalizeQuantityUnit(unit),
    });
  } catch {
    return null;
  }
}

const goFermReference: Record<string, string> = {
  "Go-Ferm": "goFerm",
  protect: "goFermProtect",
  "sterol-flash": "goFermSterolFlash",
};
const nutrientNames = { fermO: "Fermaid O", fermK: "Fermaid K", dap: "DAP" } as const;

/**
 * Planned recipe amounts as inventory-shaped lines. Calculated amounts use the
 * same derivations as the recipe builder; empty or zero lines are omitted.
 */
export function recipeCostLines(recipe: RecipeCostInput): {
  lines: RecipeCostLine[];
  batchLiters: number | null;
} {
  const derived = calculateRecipeDerivedApiResponse(recipe).derived;
  const lines: RecipeCostLine[] = [];
  for (const ingredient of recipe.ingredients) {
    const amount = ingredient.amounts[ingredient.amounts.basis];
    const value = parseNumber(amount.value);
    if (!ingredient.name.trim() || !(value > 0)) continue;
    const reference: CatalogReference | null =
      ingredient.ref.kind === "catalog"
        ? { catalog: "ingredient", id: String(ingredient.ref.ingredientId) }
        : null;
    lines.push({
      key: `ingredient:${ingredient.lineId}`,
      name: ingredient.name,
      kind: "INGREDIENT",
      quantity: quantityOf(value, amount.unit),
      catalogReference: reference,
    });
  }
  for (const additive of recipe.additives) {
    const value = parseNumber(additive.amount);
    if (!additive.name.trim() || !(value > 0)) continue;
    lines.push({
      key: `additive:${additive.lineId}`,
      name: additive.name,
      kind: "OTHER",
      quantity: additive.amountDim === "unknown" ? null : quantityOf(value, additive.unit),
      catalogReference: null,
    });
  }
  const nutrients = recipe.nutrients;
  if (nutrients) {
    const yeastGrams = parseNumber(nutrients.inputs.yeastAmountG);
    const yeastName = [nutrients.selected.yeastBrand, nutrients.selected.yeastStrain]
      .filter(Boolean)
      .join(" ");
    if (yeastName && yeastGrams > 0)
      lines.push({
        key: "yeast",
        name: yeastName,
        kind: "YEAST",
        quantity: quantityOf(yeastGrams, "g"),
        catalogReference: nutrients.selected.yeastId
          ? { catalog: "yeast", id: String(nutrients.selected.yeastId) }
          : null,
      });
    const totals = derived.nutrients.nutrientAdditions.totalGrams;
    for (const key of ["fermO", "fermK", "dap", "other"] as const) {
      if (!nutrients.selected.selectedNutrients[key] || !(totals[key] > 0)) continue;
      const name = key === "other" ? nutrients.settings.other.name.trim() : nutrientNames[key];
      if (!name) continue;
      lines.push({
        key: `nutrient:${key}`,
        name,
        kind: "NUTRIENT",
        quantity: quantityOf(totals[key], "g"),
        catalogReference: key === "other" ? null : nutrientReference(key),
      });
    }
    const rehydration = goFermReference[nutrients.inputs.goFermType];
    if (rehydration && derived.nutrients.goFerm.amount > 0)
      lines.push({
        key: "nutrient:goFerm",
        name: nutrients.inputs.goFermType === "Go-Ferm" ? "Go-Ferm" :
          nutrients.inputs.goFermType === "protect" ? "Go-Ferm Protect" : "Go-Ferm Sterol Flash",
        kind: "NUTRIENT",
        quantity: quantityOf(derived.nutrients.goFerm.amount, "g"),
        catalogReference: nutrientReference(rehydration),
      });
  }
  if (recipe.stabilizers.adding) {
    const { sorbate, sulfite } = derived.stabilizers;
    if (sorbate > 0)
      lines.push({
        key: "stabilizer:sorbate",
        name: "Potassium sorbate",
        kind: "OTHER",
        quantity: quantityOf(sorbate, "g"),
        catalogReference: { catalog: "additive", id: "potassiumSorbate" },
      });
    if (sulfite > 0) {
      const sodium = recipe.stabilizers.type === "nameta";
      lines.push({
        key: "stabilizer:sulfite",
        name: sodium ? "Sodium metabisulfite" : "Potassium metabisulfite",
        kind: "OTHER",
        quantity: quantityOf(sulfite, "g"),
        catalogReference: {
          catalog: "additive",
          id: sodium ? "sodiumMetabisulfite" : "potassiumMetabisulfite",
        },
      });
    }
  }
  const liters = derived.volume.bottlingL > 0 ? derived.volume.bottlingL : derived.volume.totalL;
  return { lines, batchLiters: liters > 0 ? liters : null };
}

export type CostStock = MatchStock & { cost: StockCost };

/**
 * Estimate planned ingredient costs from current stock prices. Estimates
 * never deduct stock. Only confident matches are priced; ambiguous or weak
 * matches are reported so the owner can link or rename stock.
 */
export function estimateRecipeCost(
  recipe: RecipeCostInput,
  stock: readonly CostStock[],
  exclusions: readonly CostExclusion[] = [],
): CostSummary & { batchLiters: number | null; perLiter: number | null } {
  const { lines, batchLiters } = recipeCostLines(recipe);
  const costed = lines.map((line) => {
    const identity = {
      kind: line.kind,
      catalogReference: line.catalogReference ?? null,
      excluded: matchesCostExclusion(line, exclusions),
    };
    if (!line.quantity)
      return costLine({ key: line.key, name: line.name, quantity: null, stock: null, ...identity });
    const match = matchInventoryStock(stock, { ...line, quantity: line.quantity });
    const confident = match.stock && match.warning === null;
    const reason = match.warning === "ambiguous" || match.warning === "linked_ambiguous"
      ? ("ambiguous" as const)
      : ("unmatched" as const);
    return costLine({
      key: line.key,
      name: line.name,
      quantity: line.quantity,
      unmatchedReason: reason,
      ...identity,
      available: confident ? match.stock!.quantity : undefined,
      stock: confident
        ? {
            id: match.stock!.id,
            name: match.stock!.name,
            unit: match.stock!.quantity.unit,
            cost: match.stock!.cost,
          }
        : null,
    });
  });
  const summary = summarizeCosts("recipe_estimate", costed);
  const single = summary.totals.length === 1 ? summary.totals[0].amount : null;
  return {
    ...summary,
    batchLiters,
    perLiter: single === null ? null : costPerLiter(single, batchLiters),
  };
}
