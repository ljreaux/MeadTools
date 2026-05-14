import calculateRecipeDerivedApiResponse, {
  type RecipeDerivedApiResponse
} from "@/lib/utils/calculateRecipeDerivedApiResponse";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import type {
  BrewAdditionData,
  BrewRecipeNoteData,
  GravityPayloadOptions
} from "@/lib/utils/entryPayload";
import type { RecipeData, IngredientLine, AdditiveLine, Notes } from "@/types/recipeData";
import { isRecipeData } from "@/types/recipeData";
import {
  calculateEffectiveNutrientData,
  type NutrientDerivedState
} from "@/lib/utils/calculateNutrientDerivedState";
import type { NutrientData } from "@/types/nutrientData";

export type BrewRecipeSnapshot = {
  id: number;
  name: string;
  version: number;
  dataV2: RecipeData | null;
  snapshottedAt: string;
  source?: string;
};

export type BrewRecipeStageData = {
  snapshot: BrewRecipeSnapshot | null;
  recipeData: RecipeData | null;
  derived: RecipeDerivedApiResponse["derived"] | null;
  planned: {
    ingredients: IngredientLine[];
    primaryIngredients: IngredientLine[];
    secondaryIngredients: IngredientLine[];
    additives: AdditiveLine[];
    notes: Notes | null;
    primaryNotes: Notes["primary"];
    secondaryNotes: Notes["secondary"];
    nutrients: NutrientData | null;
    yeast: BrewPlannedYeast | null;
    nutrientPlan: BrewPlannedNutrientPlan | null;
    stabilizerPlan: BrewPlannedStabilizerPlan | null;
  };
  actual: {
    currentVolumeL: number | null;
    latestGravity: number | null;
    additions: BrewLoggedAddition[];
    recipeLinkedAdditions: BrewLoggedAddition[];
    loggedRecipeIngredientIds: string[];
    additionsByRecipeIngredientId: Record<string, BrewLoggedAddition[]>;
    loggedRecipeAdditiveIds: string[];
    additionsByRecipeAdditiveId: Record<string, BrewLoggedAddition[]>;
    loggedRecipePrimaryNoteIds: string[];
    yeastAddition: BrewLoggedAddition | null;
    goFermAddition: BrewLoggedAddition | null;
    loggedNutrientAdditionIndexes: number[];
    originalGravity: BrewLoggedGravity | null;
    finalGravity: BrewLoggedGravity | null;
  };
  effective: {
    currentVolumeL: number | null;
    latestGravity: number | null;
  };
};

export type BrewStageEntryInput = {
  id: string;
  datetime?: string;
  type: string;
  title: string | null;
  note: string | null;
  gravity: number | null;
  data: unknown;
};

export type BrewLoggedGravity = {
  entryId: string;
  datetime: string | null;
  gravity: number;
  readingRole: NonNullable<GravityPayloadOptions["readingRole"]>;
  source: NonNullable<GravityPayloadOptions["source"]>;
};

export type BrewLoggedAddition = {
  entryId: string;
  datetime: string | null;
  title: string | null;
  note: string | null;
  name: string;
  kind: BrewAdditionData["kind"] | null;
  amount: number | null;
  unit: string | null;
  recipeIngredientId: string | null;
  recipeAdditiveId: string | null;
  source: BrewAdditionData["source"] | null;
  meta: Record<string, any> | null;
};

export type BrewPlannedYeast = {
  brand: string;
  strain: string;
  yeastId: number | null;
  nitrogenRequirement: NutrientData["selected"]["nitrogenRequirement"];
  plannedAmountG: number | null;
  source: "recipe_nutrients";
};

export type BrewPlannedNutrientPlan = {
  data: NutrientData;
  effectiveData: NutrientData;
  derived: NutrientDerivedState;
  source: "recipe_nutrients";
};

export type BrewPlannedStabilizerPlan = {
  enabled: boolean;
  type: RecipeData["stabilizers"]["type"];
  phReading: string;
  takingPh: boolean;
  derived: RecipeDerivedApiResponse["derived"]["stabilizers"];
  source: "recipe_stabilizers";
};

