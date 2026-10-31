import { WEIGHT_TO_KG, VOLUME_TO_L } from "@meadtools/core/recipe";
import { z } from "zod";

export const quantityUnitSchema = z.enum([
  "kg", "g", "mg", "lb", "oz", "L", "mL", "gal", "qt", "pt", "fl_oz",
  "imp_gal", "imp_qt", "imp_pt", "imp_fl_oz", "tsp", "tbsp", "units"
]);
export const capacityUnitSchema = quantityUnitSchema.exclude([
  "kg", "g", "mg", "lb", "oz", "units"
]);
export type QuantityUnit = z.infer<typeof quantityUnitSchema>;

/** Spellings already persisted by recipe/additive brew logging. */
export function normalizeQuantityUnit(unit: unknown): QuantityUnit {
  const aliases: Record<string, string> = { tablets:"units", tablet:"units", lbs: "lb", liters: "L", ml: "mL", quarts: "qt", "fl oz": "fl_oz" };
  return quantityUnitSchema.parse(typeof unit === "string" && Object.hasOwn(aliases, unit) ? aliases[unit] : unit);
}

// Stored quantities have six fractional digits in the item's chosen unit.
// Integer arithmetic prevents repeated corrections from accumulating float drift.
const SCALE = 1_000_000;
export const MAX_QUANTITY = 1_000_000_000;
export const quantityValueSchema = z.number().finite().min(0).max(MAX_QUANTITY)
  .refine((value) => value === Math.round(value * SCALE) / SCALE, {
    message: "Quantity supports at most six decimal places"
  });
export const quantitySchema = z.object({
  value: quantityValueSchema,
  unit: quantityUnitSchema
}).strict();
export type Quantity = z.infer<typeof quantitySchema>;

export class InventoryError extends Error {
  constructor(
    public readonly code:
      | "INCOMPATIBLE_UNITS" | "QUANTITY_PRECISION" | "INVALID_QUANTITY"
      | "INSUFFICIENT_STOCK" | "NOT_FOUND" | "LINK_MISMATCH"
      | "VESSEL_OCCUPIED" | "BREW_COMPLETE" | "NOT_A_VESSEL",
    public readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(code);
    this.name = "InventoryError";
  }
}

const units: Record<QuantityUnit, { dimension: "mass" | "volume" | "count"; factor: number }> = {
  ...Object.fromEntries(Object.entries(WEIGHT_TO_KG).map(([unit, factor]) =>
    [unit, { dimension: "mass", factor }])),
  ...Object.fromEntries(Object.entries(VOLUME_TO_L).map(([unit, factor]) =>
    [unit, { dimension: "volume", factor }])),
  mg: { dimension: "mass", factor: 0.000001 },
  tsp: { dimension: "volume", factor: VOLUME_TO_L.fl_oz / 6 },
  tbsp: { dimension: "volume", factor: VOLUME_TO_L.fl_oz / 2 },
  units: { dimension: "count", factor: 1 }
} as Record<QuantityUnit, { dimension: "mass" | "volume" | "count"; factor: number }>;

export function toQuantityTicks(value: number): number {
  if (!quantityValueSchema.safeParse(value).success) {
    throw new InventoryError("INVALID_QUANTITY");
  }
  return Math.round(value * SCALE);
}

export function fromQuantityTicks(ticks: number): number {
  if (!Number.isSafeInteger(ticks) || ticks < 0 || ticks > MAX_QUANTITY * SCALE) {
    throw new InventoryError("INVALID_QUANTITY");
  }
  return ticks / SCALE;
}

/** Same-dimension conversions only. No ingredient density assumptions. */
export function convertQuantity(quantity: Quantity, targetUnit: QuantityUnit): Quantity {
  const parsed = quantitySchema.parse(quantity);
  const source = units[parsed.unit];
  const target = units[quantityUnitSchema.parse(targetUnit)];
  if (source.dimension !== target.dimension) {
    throw new InventoryError("INCOMPATIBLE_UNITS", { from: parsed.unit, to: targetUnit });
  }
  const converted = parsed.value * source.factor / target.factor;
  const ticks = Math.round(converted * SCALE);
  if (parsed.value > 0 && ticks === 0) {
    throw new InventoryError("QUANTITY_PRECISION", { targetUnit });
  }
  return { value: fromQuantityTicks(ticks), unit: targetUnit };
}
