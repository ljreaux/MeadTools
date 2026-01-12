import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import type { TempUnits } from "@/lib/brewEnums";
import type { CreateBrewEntryInput } from "@/hooks/reactQuery/useAccountBrews";

type BrewAdditionKind = "INGREDIENT" | "NUTRIENT" | "OTHER";

export type BrewAdditionData = {
  v: 1;

  kind: BrewAdditionKind;

  // display + matching
  name: string;

  // optional measured amount
  amount?: number;
  unit?: string;

  // optional “link” back to recipe line later (not required yet)
  recipeIngredientId?: string;

  // room for future without schema churn
  meta?: Record<string, any>;
};

export const entryPayload = {
  note(note: string, title: string | null = null): CreateBrewEntryInput {
    return { type: BREW_ENTRY_TYPE.NOTE, title, note };
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

  gravity(gravity: number, note: string | null = null): CreateBrewEntryInput {
    return {
      type: BREW_ENTRY_TYPE.GRAVITY,
      title: "Gravity reading",
      gravity,
      note
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
    amount?: number;
    unit?: string;
    note?: string | null;
    recipeIngredientId?: string;
    meta?: Record<string, any>;
  }): CreateBrewEntryInput => {
    const data: BrewAdditionData = {
      v: 1,
      kind: input.kind ?? "INGREDIENT",
      name: input.name,
      amount: input.amount,
      unit: input.unit,
      recipeIngredientId: input.recipeIngredientId,
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
