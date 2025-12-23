// recipeDataV2.ts
import { nanoid } from "nanoid";
import { initialNutrientDataV2, NutrientDataV2 } from "./nutrientDataV2";

/**
 * V2 goals:
 * - Keep user-entered inputs as strings (so fields can be empty mid-edit)
 * - Put units next to the values they apply to (per-line units)
 * - Keep a stable lineId for DnD + React keys (NOT tied to Ingredient DB id)
 * - Store only user-editable inputs in DB; derived values are computed in app
 */

export const genLineId = () => nanoid(10);

/* ----------------------------- Units (V2) ----------------------------- */

export type WeightUnit = "kg" | "g" | "lb" | "oz";
export type VolumeUnit =
  | "L"
  | "mL"
  | "gal" // US gallon
  | "qt" // US quart
  | "pt" // US pint
  | "fl_oz" // US fluid ounce
  | "imp_gal" // Imperial gallon
  | "imp_qt"
  | "imp_pt"
  | "imp_fl_oz";

/**
 * Optional: constrain brix to a string. Keep as string so input can be "".
 * Example: "79.6"
 */
export type NumericInputString = string;

/* -------------------------- Ingredient selection -------------------------- */

/**
 * Ingredient catalog items (from your DB list). Keep this separate from the
 * recipe's stored line state.
 */
export type IngredientCatalogItem = {
  id: number | string;
  name: string;
  sugar_content: string;
  water_content: string;
  category: string;
  translationKey?: string;
};

export type AdditiveCatalogItem = {
  id: string;
  name: string;
  dosage: string;
  unit: string;
};

/**
 * What a recipe line uses to identify the ingredient the user picked.
 * - "catalog": user picked from your Ingredient table (store the id)
 * - "custom": user typed something not in your list (store only the name)
 *
 * NOTE: name is still stored at the top-level of the line so the UI always
 * has something to display.
 */
export type IngredientRef =
  | { kind: "catalog"; ingredientId: number | string }
  | { kind: "custom" };

/* --------------------------- Core line + recipe --------------------------- */

export type AmountInput<U extends string> = {
  value: NumericInputString;
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

export type IngredientLineV2 = {
  /** Stable DnD / UI identity. Generated on the client. */
  lineId: string;

  /** What the user sees in the UI (SearchableInput query). */
  name: string;

  /** Optional linkage to your ingredient catalog; name is still stored either way. */
  ref: IngredientRef;

  /** Used for grouping/logic ("water", "sugar", "fruit", etc). */
  category: string;

  /** Editable. Stored as string for input friendliness. */
  brix: NumericInputString;

  /** Primary vs secondary additions (for backsweetening logic etc). */
  secondary: boolean;

  /** The two user-editable inputs + units. */
  amounts: IngredientLineAmounts;
};

export type RecipeUnitDefaultsV2 = {
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
export type AdditiveLineV2 = {
  lineId: string; // stable UI id (client-generated)
  name: string;
  amount: NumericInputString;
  unit: string;
  amountTouched: boolean; // user typed amount manually
  amountDim: AdditiveAmountDim;
};

/* ------------------------------ Stabilizers ------------------------------ */

export type StabilizerTypeV2 = "kmeta" | "nameta";

export type StabilizersV2 = {
  adding: boolean;
  takingPh: boolean;
  phReading: string;
  type: "kmeta" | "nameta";
};

/* --------------------------------- Notes -------------------------------- */

export type NoteLineV2 = {
  lineId: string;
  content: [string, string]; // keep your existing shape
};

export type NotesV2 = {
  primary: NoteLineV2[];
  secondary: NoteLineV2[];
};

/* ----------------------------- RecipeDataV2 ----------------------------- */

/**
 * This is the object you store in DB as json/jsonb.
 * Keep it purely user-editable inputs; compute OG/ABV/offset/etc at runtime.
 */
export type RecipeDataV2 = {
  version: 2;

  unitDefaults: RecipeUnitDefaultsV2;

  ingredients: IngredientLineV2[];

  /** User-editable target FG input (your current FG) */
  fg: NumericInputString;

  additives: AdditiveLineV2[];

  stabilizers: StabilizersV2;

  notes: NotesV2;

  nutrients?: NutrientDataV2; // ✅ add this
  /** Room for future flags without breaking parsing */
  flags?: {
    advanced?: boolean;
    private?: boolean;
  };
};

/* --------------------------- Blank / initial data -------------------------- */

export const blankIngredientLineV2 = (
  defaults: RecipeUnitDefaultsV2,
  patch?: Partial<Omit<IngredientLineV2, "amounts">> & {
    amounts?: Partial<IngredientLineAmounts>;
  }
): IngredientLineV2 => {
  const lineId = patch?.lineId ?? genLineId();

  return {
    lineId,
    name: patch?.name ?? "",
    ref: patch?.ref ?? { kind: "custom" },
    category: patch?.category ?? "water",
    brix: patch?.brix ?? "0",
    secondary: patch?.secondary ?? false,
    amounts: {
      weight: {
        value: patch?.amounts?.weight?.value ?? "0",
        unit: patch?.amounts?.weight?.unit ?? defaults.weight
      },
      volume: {
        value: patch?.amounts?.volume?.value ?? "0.000",
        unit: patch?.amounts?.volume?.unit ?? defaults.volume
      },
      basis: patch?.amounts?.basis ?? "weight"
    }
  };
};

export const blankAdditiveLineV2 = (): AdditiveLineV2 => ({
  lineId: genLineId(),
  name: "",
  amount: "",
  unit: "g",
  amountTouched: false,
  amountDim: "weight"
});

export const blankNoteLineV2 = (): NoteLineV2 => ({
  lineId: genLineId(),
  content: ["", ""]
});

export const initialRecipeDataV2 = (
  defaults: RecipeUnitDefaultsV2 = { weight: "lb", volume: "gal" }
): RecipeDataV2 => ({
  version: 2,
  unitDefaults: defaults,
  ingredients: [
    blankIngredientLineV2(defaults, {
      name: "Water",
      category: "water",
      brix: "0.00",
      ref: { kind: "custom" },
      amounts: { basis: "volume" } // water usually driven by volume
    }),
    blankIngredientLineV2(defaults, {
      name: "Honey",
      category: "sugar",
      brix: "79.60",
      ref: { kind: "custom" },
      amounts: { basis: "weight" } // honey often driven by weight
    })
  ],
  fg: "0.996",
  additives: [blankAdditiveLineV2()],
  stabilizers: {
    adding: false,
    takingPh: false,
    phReading: "3.6",
    type: "kmeta"
  },
  notes: {
    primary: [blankNoteLineV2()],
    secondary: [blankNoteLineV2()]
  },
  nutrients: initialNutrientDataV2()
});

/* ------------------------------ Type guards ------------------------------ */

export const isRecipeDataV2 = (x: unknown): x is RecipeDataV2 => {
  if (!x || typeof x !== "object") return false;
  const obj = x as Record<string, unknown>;
  return obj.version === 2 && Array.isArray(obj.ingredients);
};

export type BlendInput = {
  sg: number;
  volumeL: number;
};
