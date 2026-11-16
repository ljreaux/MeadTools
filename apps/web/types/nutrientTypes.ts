/** Catalog types for the yeast list and nutrient presets. */
export type YeastBrand =
  | "Lalvin"
  | "Fermentis"
  | "Mangrove Jack"
  | "Red Star"
  | "Other";

export type NitrogenRequirement =
  | "Very Low"
  | "Low"
  | "Medium"
  | "High"
  | "Very High";

// Yeast data model (for each yeast)
export type Yeast = {
  id: number;
  brand: YeastBrand;
  name: string;
  nitrogen_requirement: NitrogenRequirement;
  tolerance: string;
  low_temp: string;
  high_temp: string;
};

export type NutrientPreset = {
  id: string;
  name: string;
  yan_ppm_per_gpl: number;
  max_gpl: number | null;
  organic_multiplier: boolean;
};
