import { WEIGHT_TO_KG, type WeightUnit } from "@meadtools/core/recipe";

/** Logged packet counts are not weights. Older yeast entries omitted the unit
 * because the logging dialog only supported grams. */
export function loggedYeastAmountG(
  addition?: { amount: number | null; unit: string | null } | null,
): number | null {
  if (
    !addition ||
    typeof addition.amount !== "number" ||
    !Number.isFinite(addition.amount) ||
    addition.amount < 0
  ) return null;
  const unit = addition.unit || "g";
  if (unit === "g") return addition.amount;
  const factor = unit === "mg" ? 0.000001
    : unit === "lbs" ? WEIGHT_TO_KG.lb
    : Object.hasOwn(WEIGHT_TO_KG, unit) ? WEIGHT_TO_KG[unit as WeightUnit]
    : null;
  return factor == null ? null : addition.amount * factor * 1000;
}