const EMPTY_STAGE_DATA: BrewRecipeStageData = {
  snapshot: null,
  recipeData: null,
  derived: null,
  planned: {
    ingredients: [],
    primaryIngredients: [],
    secondaryIngredients: [],
    additives: [],
    notes: null,
    primaryNotes: [],
    secondaryNotes: [],
    nutrients: null,
    yeast: null,
    nutrientPlan: null,
    stabilizerPlan: null
  },
  actual: {
    currentVolumeL: null,
    latestGravity: null,
    additions: [],
    recipeLinkedAdditions: [],
    loggedRecipeIngredientIds: [],
    additionsByRecipeIngredientId: {},
    loggedRecipeAdditiveIds: [],
    additionsByRecipeAdditiveId: {},
    loggedRecipePrimaryNoteIds: [],
    yeastAddition: null,
    goFermAddition: null,
    loggedNutrientAdditionIndexes: [],
    originalGravity: null,
    finalGravity: null
  },
  effective: {
    currentVolumeL: null,
    latestGravity: null
  }
};

function getLatestGravity(args: {
  entries: BrewStageEntryInput[];
  latestGravity: number | null | undefined;
}) {
  if (typeof args.latestGravity === "number" && Number.isFinite(args.latestGravity)) {
    return args.latestGravity;
  }

  const latestEntry = args.entries
    .filter((entry) => typeof entry.gravity === "number" && Number.isFinite(entry.gravity))
    .sort((a, b) => {
      const aTime = a.datetime ? new Date(a.datetime).getTime() : 0;
      const bTime = b.datetime ? new Date(b.datetime).getTime() : 0;
      return bTime - aTime;
    })[0];

  return latestEntry?.gravity ?? null;
}

function getLoggedGravities(entries: BrewStageEntryInput[]) {
  const gravities: BrewLoggedGravity[] = [];

  for (const entry of entries) {
    if (entry.type !== BREW_ENTRY_TYPE.GRAVITY) continue;
    if (typeof entry.gravity !== "number" || !Number.isFinite(entry.gravity)) {
      continue;
    }

    const data = entry.data as Partial<GravityPayloadOptions> | null | undefined;
    const readingRole = data?.readingRole ?? "GENERAL";
    const source = data?.source ?? "measured";

    gravities.push({
      entryId: entry.id,
      datetime: entry.datetime ?? null,
      gravity: entry.gravity,
      readingRole,
      source
    });
  }

  return gravities.sort((a, b) => {
    const aTime = a.datetime ? new Date(a.datetime).getTime() : 0;
    const bTime = b.datetime ? new Date(b.datetime).getTime() : 0;
    return bTime - aTime;
  });
}

function getLoggedRecipePrimaryNoteIds(entries: BrewStageEntryInput[]) {
  const ids = new Set<string>();

  for (const entry of entries) {
    if (entry.type !== BREW_ENTRY_TYPE.NOTE) continue;

    const data = entry.data as Partial<BrewRecipeNoteData> | null | undefined;
    if (data?.source !== "recipe_primary_note") continue;
    if (typeof data.recipeNoteId === "string" && data.recipeNoteId.trim()) {
      ids.add(data.recipeNoteId);
    }
  }

  return Array.from(ids);
}

