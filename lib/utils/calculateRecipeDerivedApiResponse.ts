import { RecipeData, RecipeUnitDefaults } from "@/types/recipeData";
import calculateNutrientDerivedState, {
  calculateEffectiveNutrientData,
  NutrientDerivedState
} from "@/lib/utils/calculateNutrientDerivedState";
import calculateRecipeDerivedState, {
  calculateRecipeStabilizerResults,
  RecipeStabilizerResults
} from "@/lib/utils/calculateRecipeDerivedState";

export type RecipeDerivedApiResponse = {
  recipeData: RecipeData;
  derived: {
    gravity: {
      ogPrimary: number;
      backsweetenedFg: number;
      totalForAbv: number;
    };
    volume: {
      unit: RecipeUnitDefaults["volume"];
      primary: number;
      secondary: number;
      total: number;
      primaryL: number;
      secondaryL: number;
      totalL: number;
    };
    alcohol: {
      abv: number;
      delle: number;
    };
    stabilizers: RecipeStabilizerResults;
    nutrients: NutrientDerivedState;
  };
};

export default function calculateRecipeDerivedApiResponse(
  recipeData: RecipeData
): RecipeDerivedApiResponse {
  const derived = calculateRecipeDerivedState(recipeData);
  const effectiveNutrientData = calculateEffectiveNutrientData(
    derived.nutrientValueForRecipe
  );
  const nutrientDerived = calculateNutrientDerivedState(effectiveNutrientData);
  const stabilizers = calculateRecipeStabilizerResults({
    addingStabilizers: recipeData.stabilizers.adding,
    phReading: recipeData.stabilizers.phReading,
    stabilizerType: recipeData.stabilizers.type,
    totalVolumeL: derived.totalVolumeL,
    abv: derived.abv
  });

  return {
    recipeData,
    derived: {
      gravity: {
        ogPrimary: derived.ogPrimary,
        backsweetenedFg: derived.backsweetenedFg,
        totalForAbv: derived.totalForAbv
      },
      volume: {
        unit: derived.volumeUnit,
        primary: derived.primaryVolume,
        secondary: derived.secondaryVolume,
        total: derived.totalVolume,
        primaryL: derived.primaryVolumeL,
        secondaryL: derived.secondaryVolumeL,
        totalL: derived.totalVolumeL
      },
      alcohol: {
        abv: derived.abv,
        delle: derived.delle
      },
      stabilizers,
      nutrients: nutrientDerived
    }
  };
}
