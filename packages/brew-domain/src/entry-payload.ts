export type TempUnits = "C" | "F";
export type BrewAdditionKind =
  | "INGREDIENT"
  | "NUTRIENT"
  | "YEAST"
  | "OTHER";
export type BrewAdditionSource =
  | "recipe_ingredient"
  | "recipe_additive"
  | "recipe_nutrient"
  | "recipe_go_ferm"
  | "recipe_yeast"
  | "manual_yeast"
  | "manual";
export type GravityReadingRole = "OG" | "FG" | "GENERAL";
export type GravityReadingSource =
  | "measured"
  | "recipe"
  | "nutrient_basis"
  | "abv_estimate";
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
  name: string;
  amount?: number;
  unit?: string;
  recipeIngredientId?: string;
  recipeAdditiveId?: string;
  meta?: Record<string, unknown>;
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

export type PackagingBottleRow = {
  label: string;
  quantity: number;
  sizeLiters: number;
  totalLiters: number;
  customSizeValue?: number;
  customSizeUnits?: "fl_oz" | "ml" | "liter" | "gallon";
};

export type BrewPackagingData = {
  packagedVolumeLiters: number;
  displayValue?: number;
  displayUnit?: string;
  bottleRows?: PackagingBottleRow[];
};

export type CreateBrewEntryPayload =
  | {
      type: "NOTE" | "TASTING" | "ISSUE";
      datetime?: string;
      title?: string | null;
      note?: string | null;
      data?: Record<string, unknown> | null;
    }
  | {
      type: "GRAVITY";
      datetime?: string;
      title?: string | null;
      note?: string | null;
      gravity: number;
      data?: GravityPayloadOptions | null;
    }
  | {
      type: "VOLUME";
      datetime?: string;
      title?: string | null;
      note?: string | null;
      data: BrewVolumeData;
    }
  | {
      type: "TEMPERATURE";
      datetime?: string;
      title?: string | null;
      note?: string | null;
      temperature: number;
      temp_units: TempUnits;
    }
  | {
      type: "PH";
      datetime?: string;
      title?: string | null;
      note?: string | null;
      data: { ph: number };
    }
  | {
      type: "PACKAGING";
      datetime?: string;
      title?: string | null;
      note?: string | null;
      data: BrewPackagingData;
    }
  | {
      type: "ADDITION";
      datetime?: string;
      title?: string | null;
      note?: string | null;
      data: BrewAdditionData;
    };

type NoteEntryPayload = Extract<
  CreateBrewEntryPayload,
  { type: "NOTE" | "TASTING" | "ISSUE" }
>;
type GravityEntryPayload = Extract<
  CreateBrewEntryPayload,
  { type: "GRAVITY" }
>;
type VolumeEntryPayload = Extract<
  CreateBrewEntryPayload,
  { type: "VOLUME" }
>;
type TemperatureEntryPayload = Extract<
  CreateBrewEntryPayload,
  { type: "TEMPERATURE" }
>;
type PhEntryPayload = Extract<CreateBrewEntryPayload, { type: "PH" }>;
type PackagingEntryPayload = Extract<
  CreateBrewEntryPayload,
  { type: "PACKAGING" }
>;
type AdditionEntryPayload = Extract<
  CreateBrewEntryPayload,
  { type: "ADDITION" }
>;

export const entryPayload = {
  note(
    note: string,
    title: string | null = null,
    data?: Record<string, unknown> | null,
    datetime?: string
  ): NoteEntryPayload {
    return { type: "NOTE", title, note, data: data ?? null, datetime };
  },

  tasting(
    note: string,
    title: string | null = "Tasting",
    datetime?: string
  ): NoteEntryPayload {
    return { type: "TASTING", title, note, datetime };
  },

  issue(
    note: string,
    title: string | null = "Issue",
    datetime?: string
  ): NoteEntryPayload {
    return { type: "ISSUE", title, note, datetime };
  },

  gravity(
    gravity: number,
    note: string | null = null,
    options: GravityPayloadOptions & { datetime?: string } = {}
  ): GravityEntryPayload {
    const readingRole = options.readingRole ?? "GENERAL";
    const source = options.source ?? "measured";
    return {
      type: "GRAVITY",
      title:
        readingRole === "OG"
          ? "Original gravity"
          : readingRole === "FG"
            ? "Final gravity"
            : "Gravity reading",
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

  abvEstimate(
    input: BrewAbvEstimateData & { datetime?: string }
  ): GravityEntryPayload {
    return {
      type: "GRAVITY",
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
  }): VolumeEntryPayload {
    return {
      type: "VOLUME",
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

  temperature(
    temperature: number,
    units: TempUnits,
    note: string | null = null,
    datetime?: string
  ): TemperatureEntryPayload {
    return {
      type: "TEMPERATURE",
      title: "Temperature check",
      datetime,
      temperature,
      temp_units: units,
      note
    };
  },

  ph(
    ph: number,
    note: string | null = null,
    datetime?: string
  ): PhEntryPayload {
    return {
      type: "PH",
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
  }): PackagingEntryPayload {
    return {
      type: "PACKAGING",
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

  addition(input: {
    name: string;
    kind?: BrewAdditionKind;
    source?: BrewAdditionSource;
    amount?: number;
    unit?: string;
    note?: string | null;
    recipeIngredientId?: string;
    recipeAdditiveId?: string;
    meta?: Record<string, unknown>;
    datetime?: string;
  }): AdditionEntryPayload {
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
      type: "ADDITION",
      title: input.name,
      datetime: input.datetime,
      note: input.note ?? null,
      data
    };
  }
};
