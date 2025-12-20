import {
  BlendInput,
  IngredientLineV2,
  NormalizedIngredientLine,
  VolumeUnit,
  WeightUnit
} from "../../types/recipeDataV2";
import { blendValues } from "./blendValues";
import { toSG } from "./unitConverter";
import { parseNumber } from "./validateInput";

/**
 * Base-unit conversion factors
 * - weight → kg
 * - volume → L
 */
export const WEIGHT_TO_KG: Record<WeightUnit, number> = {
  kg: 1,
  g: 0.001,
  lb: 0.45359237,
  oz: 0.028349523125
};

export const VOLUME_TO_L: Record<VolumeUnit, number> = {
  L: 1,
  mL: 0.001,

  // US
  gal: 3.785411784,
  qt: 0.946352946,
  pt: 0.473176473,
  fl_oz: 0.0295735295625,

  // Imperial
  imp_gal: 4.54609,
  imp_qt: 1.1365225,
  imp_pt: 0.56826125,
  imp_fl_oz: 0.0284130625
};

export const KG_TO_WEIGHT: Record<WeightUnit, number> = {
  kg: 1,
  g: 1000,
  lb: 2.2046226218,
  oz: 35.27396195
};

export const L_TO_VOLUME: Record<VolumeUnit, number> = {
  L: 1,
  mL: 1000,

  // US
  gal: 0.2641720524,
  qt: 1.056688209,
  pt: 2.113376419,
  fl_oz: 33.8140227,

  // Imperial
  imp_gal: 0.2199692483,
  imp_qt: 0.879876993,
  imp_pt: 1.759753986,
  imp_fl_oz: 35.19507973
};

export const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : "0.000");

/**
 * Convert a single ingredient line into numeric base units
 * suitable for blending math.
 *
 */
export function normalizeIngredientLine(
  line: IngredientLineV2
): NormalizedIngredientLine {
  const brix = parseNumber(line.brix);

  return {
    lineId: line.lineId,
    secondary: line.secondary,
    category: line.category,
    brix,
    sg: toSG(brix),
    weightKg:
      parseNumber(line.amounts.weight.value) *
      WEIGHT_TO_KG[line.amounts.weight.unit],
    volumeL:
      parseNumber(line.amounts.volume.value) *
      VOLUME_TO_L[line.amounts.volume.unit]
  };
}

/**
 * Core blending math.
 * Accepts already-normalized sg + volumeL inputs.
 */
export function calculateBlend(inputs: BlendInput[]) {
  if (inputs.length === 0) {
    return { sg: 1, volumeL: 0 };
  }

  const { blendedValue, totalVolume } = blendValues(
    inputs.map((b) => [b.sg, b.volumeL])
  );

  return {
    sg: blendedValue,
    volumeL: totalVolume
  };
}

export function calculateOriginalGravity(inputs: BlendInput[]) {
  return calculateBlend(inputs).sg;
}

export function calculateVolume(inputs: BlendInput[]) {
  return calculateBlend(inputs).volumeL;
}
export const isEffectivelyEmptyNumericInput = (s: string) => {
  const v = s.trim();
  if (v === "") return true;

  // treat 0, 0.0, 0.000, 00.000 (and comma/٫ decimals) as empty placeholders
  // NOTE: this will also treat a user-entered "0" as empty (we can refine later with a "touched" flag).
  return /^0+(?:[.,٫]0+)?$/.test(v);
};

export const HONEY_BRIX = 79.6;

export function calculateHoneyAndWaterL(
  desiredOg: number,
  totalVolumeL: number
) {
  const honeyOg = toSG(HONEY_BRIX);
  const waterOg = toSG(0);

  if (desiredOg < waterOg || desiredOg > honeyOg) {
    throw new Error(
      `The desired OG (${desiredOg}) must be between ${waterOg} and ${honeyOg}.`
    );
  }

  // totalVolumeL = honeyL + waterL
  // desiredOg = (honeyOg*honeyL + waterOg*waterL) / totalVolumeL
  const honeyL = ((desiredOg - waterOg) * totalVolumeL) / (honeyOg - waterOg);
  const waterL = totalVolumeL - honeyL;

  return { honeyL, waterL };
}
