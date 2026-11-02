import { z } from "zod";
import { capacityUnitSchema, quantitySchema } from "./quantity";

export const catalogReferenceSchema = z.object({
  // IDs are meaningful only within their catalog; never compare bare IDs.
  catalog: z.enum(["ingredient", "yeast", "additive", "nutrient"]),
  id: z.string().trim().min(1).max(200)
}).strict();
export type CatalogReference = z.infer<typeof catalogReferenceSchema>;

export const packagingQuantitySchema = quantitySchema.extend({
  value: quantitySchema.shape.value.int(), unit: z.literal("units"),
});

export function validateStockQuantity(category: string, quantity: unknown) {
  return (category === "packaging" ? packagingQuantitySchema : quantitySchema).parse(quantity);
}

export const stockInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.enum(["honey", "fruit", "yeast", "additive", "packaging"]),
  catalogReference: catalogReferenceSchema.nullable().default(null),
  quantity: quantitySchema,
  notes: z.string().max(5000).nullable().default(null)
}).strict().refine((stock) => stock.category !== "packaging" || packagingQuantitySchema.safeParse(stock.quantity).success, {
  path: ["quantity"], message: "Packaging is recorded in whole units",
});

export const equipmentInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["vessel", "other"]),
  capacity: quantitySchema.extend({
    value: quantitySchema.shape.value.refine((value) => value > 0),
    unit: capacityUnitSchema
  }).nullable().default(null),
  notes: z.string().max(5000).nullable().default(null)
}).strict().refine((equipment) => equipment.type === "vessel" || equipment.capacity === null, {
  path: ["capacity"], message: "Only vessels have a capacity"
});
