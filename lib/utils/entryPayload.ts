import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import type { TempUnits } from "@/lib/brewEnums";
import type { CreateBrewEntryInput } from "@/hooks/reactQuery/useAccountBrews";
import type { PackagingBottleRow } from "@/components/extraCalcs/BottlingCalculator";

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
export type GravityReadingSource = "measured" | "recipe" | "nutrient_basis" | "abv_estimate";
export type GravityEntryUnit = "SG" | "BRIX";

export type GravityEntryDisplayData = {
  enteredValue?: number;
  enteredUnit?: GravityEntryUnit;
  convertedGravity?: number;
  refractometerCorrectionApplied?: boolean;
  correctionFactor?: number;
  ogUsed?: number;
};

export type BrewAbvEstimateData = {
  abv: number;
  og: number;
  fg?: number | null;
  ogEntryId: string;
  fgEntryId?: string | null;
  eventEntryId?: string;
  eventType?: string;
  currentVolumeLiters?: number | null;
  secondaryVolumeLiters?: number | null;
};

export type BrewNutrientBasisData = {
  chosenOg: number;
  suggestedOg: number;
  suggestedOgSource: "actualized_recipe" | "recipe" | "measured";
  estimatedFg: number;
  fermentableSg: number;
  warningAcknowledged: boolean;
};

export type GravityPayloadOptions = {
  readingRole?: GravityReadingRole;
  source?: GravityReadingSource;
  recipeValue?: number;
  hidden?: boolean;
  nutrientBasis?: BrewNutrientBasisData;
  abvEstimate?: BrewAbvEstimateData;
  display?: GravityEntryDisplayData;
};

export type BrewAdditionData = {
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
  source: "recipe_primary_note" | "recipe_secondary_note";
  recipeNoteId: string;
};

export type BrewVolumeData = {
  liters: number;
  displayValue?: number;
  displayUnit?: string;
  startingLiters?: number;
};

export type BrewPackagingData = {
  packagedVolumeLiters: number;
  displayValue?: number;
  displayUnit?: string;
  bottleRows?: PackagingBottleRow[];
};

export const entryPayload = {
  note(note: string, title: string | null = null, data?: Record<string, any> | null, datetime?: string): CreateBrewEntryInput {
    return { type: BREW_ENTRY_TYPE.NOTE, title, note, data: data ?? null, datetime };
  },

  tasting(note: string, title: string | null = "Tasting", datetime?: string): CreateBrewEntryInput {
    return { type: BREW_ENTRY_TYPE.TASTING, title, note, datetime };
  },

  issue(note: string, title: string | null = "Issue", datetime?: string): CreateBrewEntryInput {
    return { type: BREW_ENTRY_TYPE.ISSUE, title, note, datetime };
  },

  gravity(
    gravity: number,
    note: string | null = null,
    options: GravityPayloadOptions & { datetime?: string } = {}
  ): CreateBrewEntryInput {
    const readingRole = options.readingRole ?? "GENERAL";
    const source = options.source ?? "measured";
    return {
      type: BREW_ENTRY_TYPE.GRAVITY,
      title: readingRole === "OG" ? "Original gravity" : readingRole === "FG" ? "Final gravity" : "Gravity reading",
      datetime: options.datetime,
      gravity,
      data: {
        readingRole,
        source,
        recipeValue: options.recipeValue,
        hidden: options.hidden,
        nutrientBasis: options.nutrientBasis,
        abvEstimate: options.abvEstimate,
        display: options.display
      },
      note
    };
  },

  abvEstimate(input: BrewAbvEstimateData & { datetime?: string }): CreateBrewEntryInput {
    return {
      type: BREW_ENTRY_TYPE.GRAVITY,
      title: "Estimated ABV",
      datetime: input.datetime,
      gravity: input.abv,
      data: {
        readingRole: "GENERAL",
        source: "abv_estimate",
        hidden: true,
        abvEstimate: input
      }
    };
  },

  volume(input: {
    liters: number;
    displayValue?: number;
    displayUnit?: string;
    startingLiters?: number;
    note?: string | null;
    datetime?: string;
  }): CreateBrewEntryInput {
    return {
      type: BREW_ENTRY_TYPE.VOLUME,
      title: "Volume recorded",
      datetime: input.datetime,
      note: input.note ?? null,
      data: {
        liters: input.liters,
        displayValue: input.displayValue,
        displayUnit: input.displayUnit,
        startingLiters: input.startingLiters
      }
    };
  },

  temperature(temperature: number, units: TempUnits, note: string | null = null, datetime?: string): CreateBrewEntryInput {
    return {
      type: BREW_ENTRY_TYPE.TEMPERATURE,
      title: "Temperature check",
      datetime,
      temperature,
      temp_units: units,
      note
    };
  },

  ph(ph: number, note: string | null = null, datetime?: string): CreateBrewEntryInput {
    return {
      type: BREW_ENTRY_TYPE.PH,
      title: "pH reading",
      datetime,
      note,
      data: { ph }
    };
  },
  packaging(input: {
    packagedVolumeLiters: number;
    displayValue?: number;
    displayUnit?: string;
    bottleRows?: PackagingBottleRow[];
    note?: string | null;
    datetime?: string;
  }): CreateBrewEntryInput {
    return {
      type: BREW_ENTRY_TYPE.PACKAGING,
      title: "Packaged",
      datetime: input.datetime,
      note: input.note ?? null,
      data: {
        packagedVolumeLiters: input.packagedVolumeLiters,
        displayValue: input.displayValue,
        displayUnit: input.displayUnit,
        bottleRows: input.bottleRows
      }
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
    datetime?: string;
  }): CreateBrewEntryInput => {
    const data: BrewAdditionData = {
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
      datetime: input.datetime,
      note: input.note ?? null,
      data
    };
  }
};
