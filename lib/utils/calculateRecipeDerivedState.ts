import { initialNutrientData, NutrientData } from "@/types/nutrientData";
import {
  BlendInput,
  NormalizedIngredientLine,
  RecipeData,
  RecipeUnitDefaults
} from "@/types/recipeData";
import {
  calculateOriginalGravity,
  calculateVolume,
  fmt,
  L_TO_VOLUME,
  normalizeIngredientLine
} from "@/lib/utils/recipeDataCalculations";
import { calcABV, toBrix } from "@/lib/utils/unitConverter";
import { parseNumber } from "@/lib/utils/validateInput";

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
  volumeUnit: RecipeUnitDefaults["volume"];
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

  const ph = Math.round(parseNumber(args.phReading) * 10) / 10;
  const ppm = phToPpm(ph);
  const liters = args.totalVolumeL;
  const gallons = liters / 3.78541;
  const m3 = liters / 1000;
  const sorbate = ((-args.abv * 25 + 400) / 0.75) * m3;
  const multiplier = args.stabilizerType === "kmeta" ? 570 : 674;
  const sulfite = (liters * ppm) / multiplier;
  const campden = (ppm / 75) * gallons;

  return { sorbate, sulfite, campden };
}

export default function calculateRecipeDerivedState(
  recipeData: RecipeData
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
  const primaryVolume = primaryVolumeL * volumeFactor;
  const secondaryVolume = secondaryVolumeL * volumeFactor;
  const totalVolume = totalVolumeL * volumeFactor;

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
  const delle = toBrix(backsweetenedFg) + 4.5 * abv;

  const nutrients = recipeData.nutrients ?? initialNutrientData();
  const nutrientVolumeUnits =
    recipeData.unitDefaults.volume === "gal" ? "gal" : "liter";
  const fgSg = parseNumber(recipeData.fg);
  const nutrientSg =
    Number.isFinite(ogPrimary) && Number.isFinite(fgSg)
      ? 1 + (ogPrimary - fgSg)
      : 1;

  const nutrientValueForRecipe: NutrientData = {
    ...nutrients,
    inputs: {
      ...nutrients.inputs,
      volume: fmt(primaryVolume),
      volumeUnits: nutrientVolumeUnits,
      sg: fmt(nutrientSg)
    }
  };

  return {
    normalized,
    primaryInputs,
    secondaryInputs,
    ogPrimary,
    primaryVolumeL,
    secondaryVolumeL,
    totalVolumeL,
    primaryVolume,
    secondaryVolume,
    totalVolume,
    volumeUnit: recipeData.unitDefaults.volume,
    totalForAbv,
    backsweetenedFg,
    abv,
    delle,
    nutrientValueForRecipe
  };
}
