import { nanoid } from "nanoid";
import { initialNutrientData, NutrientData } from "./nutrientData";

export const genLineId = () => nanoid(10);

/* ----------------------------- Units ----------------------------- */

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
  brix: NumericInputString;

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
  amount: NumericInputString;
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
  fg: NumericInputString;

  additives: AdditiveLine[];

  stabilizers: Stabilizers;

  notes: Notes;

  nutrients?: NutrientData; // ✅ add this
  /** Room for future flags without breaking parsing */
  flags?: {
    advanced?: boolean;
    private?: boolean;
  };
};

/* --------------------------- Blank / initial data -------------------------- */

export const blankIngredientLine = (
  defaults: RecipeUnitDefaults,
  patch?: Partial<Omit<IngredientLine, "amounts">> & {
    amounts?: Partial<IngredientLineAmounts>;
  }
): IngredientLine => {
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

export const blankAdditiveLine = (): AdditiveLine => ({
  lineId: genLineId(),
  name: "",
  amount: "",
  unit: "g",
  amountTouched: false,
  amountDim: "weight"
});

export const blankNoteLine = (): NoteLine => ({
  lineId: genLineId(),
  content: ["", ""]
});

export const initialRecipeData = (
  defaults: RecipeUnitDefaults = { weight: "lb", volume: "gal" }
): RecipeData => ({
  version: 2,
  unitDefaults: defaults,
  ingredients: [
    blankIngredientLine(defaults, {
      name: "Water",
      category: "water",
      brix: "0.00",
      ref: { kind: "custom" },
      amounts: { basis: "volume" } // water usually driven by volume
    }),
    blankIngredientLine(defaults, {
      name: "Honey",
      category: "sugar",
      brix: "79.60",
      ref: { kind: "custom" },
      amounts: { basis: "weight" } // honey often driven by weight
    })
  ],
  fg: "0.996",
  additives: [blankAdditiveLine()],
  stabilizers: {
    adding: false,
    takingPh: false,
    phReading: "3.6",
    type: "kmeta"
  },
  notes: {
    primary: [blankNoteLine()],
    secondary: [blankNoteLine()]
  },
  nutrients: initialNutrientData()
});

/* ------------------------------ Type guards ------------------------------ */

export const isRecipeData = (x: unknown): x is RecipeData => {
  if (!x || typeof x !== "object") return false;
  const obj = x as Record<string, unknown>;
  return obj.version === 2 && Array.isArray(obj.ingredients);
};

export type BlendInput = {
  sg: number;
  volumeL: number;
};
