import { z } from "zod";
import { quantityValueSchema } from "./quantity";

export const bottleCountSchema = quantityValueSchema.int();
export const bottleSizeLitersSchema = quantityValueSchema.positive();
export const finishedMeadDetailsSchema = z.object({
  name: z.string().trim().min(1).max(200),
  notes: z.string().max(5000).nullable().default(null),
}).strict();
export const finishedMeadBottleInputSchema = z.object({
  size_liters: bottleSizeLitersSchema,
  quantity: bottleCountSchema,
}).strict();
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
