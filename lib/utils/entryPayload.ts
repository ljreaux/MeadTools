import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import type { TempUnits } from "@/lib/brewEnums";
import type { CreateBrewEntryInput } from "@/hooks/reactQuery/useAccountBrews";

type BrewAdditionKind = "INGREDIENT" | "NUTRIENT" | "YEAST" | "OTHER";
export type BrewAdditionSource =
  | "recipe_ingredient"
  | "recipe_additive"
  | "recipe_nutrient"
  | "recipe_go_ferm"
  | "recipe_yeast"
  | "manual_yeast"
  | "manual";
export type GravityReadingRole = "OG" | "FG" | "GENERAL";
export type GravityReadingSource = "measured" | "recipe";

export type GravityPayloadOptions = {
  readingRole?: GravityReadingRole;
  source?: GravityReadingSource;
  recipeValue?: number;
};

export type BrewAdditionData = {
  v: 1;

  kind: BrewAdditionKind;
  source?: BrewAdditionSource;

  // display + matching
  name: string;

  // optional measured amount
  amount?: number;
  unit?: string;

  // optional “link” back to recipe line later (not required yet)
  recipeIngredientId?: string;
  recipeAdditiveId?: string;

  // room for future without schema churn
  meta?: Record<string, any>;
};

export type BrewRecipeNoteData = {
  v: 1;
  source: "recipe_primary_note";
  recipeNoteId: string;
};

export type BrewVolumeData = {
  v: 1;
  liters: number;
  displayValue?: number;
  displayUnit?: string;
  startingLiters?: number;
};

export const entryPayload = {
  note(
    note: string,
    title: string | null = null,
    data?: Record<string, any> | null
  ): CreateBrewEntryInput {
    return { type: BREW_ENTRY_TYPE.NOTE, title, note, data: data ?? null };
  },

  tasting(
    note: string,
    title: string | null = "Tasting"
  ): CreateBrewEntryInput {
    return { type: BREW_ENTRY_TYPE.TASTING, title, note };
  },

  issue(note: string, title: string | null = "Issue"): CreateBrewEntryInput {
    return { type: BREW_ENTRY_TYPE.ISSUE, title, note };
  },

  gravity(
    gravity: number,
    note: string | null = null,
    options: GravityPayloadOptions = {}
  ): CreateBrewEntryInput {
    const readingRole = options.readingRole ?? "GENERAL";
    const source = options.source ?? "measured";
    return {
      type: BREW_ENTRY_TYPE.GRAVITY,
      title:
        readingRole === "OG"
          ? "Original gravity"
          : readingRole === "FG"
            ? "Final gravity"
            : "Gravity reading",
      gravity,
      data: {
        v: 1,
        readingRole,
        source,
        recipeValue: options.recipeValue
      },
      note
    };
  },

  volume(input: {
    liters: number;
    displayValue?: number;
    displayUnit?: string;
    startingLiters?: number;
    note?: string | null;
  }): CreateBrewEntryInput {
    return {
      type: BREW_ENTRY_TYPE.VOLUME,
      title: "Volume recorded",
      note: input.note ?? null,
      data: {
        v: 1,
        liters: input.liters,
        displayValue: input.displayValue,
        displayUnit: input.displayUnit,
        startingLiters: input.startingLiters
      }
    };
  },

  temperature(
    temperature: number,
    units: TempUnits,
    note: string | null = null
  ): CreateBrewEntryInput {
    return {
      type: BREW_ENTRY_TYPE.TEMPERATURE,
      title: "Temperature check",
      temperature,
      temp_units: units,
      note
    };
  },

  ph(ph: number, note: string | null = null): CreateBrewEntryInput {
    return {
      type: BREW_ENTRY_TYPE.PH,
      title: "pH reading",
      note,
      data: { ph }
    };
  },
  addition: (input: {
    name: string;
    kind?: BrewAdditionKind;
    source?: BrewAdditionSource;
    amount?: number;
    unit?: string;
    note?: string | null;
    recipeIngredientId?: string;
    recipeAdditiveId?: string;
    meta?: Record<string, any>;
  }): CreateBrewEntryInput => {
    const data: BrewAdditionData = {
      v: 1,
      kind: input.kind ?? "INGREDIENT",
      source: input.source,
      name: input.name,
      amount: input.amount,
      unit: input.unit,
      recipeIngredientId: input.recipeIngredientId,
      recipeAdditiveId: input.recipeAdditiveId,
      meta: input.meta
    };

    return {
      type: BREW_ENTRY_TYPE.ADDITION,
      title: input.name, // ✅ this keeps your existing UI working
      note: input.note ?? null,
      data
    };
  }
};
