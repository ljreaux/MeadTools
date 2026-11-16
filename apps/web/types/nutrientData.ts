/**
 * Nutrient calculator data (version 2). The model, defaults, schedule presets
 * and calculator rules live in `@meadtools/core/nutrients`, shared with Mobile
 * and the MCP recipe tools; this module keeps the web's import path.
 */
export type {
  GoFermType,
  NitrogenRequirement,
  NutrientData,
  NutrientKey,
  NutrientScheduleType,
  NutrientVolumeUnit,
  SelectedNutrients
} from "@meadtools/core/nutrients";
export {
  getEffectiveMaxGpl,
  initialNutrientData,
  scheduleFromSelected
} from "@meadtools/core/nutrients";

export type NumericInputString = string;

/** Nutrient order used by the recipe PDF. */
export const ORDER = ["fermO", "fermK", "dap", "other"] as const;