function getLoggedAdditions(entries: BrewStageEntryInput[]) {
  const additions: BrewLoggedAddition[] = [];

  for (const entry of entries) {
    if (entry.type !== BREW_ENTRY_TYPE.ADDITION) continue;

    const data = entry.data as Partial<BrewAdditionData> | null | undefined;
    const name = typeof data?.name === "string" && data.name.trim()
      ? data.name.trim()
      : (entry.title ?? "").trim();

    if (!name) continue;

    additions.push({
      entryId: entry.id,
      datetime: entry.datetime ?? null,
      title: entry.title,
      note: entry.note,
      name,
      kind: data?.kind ?? null,
      amount:
        typeof data?.amount === "number" && Number.isFinite(data.amount)
          ? data.amount
          : null,
      unit: typeof data?.unit === "string" && data.unit.trim() ? data.unit : null,
      recipeIngredientId:
        typeof data?.recipeIngredientId === "string" && data.recipeIngredientId.trim()
          ? data.recipeIngredientId
          : null,
      recipeAdditiveId:
        typeof data?.recipeAdditiveId === "string" && data.recipeAdditiveId.trim()
          ? data.recipeAdditiveId
          : null,
      source: data?.source ?? null,
      meta:
        data?.meta && typeof data.meta === "object" && !Array.isArray(data.meta)
          ? data.meta
          : null
    });
  }

  return additions;
}

