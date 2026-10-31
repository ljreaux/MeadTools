import "server-only";

import type {
  AdditiveLookup,
  IngredientLookup,
  YeastLookup,
} from "@meadtools/recipe-agent";
import { getIngredientCatalogForChat } from "@/lib/db/ingredients";
import { getAdditiveCatalogForChat } from "@/lib/db/additives";
import { searchYeastsForChat } from "@/lib/db/yeasts";

function numberOrUndefined(
  value: string | number | null | { toString(): string },
): number | undefined {
  const parsed = Number(
    typeof value === "object" && value !== null ? value.toString() : value,
  );
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Shared database adapters for hosted chat and remote MCP tool execution. */
export const agentCatalogLookups: {
  ingredientLookup: IngredientLookup;
  additiveLookup: AdditiveLookup;
  yeastLookup: YeastLookup;
} = {
  ingredientLookup: async () => {
    const ingredients = await getIngredientCatalogForChat();
    return ingredients.flatMap((ingredient) => {
      const brix = Number(ingredient.sugar_content);
      if (!Number.isFinite(brix) || brix < 0 || brix > 100) return [];
      return [{
        id: ingredient.id,
        name: ingredient.name,
        category: ingredient.category,
        brix,
      }];
    });
  },
  additiveLookup: async () => {
    const additives = await getAdditiveCatalogForChat();
    return additives.flatMap((additive) => {
      if (!Number.isFinite(additive.dosage) || additive.dosage <= 0) return [];
      return [{
        id: additive.id,
        name: additive.name,
        dosagePerGallon: additive.dosage,
        unit: additive.unit,
      }];
    });
  },
  yeastLookup: async (query: string, limit: number) => {
    const yeasts = await searchYeastsForChat(query);
    return yeasts.slice(0, limit).flatMap((yeast) => {
      const nitrogenRequirement = yeast.nitrogen_requirement;
      if (
        nitrogenRequirement !== "Very Low" &&
        nitrogenRequirement !== "Low" &&
        nitrogenRequirement !== "Medium" &&
        nitrogenRequirement !== "High" &&
        nitrogenRequirement !== "Very High"
      ) return [];
      return [{
        id: yeast.id,
        brand: yeast.brand,
        name: yeast.name,
        nitrogenRequirement,
        tolerance: numberOrUndefined(yeast.tolerance),
        lowTemperature: numberOrUndefined(yeast.low_temp),
        highTemperature: numberOrUndefined(yeast.high_temp),
      }];
    });
  },
};
