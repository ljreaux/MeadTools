import { z } from "zod";
import { nutrientDataV2Schema } from "./nutrient";

export const weightUnitSchema = z.enum(["kg", "g", "lb", "oz"]);
export const volumeUnitSchema = z.enum([
  "L",
  "mL",
  "gal",
  "qt",
  "pt",
  "fl_oz",
  "imp_gal",
  "imp_qt",
  "imp_pt",
  "imp_fl_oz"
]);

const ingredientReferenceSchema = z.union([
  z.object({
    kind: z.literal("catalog"),
    ingredientId: z.union([z.number(), z.string()])
  }),
  z.object({
    kind: z.literal("custom")
  })
]);

export const ingredientLineSchema = z.object({
  lineId: z.string(),
  name: z.string(),
  ref: ingredientReferenceSchema,
  category: z.string(),
  brix: z.string(),
  secondary: z.boolean(),
  amounts: z.object({
    weight: z.object({
      value: z.string(),
      unit: weightUnitSchema
    }),
    volume: z.object({
      value: z.string(),
      unit: volumeUnitSchema
    }),
    basis: z.enum(["weight", "volume"])
  })
});

export const additiveLineSchema = z.object({
  lineId: z.string(),
  name: z.string(),
  amount: z.string(),
  unit: z.string(),
  amountTouched: z.boolean(),
  amountDim: z.enum(["weight", "volume", "count", "unknown"])
});

export const noteLineSchema = z.object({
  lineId: z.string(),
  content: z.tuple([z.string(), z.string()])
});

export const recipeDataV2Schema = z.object({
  version: z.literal(2),
  unitDefaults: z.object({
    weight: weightUnitSchema,
    volume: volumeUnitSchema
  }),
  ingredients: z.array(ingredientLineSchema),
  fg: z.string(),
  additives: z.array(additiveLineSchema),
  stabilizers: z.object({
    adding: z.boolean(),
    takingPh: z.boolean(),
    phReading: z.string(),
    type: z.enum(["kmeta", "nameta"])
  }),
  notes: z.object({
    primary: z.array(noteLineSchema),
    secondary: z.array(noteLineSchema)
  }),
  nutrients: nutrientDataV2Schema.optional(),
  flags: z
    .object({
      advanced: z.boolean().optional(),
      private: z.boolean().optional()
    })
    .optional()
});

export type RecipeDataV2 = z.infer<typeof recipeDataV2Schema>;
export type IngredientLine = z.infer<typeof ingredientLineSchema>;
export type AdditiveLine = z.infer<typeof additiveLineSchema>;
export type NoteLine = z.infer<typeof noteLineSchema>;
export type WeightUnit = z.infer<typeof weightUnitSchema>;
export type VolumeUnit = z.infer<typeof volumeUnitSchema>;

export function isRecipeDataV2(value: unknown): value is RecipeDataV2 {
  return recipeDataV2Schema.safeParse(value).success;
}
