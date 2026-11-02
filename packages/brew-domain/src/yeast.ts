import { WEIGHT_TO_KG, type WeightUnit } from "@meadtools/core/recipe";

/** Counts need an explicit packet weight. Older gram-only entries omitted the unit. */
export function loggedYeastAmountG(
  addition?: { amount: number | null; unit: string | null; meta?: Record<string, unknown> | null } | null,
): number | null {
  if (
    !addition ||
    typeof addition.amount !== "number" ||
    !Number.isFinite(addition.amount) ||
    addition.amount < 0
  ) return null;
  const unit = addition.unit || "g";
  if (unit === "units") {
    const packetWeightG = addition.meta?.packetWeightG;
    if (
      typeof packetWeightG !== "number" ||
      !Number.isFinite(packetWeightG) ||
      packetWeightG <= 0
    ) return null;
    const grams = addition.amount * packetWeightG;
    return Number.isFinite(grams) ? grams : null;
  }
  if (unit === "g") return addition.amount;
  const factor = unit === "mg" ? 0.000001
    : unit === "lbs" ? WEIGHT_TO_KG.lb
    : Object.hasOwn(WEIGHT_TO_KG, unit) ? WEIGHT_TO_KG[unit as WeightUnit]
    : null;
  return factor == null ? null : addition.amount * factor * 1000;
}

