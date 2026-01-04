import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import type { TempUnits } from "@/lib/brewEnums";
import type { CreateBrewEntryInput } from "@/hooks/reactQuery/useAccountBrews";

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
  }
};
