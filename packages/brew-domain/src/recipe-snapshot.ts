import type { NutrientData } from "@meadtools/core/nutrients";
import type { VolumeUnit, WeightUnit } from "@meadtools/core/recipe";

export type IngredientRef =
  | { kind: "catalog"; ingredientId: number | string }
  | { kind: "custom" };

/* --------------------------- Core line + recipe --------------------------- */

export type AmountInput<U extends string> = {
  value: string;
  unit: U;
};

/**
 * basis tells you which side is authoritative.
 * - When user edits weight: basis="weight" and volume is derived
 * - When user edits volume: basis="volume" and weight is derived
 *
 * This is key to preventing "clobbering" the last-edited field.
 */
export type IngredientLineAmounts = {
  weight: AmountInput<WeightUnit>;
  volume: AmountInput<VolumeUnit>;
  basis: "weight" | "volume";
};

export type IngredientLine = {
  /** Stable DnD / UI identity. Generated on the client. */
  lineId: string;

  /** What the user sees in the UI (SearchableInput query). */
  name: string;

  /** Optional linkage to your ingredient catalog; name is still stored either way. */
  ref: IngredientRef;

  /** Used for grouping/logic ("water", "sugar", "fruit", etc). */
  category: string;

  /** Editable. Stored as string for input friendliness. */
  brix: string;

  /** Primary vs secondary additions (for backsweetening logic etc). */
  secondary: boolean;

  /** The two user-editable inputs + units. */
  amounts: IngredientLineAmounts;
};

export type RecipeUnitDefaults = {
  weight: WeightUnit;
  volume: VolumeUnit;
};

export type NormalizedIngredientLine = {
  lineId: string;
  secondary: boolean;
  category: string;

  sg: number; // derived from brix
  brix: number; // parsed numeric brix

  weightKg: number; // canonical
  volumeL: number; // canonical
};

/* ------------------------------- Additives ------------------------------- */

type AdditiveAmountDim = "weight" | "volume" | "count" | "unknown";
export type AdditiveLine = {
  lineId: string; // stable UI id (client-generated)
  name: string;
  amount: string;
  unit: string;
  amountTouched: boolean; // user typed amount manually
  amountDim: AdditiveAmountDim;
};

/* ------------------------------ Stabilizers ------------------------------ */

export type StabilizerType = "kmeta" | "nameta";

export type Stabilizers = {
  adding: boolean;
  takingPh: boolean;
  phReading: string;
  type: "kmeta" | "nameta";
};

/* --------------------------------- Notes -------------------------------- */

export type NoteLine = {
  lineId: string;
  content: [string, string]; // keep your existing shape
};

export type Notes = {
  primary: NoteLine[];
  secondary: NoteLine[];
};

/* ----------------------------- RecipeData ----------------------------- */

/**
 * This is the object you store in DB as json/jsonb.
 * Keep it purely user-editable inputs; compute OG/ABV/offset/etc at runtime.
 */
export type RecipeData = {
  version: 2;

  unitDefaults: RecipeUnitDefaults;

  ingredients: IngredientLine[];

  /** User-editable target FG input (your current FG) */
  fg: string;

  additives: AdditiveLine[];

  stabilizers: Stabilizers;

  notes: Notes;

  nutrients?: NutrientData; // ✅ add this
  /** Omitted on existing recipes; omission means loss adjustment is off. */
  lossAdjustment?: {
    enabled: boolean;
    mode: "estimated" | "manual";
    percentage: number;
    /** Optional manual allowance for volume lost after secondary additions. */
    secondary?: {
      enabled: boolean;
      percentage: number;
    };
  };
  /** Room for future flags without breaking parsing */
  flags?: {
    advanced?: boolean;
    private?: boolean;
  };
};

export const isCompatibleRecipeDataSnapshot = (x: unknown): x is RecipeData => {
  if (!x || typeof x !== "object") return false;

  const obj = x as Record<string, unknown>;
  const unitDefaults = obj.unitDefaults as Record<string, unknown> | undefined;
  const stabilizers = obj.stabilizers as Record<string, unknown> | undefined;
  const notes = obj.notes as Record<string, unknown> | undefined;

  return (
    obj.version === 2 &&
    !!unitDefaults &&
    typeof unitDefaults.weight === "string" &&
    typeof unitDefaults.volume === "string" &&
    Array.isArray(obj.ingredients) &&
    typeof obj.fg === "string" &&
    Array.isArray(obj.additives) &&
    !!stabilizers &&
    typeof stabilizers.adding === "boolean" &&
    typeof stabilizers.takingPh === "boolean" &&
    typeof stabilizers.phReading === "string" &&
    typeof stabilizers.type === "string" &&
    !!notes &&
    Array.isArray(notes.primary) &&
    Array.isArray(notes.secondary)
  );
};
