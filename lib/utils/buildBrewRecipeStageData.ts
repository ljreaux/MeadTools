import calculateRecipeDerivedApiResponse, {
  type RecipeDerivedApiResponse
} from "@/lib/utils/calculateRecipeDerivedApiResponse";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import type { BrewAdditionData } from "@/lib/utils/entryPayload";
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
    additionsByRecipeIngredientId: {}
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
        additionsByRecipeIngredientId
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
      additionsByRecipeIngredientId
    },
    effective: {
      currentVolumeL: actualCurrentVolume ?? plannedCurrentVolume,
      latestGravity: actualLatestGravity
    }
  };
}
