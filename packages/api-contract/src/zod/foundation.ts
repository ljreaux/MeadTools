import { z } from "zod";
import {
  additiveAmountDimSchema as sharedAdditiveAmountDimSchema,
  additiveLineSchema,
  goFermTypeSchema as sharedGoFermTypeSchema,
  ingredientLineAmountsSchema,
  ingredientLineSchema,
  ingredientReferenceSchema,
  nitrogenRequirementSchema as sharedNitrogenRequirementSchema,
  noteLineSchema,
  notesSchema,
  nutrientAdjustmentsSchema,
  nutrientDataV2Schema,
  nutrientInputsSchema,
  nutrientRecordSchema,
  nutrientScheduleSchema,
  nutrientSelectedSchema,
  nutrientSettingsSchema,
  nutrientVolumeUnitSchema as sharedNutrientVolumeUnitSchema,
  recipeDataV2Schema,
  recipeUnitDefaultsSchema,
  selectedNutrientsSchema,
  stabilizersSchema,
  volumeUnitSchema as sharedVolumeUnitSchema,
  weightUnitSchema as sharedWeightUnitSchema
} from "@meadtools/schemas";

export const weightUnitSchema = sharedWeightUnitSchema;
export const volumeUnitSchema = sharedVolumeUnitSchema;
export const recipeUnitDefaultsResponseSchema = recipeUnitDefaultsSchema;
export const ingredientRefResponseSchema = ingredientReferenceSchema;
export const recipeAmountInputResponseSchema =
  z.object({ value: z.string(), unit: z.string() });
export const ingredientLineAmountsResponseSchema = ingredientLineAmountsSchema;
export const ingredientLineResponseSchema = ingredientLineSchema;
export const additiveAmountDimSchema = sharedAdditiveAmountDimSchema;
export const additiveLineResponseSchema = additiveLineSchema;
export const stabilizersResponseSchema = stabilizersSchema;
export const noteLineResponseSchema = noteLineSchema;
export const notesResponseSchema = notesSchema;
export const nutrientVolumeUnitSchema = sharedNutrientVolumeUnitSchema;
export const goFermTypeSchema = sharedGoFermTypeSchema;
export const nitrogenRequirementSchema = sharedNitrogenRequirementSchema;
export const nutrientScheduleTypeSchema = nutrientScheduleSchema;
export const selectedNutrientsResponseSchema = selectedNutrientsSchema;
export const nutrientAmountsByKeyResponseSchema = nutrientRecordSchema;
export const nutrientAdjustmentsResponseSchema = nutrientAdjustmentsSchema;
export const nutrientSettingsResponseSchema = nutrientSettingsSchema;
export const nutrientInputsResponseSchema = nutrientInputsSchema;
export const nutrientSelectedResponseSchema = nutrientSelectedSchema;
export const nutrientDataResponseSchema = nutrientDataV2Schema;
export const recipeDataV2ResponseSchema = recipeDataV2Schema;

export const nutrientAmountsByKeyNumberResponseSchema = z.object({
  fermO: z.number(), fermK: z.number(), dap: z.number(), other: z.number()
});
export const nutrientAdditionsDerivedResponseSchema = z.object({
  totalGrams: nutrientAmountsByKeyNumberResponseSchema,
  perAddition: nutrientAmountsByKeyNumberResponseSchema
});
export const nutrientDerivedStateResponseSchema = z.object({
  targetYanPpm: z.number(), remainingYanPpm: z.number(),
  numberOfAdditions: z.number(),
  nutrientAdditions: nutrientAdditionsDerivedResponseSchema,
  providedYanPpm: nutrientAmountsByKeyNumberResponseSchema,
  goFerm: z.object({ amount: z.number(), water: z.number() })
});
export const recipeStabilizerResultsResponseSchema = z.object({
  sorbate: z.number(), sulfite: z.number(), campden: z.number()
});
export const recipeDerivedValidationErrorResponseSchema =
  z.object({ error: z.literal("Invalid recipe data payload.") });
export const recipeDerivedByIdValidationErrorResponseSchema =
  z.object({
    error: z.enum(["Invalid recipe ID", "Recipe does not have valid dataV2."])
  });
export const recipeDerivedFailureErrorResponseSchema =
  z.object({
    error: z.enum([
      "Failed to calculate recipe derived state",
      "An error occurred while fetching the recipe"
    ])
  });
