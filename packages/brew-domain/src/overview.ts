import {
  ingredientLineResponseSchema,
  recipeDataV2Schema
} from "@meadtools/api-contract";
import { calculateRecipeDerivedState } from "@meadtools/core/derived";

import type { BrewViewDetail } from "./projection";

type OverviewBrew = Pick<
  BrewViewDetail<unknown>,
  "recipe_snapshot" | "recipe_name" | "current_volume_liters" | "latest_gravity"
>;

export type BrewOverview = {
  recipeName: string | null;
  ingredients: Array<{
    id: string;
    name: string;
    amount: string;
    unit: string;
    secondary: boolean;
  }>;
  currentVolumeLiters: number | null;
  targetVolumeLiters: number | null;
  targetOg: number | null;
  targetFg: number | null;
  latestGravity: number | null;
};

function positiveFinite(value: number): number | null {
  return Number.isFinite(value) && value > 0 ? value : null;
}

function snapshotIngredients(data: unknown): BrewOverview["ingredients"] {
  if (!data || typeof data !== "object" || !("ingredients" in data)) return [];
  if (!Array.isArray(data.ingredients)) return [];

  return data.ingredients.flatMap((value) => {
    const parsed = ingredientLineResponseSchema.safeParse(value);
    if (!parsed.success) return [];
    const ingredient = parsed.data;
    const amount = ingredient.amounts[ingredient.amounts.basis];

    return [{
      id: ingredient.lineId,
      name: ingredient.name,
      amount: amount.value,
      unit: amount.unit,
      secondary: ingredient.secondary
    }];
  });
}

/** Keep recipe calculations and legacy snapshot handling outside app UIs. */
export function projectBrewOverview(brew: OverviewBrew): BrewOverview {
  const snapshot =
    brew.recipe_snapshot && typeof brew.recipe_snapshot === "object"
      ? (brew.recipe_snapshot as Record<string, unknown>)
      : null;
  const recipeName =
    typeof snapshot?.name === "string" && snapshot.name.trim()
      ? snapshot.name.trim()
      : brew.recipe_name;
  const parsedRecipe = recipeDataV2Schema.safeParse(snapshot?.dataV2);
  const ingredients = snapshotIngredients(snapshot?.dataV2);

  if (!parsedRecipe.success) {
    return {
      recipeName,
      ingredients,
      currentVolumeLiters: brew.current_volume_liters,
      targetVolumeLiters: null,
      targetOg: null,
      targetFg: null,
      latestGravity: brew.latest_gravity
    };
  }

  const recipe = parsedRecipe.data;
  const derived = calculateRecipeDerivedState(recipe);
  const targetFg = Number(recipe.fg);

  return {
    recipeName,
    ingredients,
    currentVolumeLiters: brew.current_volume_liters,
    targetVolumeLiters: positiveFinite(derived.totalVolumeL),
    targetOg: derived.ogPrimary > 1 ? positiveFinite(derived.ogPrimary) : null,
    targetFg: positiveFinite(targetFg),
    latestGravity: brew.latest_gravity
  };
}
