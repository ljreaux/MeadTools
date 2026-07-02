import { z } from "zod";

export const nutrientVolumeUnitSchema = z.enum(["gal", "liter"]);
export const goFermTypeSchema = z.enum([
  "Go-Ferm",
  "protect",
  "sterol-flash",
  "none"
]);
export const nitrogenRequirementSchema = z.enum([
  "Very Low",
  "Low",
  "Medium",
  "High",
  "Very High"
]);
export const nutrientScheduleSchema = z.enum([
  "tbe",
  "tosna",
  "justK",
  "dap",
  "oAndk",
  "oAndDap",
  "kAndDap",
  "other"
]);
export const nutrientKeySchema = z.enum(["fermO", "fermK", "dap", "other"]);

const numericInputSchema = z.string();
const nutrientRecordSchema = z.object({
  fermO: numericInputSchema,
  fermK: numericInputSchema,
  dap: numericInputSchema,
  other: numericInputSchema
});

export const selectedNutrientsSchema = z.object({
  fermO: z.boolean(),
  fermK: z.boolean(),
  dap: z.boolean(),
  other: z.boolean()
});

export const nutrientDataV2Schema = z.object({
  version: z.literal(2),
  inputs: z.object({
    volume: numericInputSchema,
    volumeUnits: nutrientVolumeUnitSchema,
    sg: numericInputSchema,
    offsetPpm: numericInputSchema,
    numberOfAdditions: numericInputSchema,
    goFermType: goFermTypeSchema,
    yeastAmountG: numericInputSchema,
    yeastAmountTouched: z.boolean()
  }),
  selected: z.object({
    yeastBrand: z.string(),
    yeastStrain: z.string(),
    yeastId: z.number().int().optional(),
    nitrogenRequirement: nitrogenRequirementSchema,
    schedule: nutrientScheduleSchema,
    selectedNutrients: selectedNutrientsSchema
  }),
  settings: z.object({
    yanContribution: nutrientRecordSchema,
    maxGpl: nutrientRecordSchema,
    maxGplTouched: z.boolean(),
    other: z.object({
      name: z.string()
    })
  }),
  adjustments: z.object({
    adjustAllowed: z.boolean(),
    providedYanPpm: nutrientRecordSchema
  })
});

export type NutrientDataV2 = z.infer<typeof nutrientDataV2Schema>;
export type NutrientVolumeUnit = z.infer<typeof nutrientVolumeUnitSchema>;
export type GoFermType = z.infer<typeof goFermTypeSchema>;
export type NitrogenRequirement = z.infer<typeof nitrogenRequirementSchema>;
export type NutrientSchedule = z.infer<typeof nutrientScheduleSchema>;
export type NutrientKey = z.infer<typeof nutrientKeySchema>;
