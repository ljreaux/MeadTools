import { calcABV, toBrix } from "./gravity";
import {
  calculateEffectiveNutrientData,
  calculateNutrientDerivedState,
  initialNutrientData,
  type NutrientData,
  type NutrientDerivedState
} from "./nutrients";
import { parseNumber } from "./numeric";
import {
  calculateOriginalGravity,
  calculateVolume,
  fmt,
  L_TO_VOLUME,
  normalizeIngredientLine,
  type BlendInput,
  type IngredientLineInput,
  type NormalizedIngredientLine,
  type VolumeUnit,
  type WeightUnit
} from "./recipe";

export type RecipeDerivedInput = {
  version: 2;
  unitDefaults: {
    weight: WeightUnit;
    volume: VolumeUnit;
  };
  ingredients: IngredientLineInput[];
  fg: string;
  stabilizers: {
    adding: boolean;
    takingPh: boolean;
    phReading: string;
    type: "kmeta" | "nameta";
  };
  nutrients?: NutrientData;
};

export type RecipeDerivedState = {
  normalized: NormalizedIngredientLine[];
  primaryInputs: BlendInput[];
  secondaryInputs: BlendInput[];
  ogPrimary: number;
  primaryVolumeL: number;
  secondaryVolumeL: number;
  totalVolumeL: number;
  primaryVolume: number;
  secondaryVolume: number;
  totalVolume: number;
  volumeUnit: VolumeUnit;
  totalForAbv: number;
  backsweetenedFg: number;
  abv: number;
  delle: number;
  nutrientValueForRecipe: NutrientData;
};

export type RecipeStabilizerResults = {
  sorbate: number;
  sulfite: number;
  campden: number;
};

function phToPpm(ph: number) {
  if (ph <= 2.9) return 11;
  if (ph === 3.0) return 13;
  if (ph === 3.1) return 16;
  if (ph === 3.2) return 21;
  if (ph === 3.3) return 26;
  if (ph === 3.4) return 32;
  if (ph === 3.5) return 39;
  if (ph === 3.6) return 50;
  if (ph === 3.7) return 63;
  if (ph === 3.8) return 98;
  return 123;
}

export function calculateRecipeStabilizerResults(args: {
  addingStabilizers: boolean;
  phReading: string;
  stabilizerType: "kmeta" | "nameta";
  totalVolumeL: number;
  abv: number;
}): RecipeStabilizerResults {
  if (!args.addingStabilizers) return { sorbate: 0, sulfite: 0, campden: 0 };
  const ppm = phToPpm(Math.round(parseNumber(args.phReading) * 10) / 10);
  const gallons = args.totalVolumeL / 3.78541;
  const sorbate = ((-args.abv * 25 + 400) / 0.75) * (args.totalVolumeL / 1000);
  const multiplier = args.stabilizerType === "kmeta" ? 570 : 674;
  return {
    sorbate,
    sulfite: (args.totalVolumeL * ppm) / multiplier,
    campden: (ppm / 75) * gallons
  };
}

export function calculateRecipeDerivedState(
  recipeData: RecipeDerivedInput
): RecipeDerivedState {
  const normalized = recipeData.ingredients.map(normalizeIngredientLine);
  const primaryInputs = normalized
    .filter((line) => !line.secondary)
    .map((line) => ({ sg: line.sg, volumeL: line.volumeL }));
  const secondaryInputs = normalized
    .filter((line) => line.secondary)
    .map((line) => ({ sg: line.sg, volumeL: line.volumeL }));
  const ogPrimary = calculateOriginalGravity(primaryInputs);
  const primaryVolumeL = calculateVolume(primaryInputs);
  const secondaryVolumeL = calculateVolume(secondaryInputs);
  const totalVolumeL = primaryVolumeL + secondaryVolumeL;
  const volumeFactor = L_TO_VOLUME[recipeData.unitDefaults.volume];
  const totalForAbv = calculateOriginalGravity([
    ...primaryInputs,
    ...secondaryInputs
  ]);
  const secondarySg = calculateOriginalGravity(secondaryInputs);
  const backsweetenedFg = calculateOriginalGravity([
    { sg: parseNumber(recipeData.fg), volumeL: primaryVolumeL },
    { sg: secondarySg, volumeL: secondaryVolumeL }
  ]);
  const primaryAbv = calcABV(ogPrimary, parseNumber(recipeData.fg));
  const abv =
    totalVolumeL > 0 ? (primaryAbv * primaryVolumeL) / totalVolumeL : 0;
  const nutrients = recipeData.nutrients ?? initialNutrientData();
  const fgSg = parseNumber(recipeData.fg);
  const nutrientSg =
    Number.isFinite(ogPrimary) && Number.isFinite(fgSg)
      ? 1 + (ogPrimary - fgSg)
      : 1;

  return {
    normalized,
    primaryInputs,
    secondaryInputs,
    ogPrimary,
    primaryVolumeL,
    secondaryVolumeL,
    totalVolumeL,
    primaryVolume: primaryVolumeL * volumeFactor,
    secondaryVolume: secondaryVolumeL * volumeFactor,
    totalVolume: totalVolumeL * volumeFactor,
    volumeUnit: recipeData.unitDefaults.volume,
    totalForAbv,
    backsweetenedFg,
    abv,
    delle: toBrix(backsweetenedFg) + 4.5 * abv,
    nutrientValueForRecipe: {
      ...nutrients,
      inputs: {
        ...nutrients.inputs,
        volume: fmt(primaryVolumeL * volumeFactor),
        volumeUnits:
          recipeData.unitDefaults.volume === "gal" ? "gal" : "liter",
        sg: fmt(nutrientSg)
      }
    }
  };
}

export type RecipeDerivedApiResponse<T extends RecipeDerivedInput> = {
  recipeData: T;
  derived: {
    gravity: {
      ogPrimary: number;
      backsweetenedFg: number;
      totalForAbv: number;
    };
    volume: {
      unit: VolumeUnit;
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

export function calculateRecipeDerivedApiResponse<T extends RecipeDerivedInput>(
  recipeData: T
): RecipeDerivedApiResponse<T> {
  const derived = calculateRecipeDerivedState(recipeData);
  const effectiveNutrients = calculateEffectiveNutrientData(
    derived.nutrientValueForRecipe
  );

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
      stabilizers: calculateRecipeStabilizerResults({
        addingStabilizers: recipeData.stabilizers.adding,
        phReading: recipeData.stabilizers.phReading,
        stabilizerType: recipeData.stabilizers.type,
        totalVolumeL: derived.totalVolumeL,
        abv: derived.abv
      }),
      nutrients: calculateNutrientDerivedState(effectiveNutrients)
    }
  };
}
