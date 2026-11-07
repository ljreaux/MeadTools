import { z } from "zod";
import { BOTTLE_SIZES_L, bottleVolumeLiters } from "@meadtools/core/extra-calculators";
import { quantityValueSchema, convertQuantity } from "./quantity";

export const bottleCountSchema = quantityValueSchema.int();
export const bottleSizeLitersSchema = quantityValueSchema.positive();
export const finishedMeadDetailsSchema = z.object({
  name: z.string().trim().min(1).max(200),
  notes: z.string().max(5000).nullable().default(null),
}).strict();
export const bottleDisplaySizeSchema = z.object({
  value: quantityValueSchema.positive(),
  unit: z.enum(["mL", "L", "fl_oz", "gal"]),
}).strict();
export type BottleDisplaySize = z.infer<typeof bottleDisplaySizeSchema>;

function bottleLabelSize(label: string): BottleDisplaySize | null {
  const match = label.match(/(\d+(?:\.\d+)?)\s*(fl\s*oz|oz|ml|mL|L|gal)$/);
  if (!match) return null;
  const units: Record<string, BottleDisplaySize["unit"]> = {
    floz: "fl_oz", oz: "fl_oz", ml: "mL", mL: "mL", L: "L", gal: "gal",
  };
  return { value: Number(match[1]), unit: units[match[2].replace(/\s/g, "")] };
}
export function bottleDisplayMatches(liters: number, size: BottleDisplaySize) {
  try { if (convertQuantity(size, "L").value === liters) return true; } catch { return false; }
  // The calculator's existing named presets use nominal rounded capacities.
  return Object.entries(BOTTLE_SIZES_L).some(([label, volume]) => {
    const preset = bottleLabelSize(label);
    return volume === liters && preset?.value === size.value && preset.unit === size.unit;
  });
}
export function productionBottleDisplaySize(row: { sizeLiters: number; label: string; customSizeValue?: number; customSizeUnits?: string }): BottleDisplaySize {
  const units = { fl_oz: "fl_oz", ml: "mL", liter: "L", gallon: "gal" } as const;
  const custom = row.customSizeUnits as keyof typeof units;
  if (row.customSizeValue && units[custom] &&
    Math.abs(bottleVolumeLiters(row.customSizeValue, custom) - row.sizeLiters) <= 0.0000005)
    return { value: row.customSizeValue, unit: units[custom] };
  const label = bottleLabelSize(row.label);
  if (label && bottleDisplayMatches(row.sizeLiters, label)) return label;
  return { value: row.sizeLiters, unit: "L" };
}
export const finishedMeadBottleInputSchema = z.object({
  size_liters: bottleSizeLitersSchema,
  display_size: bottleDisplaySizeSchema.optional(),
  quantity: bottleCountSchema,
}).strict().refine((bottle) => !bottle.display_size || bottleDisplayMatches(bottle.size_liters, bottle.display_size), {
  path: ["display_size"], message: "Bottle display size must match its capacity",
});
export const finishedMeadInputSchema = finishedMeadDetailsSchema.extend({
  bottles: z.array(finishedMeadBottleInputSchema).min(1).max(50),
}).refine((mead) => new Set(mead.bottles.map((bottle) => bottle.size_liters)).size === mead.bottles.length, {
  path: ["bottles"], message: "Combine counts for the same bottle size",
});

/** Only physical bottle counts change stock; names and groupings are user choices. */
export function finishedMeadTotals(bottles: readonly { size_liters: number; quantity: number }[]) {
  return bottles.reduce((total, bottle) => ({
    bottles: total.bottles + bottle.quantity,
    liters: total.liters + bottle.size_liters * bottle.quantity,
  }), { bottles: 0, liters: 0 });
}