export function buildBrewRecipeStageData(args: {
  recipeSnapshot: BrewRecipeSnapshot | null | undefined;
  currentVolumeLiters: number | null | undefined;
  latestGravity: number | null | undefined;
  entries: BrewStageEntryInput[] | null | undefined;
}): BrewRecipeStageData {
  const entries = args.entries ?? [];
  const actualCurrentVolume =
    typeof args.currentVolumeLiters === "number" &&
    Number.isFinite(args.currentVolumeLiters) &&
    args.currentVolumeLiters > 0
      ? args.currentVolumeLiters
      : null;
  const actualLatestGravity = getLatestGravity({
    entries,
    latestGravity: args.latestGravity
  });
  const loggedGravities = getLoggedGravities(entries);
  const originalGravity = loggedGravities.find((entry) => entry.readingRole === "OG") ?? null;
  const finalGravity =
    loggedGravities.find(
      (entry) => entry.readingRole === "FG" && entry.source === "measured"
    ) ?? null;
  const additions = getLoggedAdditions(entries);
  const recipeLinkedAdditions = additions.filter((addition) => addition.recipeIngredientId);
  const additionsByRecipeIngredientId = recipeLinkedAdditions.reduce<Record<string, BrewLoggedAddition[]>>(
    (acc, addition) => {
      const recipeIngredientId = addition.recipeIngredientId!;
      if (!acc[recipeIngredientId]) acc[recipeIngredientId] = [];
      acc[recipeIngredientId].push(addition);
      return acc;
    },
    {}
  );
  const loggedRecipeIngredientIds = Object.keys(additionsByRecipeIngredientId);
  const additiveLinkedAdditions = additions.filter((addition) => addition.recipeAdditiveId);
  const additionsByRecipeAdditiveId = additiveLinkedAdditions.reduce<Record<string, BrewLoggedAddition[]>>(
    (acc, addition) => {
      const recipeAdditiveId = addition.recipeAdditiveId!;
      if (!acc[recipeAdditiveId]) acc[recipeAdditiveId] = [];
      acc[recipeAdditiveId].push(addition);
      return acc;
    },
    {}
  );
  const loggedRecipeAdditiveIds = Object.keys(additionsByRecipeAdditiveId);
  const loggedRecipePrimaryNoteIds = getLoggedRecipePrimaryNoteIds(entries);
  const yeastAddition = additions.find((addition) => addition.kind === "YEAST") ?? null;
  const goFermAddition =
    additions.find(
      (addition) =>
        addition.source === "recipe_go_ferm" ||
        addition.meta?.goFerm === true
    ) ?? null;
  const loggedNutrientAdditionIndexes = Array.from(
    new Set(
      additions
        .filter((addition) => addition.kind === "NUTRIENT")
        .map((addition) => addition.meta?.nutrientAdditionIndex)
        .filter((index): index is number => typeof index === "number" && Number.isFinite(index))
    )
  ).sort((a, b) => a - b);

  const snapshot = args.recipeSnapshot ?? null;
  const snapshotData = snapshot?.dataV2;

  if (!snapshot || !isRecipeData(snapshotData)) {
    return {
      ...EMPTY_STAGE_DATA,
      actual: {
        currentVolumeL: actualCurrentVolume,
        latestGravity: actualLatestGravity,
        additions,
        recipeLinkedAdditions,
        loggedRecipeIngredientIds,
        additionsByRecipeIngredientId,
        loggedRecipeAdditiveIds,
        additionsByRecipeAdditiveId,
        loggedRecipePrimaryNoteIds,
        yeastAddition,
        goFermAddition,
        loggedNutrientAdditionIndexes,
        originalGravity,
        finalGravity
      },
      effective: {
        currentVolumeL: actualCurrentVolume,
        latestGravity: actualLatestGravity
      }
    };
  }

  const derivedResponse = calculateRecipeDerivedApiResponse(snapshotData);
  const nutrientData = derivedResponse.recipeData.nutrients ?? null;
  const effectiveNutrientData = nutrientData
    ? calculateEffectiveNutrientData(nutrientData)
    : null;
  const ingredients = derivedResponse.recipeData.ingredients;
  const primaryIngredients = ingredients.filter((line) => !line.secondary);
  const secondaryIngredients = ingredients.filter((line) => line.secondary);
  const plannedCurrentVolume = derivedResponse.derived.volume.totalL;
  const plannedYeast =
    effectiveNutrientData &&
    (effectiveNutrientData.selected.yeastBrand.trim().length > 0 ||
      effectiveNutrientData.selected.yeastStrain.trim().length > 0)
      ? {
          brand: effectiveNutrientData.selected.yeastBrand,
          strain: effectiveNutrientData.selected.yeastStrain,
          yeastId: effectiveNutrientData.selected.yeastId ?? null,
          nitrogenRequirement: effectiveNutrientData.selected.nitrogenRequirement,
          plannedAmountG:
            effectiveNutrientData.inputs.yeastAmountG.trim().length > 0 &&
            Number.isFinite(Number(effectiveNutrientData.inputs.yeastAmountG))
              ? Number(effectiveNutrientData.inputs.yeastAmountG)
              : null,
          source: "recipe_nutrients" as const
        }
      : null;
  const plannedNutrientPlan = nutrientData && effectiveNutrientData
    ? {
        data: nutrientData,
        effectiveData: effectiveNutrientData,
        derived: derivedResponse.derived.nutrients,
        source: "recipe_nutrients" as const
      }
    : null;
  const plannedStabilizerPlan = {
    enabled: derivedResponse.recipeData.stabilizers.adding,
    type: derivedResponse.recipeData.stabilizers.type,
    phReading: derivedResponse.recipeData.stabilizers.phReading,
    takingPh: derivedResponse.recipeData.stabilizers.takingPh,
    derived: derivedResponse.derived.stabilizers,
    source: "recipe_stabilizers" as const
  };

  return {
    snapshot,
    recipeData: derivedResponse.recipeData,
    derived: derivedResponse.derived,
    planned: {
      ingredients,
      primaryIngredients,
      secondaryIngredients,
      additives: derivedResponse.recipeData.additives,
      notes: derivedResponse.recipeData.notes,
      primaryNotes: derivedResponse.recipeData.notes.primary,
      secondaryNotes: derivedResponse.recipeData.notes.secondary,
      nutrients: nutrientData,
      yeast: plannedYeast,
      nutrientPlan: plannedNutrientPlan,
      stabilizerPlan: plannedStabilizerPlan
    },
    actual: {
      currentVolumeL: actualCurrentVolume,
      latestGravity: actualLatestGravity,
      additions,
      recipeLinkedAdditions,
      loggedRecipeIngredientIds,
      additionsByRecipeIngredientId,
      loggedRecipeAdditiveIds,
      additionsByRecipeAdditiveId,
      loggedRecipePrimaryNoteIds,
      yeastAddition,
      goFermAddition,
      loggedNutrientAdditionIndexes,
      originalGravity,
      finalGravity
    },
    effective: {
      currentVolumeL: actualCurrentVolume ?? plannedCurrentVolume,
      latestGravity: actualLatestGravity
    }
  };
}
