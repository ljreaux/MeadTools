import { toSG, toBrix, calcABV } from "./gravity";

/** Standalone calculator math shared by the web UI and agent adapters.
 * Conversion constants intentionally match the original calculators.
 */
export function estimatedOriginalGravity(
  hydrometerFg: number,
  refractometerFgBrix: number
) {
  return (
    Math.round(
      (-1.728 * hydrometerFg + 0.01085 * refractometerFgBrix + 2.728) * 1000
    ) / 1000
  );
}

export function sulfiteAddition(
  volume: number,
  unit: "gal" | "lit",
  ppm: number,
  type: "kMeta" | "naMeta"
) {
  const liters = unit === "gal" ? volume * 3.785 : volume;
  return {
    sulfiteGrams: (liters * ppm) / (type === "kMeta" ? 570 : 674),
    campdenTablets: (ppm / 75) * (unit === "gal" ? volume : volume / 3.785)
  };
}

export function sorbateAddition(
  volume: number,
  unit: "gal" | "lit",
  abv: number
) {
  return (
    ((-abv * 25 + 400) / 0.75) *
    (unit === "gal" ? volume * 0.003785411784 : volume / 1000)
  );
}

export function primingSugarBase(
  temperatureF: number,
  co2Volumes: number,
  volumeGallons: number
) {
  return (
    15.195 *
    volumeGallons *
    (co2Volumes -
      3.0378 +
      5.0062e-2 * temperatureF -
      2.6555e-4 * temperatureF ** 2)
  );
}

export const primingBottleSizes = [
  { size: 12, label: "12 oz" },
  { size: 22, label: "22 oz" },
  { size: 11.1586, label: "330 ml" },
  { size: 16.907, label: "500 ml" },
  { size: 25.3605, label: "750 ml" }
].map((item) => ({ ...item, size: item.size * 0.0078125 }));

export function benchTrial(
  stockVolumeMl: number,
  concentrationPercent: number,
  sampleMl: number,
  batchSize: number,
  unit: "gallon" | "liter"
) {
  const adjunctAmount =
    Math.round(stockVolumeMl * concentrationPercent * 1e6) / 1e8;
  const concentration =
    Math.round((adjunctAmount / (sampleMl + stockVolumeMl)) * 1e6) / 1e6;
  const scaledAdjunct =
    unit === "gallon"
      ? Math.round(concentration * 37850000) / 1e4
      : Math.round(concentration * 1e4) / 10;
  return {
    adjunctAmount,
    adjunctConcentration: concentration * 1e6,
    scaledAdjunct,
    scaledBatch: Math.round(scaledAdjunct * batchSize * 1e4) / 1e4
  };
}

export const L_PER_GAL = 3.78541;
export const FL_OZ_PER_L = 33.814;
export const BOTTLE_SIZES_L: Record<string, number> = {
  "12oz": 0.355,
  "187ml": 0.187,
  "330ml": 0.33,
  "375ml": 0.375,
  "500ml": 0.5,
  "22oz": 0.65,
  "750ml": 0.75,
  "1L": 1,
  "1.5L": 1.5,
  "3L": 3,
  "5gal": 18.9271,
  "Oxebar 20L": 20,
  "Oxebar 8L": 8,
  "Oxebar 4L": 4
};
export function bottleVolumeLiters(
  value: number,
  unit: "fl_oz" | "ml" | "liter" | "gallon"
) {
  if (unit === "liter") return value;
  if (unit === "ml") return value / 1000;
  if (unit === "gallon") return value * L_PER_GAL;
  return value / FL_OZ_PER_L;
}
export function bottlesToFill(neededLiters: number, bottleLiters: number) {
  return Math.max(0, Math.ceil(neededLiters / bottleLiters));
}
export function bottleBreakdown(
  targetLiters: number,
  rows: { sizeLiters: number; quantity: number }[]
) {
  return bottleTotals(
    targetLiters,
    rows.map((row) => row.sizeLiters * row.quantity)
  );
}

export function bottleTotals(targetLiters: number, allocatedLiters: number[]) {
  const totalBottledLiters = allocatedLiters.reduce(
    (sum, liters) => sum + liters,
    0
  );
  return {
    totalBottledLiters,
    remainingLiters: targetLiters - totalBottledLiters
  };
}

/** Label-based estimate, not a measured juice density. */
export function juiceLabelEstimate(
  sugar: number,
  sugarUnit: "g" | "mg",
  servingSize: number,
  servingUnit: "ml" | "floz",
  servings: number
) {
  const sugarGrams = sugarUnit === "mg" ? sugar * 0.001 : sugar;
  const servingMl =
    servingUnit === "floz" ? servingSize * 29.5735 : servingSize;
  const calculated = Math.round((sugarGrams / servingMl) * 100 * 1000) / 1000;
  const brix =
    !Number.isFinite(calculated) || servingMl <= 0 || calculated > 1000
      ? 0
      : calculated;
  const total = Math.round(sugar * servings * 1000) / 1000;
  return {
    brix,
    specificGravity: Math.round(toSG(brix) * 1000) / 1000,
    totalSugar: Number.isFinite(total) ? total : 0
  };
}

export function sulfitePpmForPh(phReading: number) {
  const ph = Math.round(phReading * 10) / 10;
  if (ph <= 2.9) return 11;
  if (ph >= 3.9) return 123;
  return (
    (
      {
        3: 13,
        3.1: 16,
        3.2: 21,
        3.3: 26,
        3.4: 32,
        3.5: 39,
        3.6: 50,
        3.7: 63,
        3.8: 98
      } as Record<number, number>
    )[ph] ?? 50
  );
}

/** Match the standalone ABV display's treatment of negative zero and nonfinite math. */
export function standaloneAlcohol(
  originalGravity: number,
  finalGravity: number
) {
  const rawAbv = calcABV(originalGravity, finalGravity);
  const normalize = (value: number) =>
    !Number.isFinite(value) || Math.abs(value) < 1e-10 ? 0 : value;
  return {
    abvPercent: normalize(rawAbv),
    delle: normalize(toBrix(finalGravity) + 4.5 * rawAbv)
  };
}
