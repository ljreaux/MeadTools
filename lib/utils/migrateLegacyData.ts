import type { RecipeApiResponse } from "@/hooks/reactQuery/useRecipeQuery";
import type {
  NoteLineV2,
  RecipeDataV2,
  VolumeUnit,
  WeightUnit
} from "@/types/recipeDataV2";
import type { NutrientDataV2 } from "@/types/nutrientDataV2";
import { getEffectiveMaxGpl } from "@/types/nutrientDataV2";

// replace with whatever you use today
const genId = () => Math.random().toString(36).slice(2, 12);

const normalizeWeightUnit = (u: string): WeightUnit =>
  u === "lbs" ? "lb" : (u as WeightUnit);
const normalizeVolumeUnit = (u: string): VolumeUnit => u as VolumeUnit; // "gal" already ok in your sample

function selectedNutrientsFromLegacy(arr: string[]) {
  const set = new Set(arr);
  return {
    fermO: set.has("Fermaid O"),
    fermK: set.has("Fermaid K"),
    dap: set.has("DAP"),
    other: set.has("Other")
  };
}

export function migrateLegacyRecipeToV2(
  recipe: RecipeApiResponse
): RecipeDataV2 {
  const legacy = JSON.parse(recipe.recipeData);
  const legacyNutes = JSON.parse(recipe.nutrientData);

  const yan = JSON.parse(
    recipe.yanContribution ?? '["40","100","210","0"]'
  ) as string[];
  const [fermO, fermK, dap, other = "0"] = yan;

  const unitDefaults = {
    weight: normalizeWeightUnit(legacy.units?.weight ?? "lb"),
    volume: normalizeVolumeUnit(legacy.units?.volume ?? "gal")
  };

  const ingredients = (legacy.ingredients ?? []).map((ing: any) => {
    const weight = String(ing.details?.[0] ?? "");
    const volume = String(ing.details?.[1] ?? "");
    const basis = ing.category === "water" ? "volume" : "weight";

    return {
      lineId: genId(),
      name: ing.name,
      ref: { kind: "custom" as const },
      category: ing.category,
      brix: String(ing.brix ?? "0.00"),
      secondary: !!ing.secondary,
      amounts: {
        weight: { value: weight, unit: unitDefaults.weight },
        volume: { value: volume, unit: unitDefaults.volume },
        basis
      }
    };
  });

  const additives = (legacy.additives ?? []).map((a: any) => ({
    lineId: genId(),
    name: a.name,
    amount: String(a.amount ?? "0"),
    unit: a.unit ?? "g",
    amountTouched: false,
    amountDim: "weight" as const
  }));

  const nutrientsSelected = selectedNutrientsFromLegacy(
    legacyNutes?.selected?.selectedNutrients ?? []
  );

  const deltaSg = String(legacyNutes?.inputs?.sg ?? "1.000");

  const nutrientDataV2: NutrientDataV2 = {
    version: 2,
    inputs: {
      volume: String(legacyNutes?.inputs?.volume ?? legacy.volume ?? "1.000"),
      volumeUnits: legacyNutes?.inputs?.units === "gal" ? "gal" : "liter",
      sg: deltaSg,
      offsetPpm: String(legacyNutes?.inputs?.offset ?? "0"),
      numberOfAdditions: String(legacyNutes?.inputs?.numberOfAdditions ?? "1"),
      goFermType: "Go-Ferm",
      yeastAmountG: String(legacyNutes?.outputs?.yeastAmount ?? "0"),
      yeastAmountTouched: false
    },
    selected: {
      yeastBrand: legacyNutes?.selected?.yeastBrand ?? "Other",
      yeastStrain: legacyNutes?.selected?.yeastStrain ?? "Unknown",
      yeastId: legacyNutes?.selected?.yeastDetails?.id,
      nitrogenRequirement: legacyNutes?.selected?.n2Requirement ?? "Low",
      schedule: legacyNutes?.selected?.schedule ?? "tbe",
      selectedNutrients: nutrientsSelected
    },
    settings: {
      yanContribution: { fermO, fermK, dap, other },
      maxGpl: getEffectiveMaxGpl({
        schedule: legacyNutes?.selected?.schedule ?? "tbe",
        sg: deltaSg,
        selected: nutrientsSelected
      }),
      maxGplTouched: false,
      other: { name: "" }
    },
    adjustments: {
      adjustAllowed: false,
      providedYanPpm: { fermO: "0", fermK: "0", dap: "0", other: "0" }
    }
  };

  const notesToV2 = (pairs: any[] | null | undefined): NoteLineV2[] =>
    (pairs ?? []).map((pair: NoteLineV2["content"]) => ({
      lineId: genId(),
      content: Array.isArray(pair) ? pair : (["", ""] as NoteLineV2["content"])
    }));

  return {
    version: 2,
    unitDefaults,
    ingredients,
    fg: String(legacy.FG ?? "1.000"),
    additives,
    stabilizers: {
      adding: false,
      takingPh: false,
      phReading: "",
      type: "kmeta"
    },
    notes: {
      primary: notesToV2(recipe.primaryNotes),
      secondary: notesToV2(recipe.secondaryNotes)
    },
    nutrients: nutrientDataV2,
    flags: { private: !!recipe.private }
  };
}
