import { z } from "zod";

export const apiErrorResponseSchema = z.object({
  error: z.string()
});

export const additiveUnitResponseSchema =
  z.enum([
    "g",
    "ml",
    "tsp",
    "oz",
    "units",
    "mg",
    "kg",
    "lbs",
    "liters",
    "fl_oz",
    "quarts",
    "gal",
    "tbsp"
  ]);

export const additiveResponseSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  name: z.string(),
  dosage: z.number(),
  unit: additiveUnitResponseSchema
});
export const additivesResponseSchema =
  z.array(additiveResponseSchema);
export const additiveByIdResponseSchema =
  additiveResponseSchema;
export const additiveQueryParamsSchema =
  z.object({ name: z.string().optional() });
export const additiveByIdPathParamsSchema =
  z.object({ id: z.string() });
export const additivesFetchErrorResponseSchema =
  z.object({ error: z.literal("Failed to fetch additives") });
export const additiveNotFoundErrorResponseSchema =
  z.object({ error: z.literal("Additive not found") });
export const additiveFetchErrorResponseSchema =
  z.object({ error: z.literal("Failed to fetch additive") });
const createAdditiveRequestBodyObjectSchema = z.object({
  name: z.string(),
  dosage: z.union([z.number(), z.string()]),
  unit: z.union([additiveUnitResponseSchema, z.literal("fl oz")])
});
export const createAdditiveRequestBodySchema =
  createAdditiveRequestBodyObjectSchema;
export const updateAdditiveRequestBodySchema =
  createAdditiveRequestBodyObjectSchema.partial();
export const createAdditiveValidationErrorResponseSchema =
  z.object({ error: z.literal("Missing required fields") });
const additiveAdminFailureSchema = z.object({
  error: z.enum([
    "Failed to create additive",
    "Server misconfiguration",
    "Failed to verify admin"
  ])
});
export const createAdditiveFailureErrorResponseSchema =
  additiveAdminFailureSchema;
export const updateAdditiveFailureErrorResponseSchema =
  z.object({
    error: z.enum([
      "Failed to update additive",
      "Server misconfiguration",
      "Failed to verify admin"
    ])
  });
export const deleteAdditiveSuccessResponseSchema =
  z.object({ message: z.string() });
export const deleteAdditiveFailureErrorResponseSchema =
  z.object({
    error: z.enum([
      "Failed to delete additive",
      "Server misconfiguration",
      "Failed to verify admin"
    ])
  });

export const ingredientResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  sugar_content: z.string(),
  water_content: z.string(),
  category: z.string()
});
export const ingredientsResponseSchema =
  z.array(ingredientResponseSchema);
export const ingredientByIdResponseSchema =
  ingredientResponseSchema.nullable();
export const ingredientQueryParamsSchema =
  z.object({
    category: z.string().optional(),
    name: z.string().optional()
  });
export const ingredientByIdPathParamsSchema =
  z.object({ id: z.string() });
export const ingredientsFetchErrorResponseSchema =
  z.object({ error: z.literal("Failed to fetch ingredients") });
export const ingredientByIdErrorResponseSchema =
  apiErrorResponseSchema;
const createIngredientRequestBodyObjectSchema = z.object({
  name: z.string(),
  sugar_content: z.number(),
  water_content: z.number(),
  category: z.string()
});
export const createIngredientRequestBodySchema =
  createIngredientRequestBodyObjectSchema;
export const updateIngredientRequestBodySchema =
  createIngredientRequestBodyObjectSchema.partial();
export const deleteIngredientSuccessResponseSchema =
  z.object({ message: z.string() });
export const createIngredientFailureErrorResponseSchema =
  apiErrorResponseSchema;
export const updateIngredientFailureErrorResponseSchema =
  apiErrorResponseSchema;
export const deleteIngredientFailureErrorResponseSchema =
  apiErrorResponseSchema;

export const yeastBrandResponseSchema = z.enum([
  "Lalvin",
  "Fermentis",
  "Mangrove Jack",
  "Red Star",
  "Other"
]);
export const yeastNitrogenRequirementResponseSchema =
  z.enum(["Very Low", "Low", "Medium", "High", "Very High"]);
export const yeastResponseSchema = z.object({
  id: z.number(),
  brand: yeastBrandResponseSchema,
  name: z.string(),
  nitrogen_requirement: yeastNitrogenRequirementResponseSchema,
  tolerance: z.string(),
  low_temp: z.string(),
  high_temp: z.string()
});
export const yeastsResponseSchema =
  z.array(yeastResponseSchema);
export const yeastLookupResponseSchema = z.union(
  [yeastResponseSchema, yeastsResponseSchema]
);
export const yeastByIdResponseSchema =
  yeastResponseSchema.nullable();
export const yeastQueryParamsSchema = z.object({
  brand: z.string().optional(),
  name: z.string().optional(),
  id: z.string().optional()
});
export const yeastByIdPathParamsSchema =
  z.object({ id: z.string() });
export const yeastNotFoundErrorResponseSchema =
  apiErrorResponseSchema;
export const yeastsFetchErrorResponseSchema =
  z.object({ error: z.literal("Failed to fetch yeasts") });
export const yeastByIdErrorResponseSchema =
  apiErrorResponseSchema;
const createYeastRequestBodyObjectSchema = z.object({
  brand: z.string(),
  name: z.string(),
  nitrogen_requirement: yeastNitrogenRequirementResponseSchema,
  tolerance: z.number(),
  low_temp: z.number(),
  high_temp: z.number()
});
export const createYeastRequestBodySchema =
  createYeastRequestBodyObjectSchema;
export const updateYeastRequestBodySchema =
  createYeastRequestBodyObjectSchema.partial();
export const createYeastValidationErrorResponseSchema =
  z.object({ error: z.literal("Yeast name is required") });
export const createYeastFailureErrorResponseSchema =
  z.object({
    error: z.enum([
      "Failed to create yeast",
      "Server misconfiguration",
      "Failed to verify admin"
    ])
  });
export const deleteYeastSuccessResponseSchema =
  z.object({ message: z.string() });
export const updateYeastFailureErrorResponseSchema =
  apiErrorResponseSchema;
export const deleteYeastFailureErrorResponseSchema =
  apiErrorResponseSchema;
