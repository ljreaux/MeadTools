import {
  BlendInput,
  IngredientLineV2,
  NormalizedIngredientLine,
  VolumeUnit,
  WeightUnit
} from "../../types/recipeDataV2";
import { blendValues } from "./blendValues";
import { toSG } from "./unitConverter";
import { parseNumber, isValidNumber } from "./validateInput";

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

/**
 * -----------------------------
 * Additives helpers (unit conversions)
 * -----------------------------
 * Goal:
 * - Catalog selection overwrites unit + amount (handled in provider)
 * - Manual unit changes should convert amount when staying in same "dimension"
 *   (weight<->weight, volume<->volume). Crossing dimensions keeps the value.
 *
 * Prisma enum you showed (string values coming from API):
 * g, ml, tsp, oz, units, mg, kg, lbs, liters, fl_oz, quarts, gal, tbsp
 */

export type AdditiveUnit =
  | "g"
  | "ml"
  | "tsp"
  | "oz"
  | "units"
  | "mg"
  | "kg"
  | "lbs"
  | "liters"
  | "fl_oz"
  | "quarts"
  | "gal"
  | "tbsp";

export type UnitDim = "weight" | "volume" | "count" | "unknown";

export const getAdditiveUnitDim = (u: string): UnitDim => {
  switch (u) {
    // weight
    case "mg":
    case "g":
    case "kg":
    case "oz":
    case "lbs":
      return "weight";

    // volume
    case "ml":
    case "liters":
    case "fl_oz":
    case "tsp":
    case "tbsp":
    case "quarts":
    case "gal":
      return "volume";

    // count-ish (no conversion)
    case "units":
      return "count";

    default:
      return "unknown";
  }
};

// base units: grams + milliliters
export const WEIGHT_TO_G: Record<
  Exclude<
    AdditiveUnit,
    "ml" | "liters" | "fl_oz" | "tsp" | "tbsp" | "quarts" | "gal" | "units"
  >,
  number
> = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lbs: 453.59237
};

export const VOLUME_TO_ML: Record<
  Exclude<AdditiveUnit, "mg" | "g" | "kg" | "oz" | "lbs" | "units">,
  number
> = {
  ml: 1,
  liters: 1000,
  fl_oz: 29.5735295625,
  tsp: 4.92892159375,
  tbsp: 14.78676478125,
  quarts: 946.352946,
  gal: 3785.411784
};

/**
 * Convert an additive amount string when the user changes unit.
 * - Converts only if both units share the same dimension.
 * - Otherwise returns original string (your "switch to mL keeps value" rule).
 */
export function convertAdditiveAmount(args: {
  amountStr: string;
  fromUnit: string;
  toUnit: string;
}) {
  const { amountStr, fromUnit, toUnit } = args;

  if (!isValidNumber(amountStr)) return amountStr;

  const fromDim = getAdditiveUnitDim(fromUnit);
  const toDim = getAdditiveUnitDim(toUnit);

  if (fromDim !== toDim) return amountStr;
  if (fromDim === "count" || fromDim === "unknown") return amountStr;

  const val = parseNumber(amountStr);
  if (!Number.isFinite(val)) return amountStr;

  if (fromDim === "weight") {
    const from = WEIGHT_TO_G[fromUnit as keyof typeof WEIGHT_TO_G];
    const to = WEIGHT_TO_G[toUnit as keyof typeof WEIGHT_TO_G];
    if (!from || !to) return amountStr;

    // val(fromUnit) -> grams -> toUnit
    return fmt((val * from) / to);
  }

  // volume
  const from = VOLUME_TO_ML[fromUnit as keyof typeof VOLUME_TO_ML];
  const to = VOLUME_TO_ML[toUnit as keyof typeof VOLUME_TO_ML];
  if (!from || !to) return amountStr;

  // val(fromUnit) -> mL -> toUnit
  return fmt((val * from) / to);
}

/**
 * dosageToAmount
 * - dosage is stored as "unit / gal"
 * - totalVolumeL is canonical liters
 */
export function dosageToAmount({
  dosage,
  totalVolumeL
}: {
  dosage: number;
  totalVolumeL: number;
}) {
  const gallons = totalVolumeL * L_TO_VOLUME.gal;
  const amt = dosage * gallons;
  return fmt(amt);
}
/**
 * Decide whether we should convert amount when changing units.
 *
 * Core rule:
 * - Same dimension: convert ONLY if we trust the current numeric value for that dimension.
 * - Cross dimension: never convert (keep numeric value).
 *
 * Trust sources:
 * - User typed the amount (amountTouched === true)
 * - OR the line says the amount represents the "from" dimension (amountDim === fromDim)
 *
 * If amountDim is "unknown" (ex: user previously switched g->ml and we kept value),
 * we refuse to convert even within the new dimension until user types an amount or re-selects catalog.
 */
export function shouldConvertAdditiveAmount(args: {
  amountStr: string;
  fromUnit: string;
  toUnit: string;
  amountTouched: boolean;
  amountDim: UnitDim; // your AdditiveLineV2.amountDim
}) {
  const { amountStr, fromUnit, toUnit, amountTouched, amountDim } = args;

  // If amount isn't numeric-ish, conversion doesn't help.
  if (!isValidNumber(amountStr)) return false;

  const fromDim = getAdditiveUnitDim(fromUnit);
  const toDim = getAdditiveUnitDim(toUnit);

  // only convert within same dimension
  if (fromDim !== toDim) return false;

  // never convert count/unknown
  if (fromDim === "count" || fromDim === "unknown") return false;

  // trust if user typed it, or if the line says the amount is truly in this dimension
  return amountTouched || amountDim === fromDim;
}

/**
 * When user edits the amount manually, we can "lock in" what dimension
 * the amount is intended to represent (based on the current unit).
 */
export function inferAdditiveAmountDimFromUnit(unit: string): UnitDim {
  return getAdditiveUnitDim(unit);
}

/**
 * Convenience: after a cross-dimension unit change (g -> ml),
 * mark the amount as "unknown" so future same-dimension changes do not convert
 * until user types a real value or selects a catalog additive again.
 */
export function nextAdditiveAmountDimOnUnitChange(args: {
  fromUnit: string;
  toUnit: string;
  prevAmountDim: UnitDim;
}) {
  const { fromUnit, toUnit, prevAmountDim } = args;
  const fromDim = getAdditiveUnitDim(fromUnit);
  const toDim = getAdditiveUnitDim(toUnit);

  // cross-dim relabel => unknown
  if (fromDim !== toDim) return "unknown" as const;

  // same dimension => keep whatever it was (or normalize to dim if you want)
  // keeping is safer if you ever use "unknown" as a block.
  return prevAmountDim;
}
