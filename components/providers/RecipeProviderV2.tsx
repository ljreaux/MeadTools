"use client";

import {
  IngredientCatalogItem,
  IngredientLineV2,
  RecipeDataV2,
  RecipeUnitDefaultsV2,
  WeightUnit,
  VolumeUnit,
  blankIngredientLineV2,
  initialRecipeDataV2
} from "@/types/recipeDataV2";
import {
  fmt,
  KG_TO_WEIGHT,
  L_TO_VOLUME,
  normalizeIngredientLine,
  VOLUME_TO_L,
  WEIGHT_TO_KG
} from "@/lib/utils/recipeDataCalculations";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  calculateOriginalGravity,
  calculateVolume
} from "@/lib/utils/recipeDataCalculations";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import { useIngredientsQuery } from "@/hooks/reactQuery/useIngredientsQuery";
import { toSG } from "@/lib/utils/unitConverter";

type RecipeV2ContextValue = {
  data: Pick<RecipeDataV2, "unitDefaults" | "ingredients" | "fg">;

  derived: {
    normalized: ReturnType<typeof normalizeIngredientLine>[];
    primaryInputs: { sg: number; volumeL: number }[];
    secondaryInputs: { sg: number; volumeL: number }[];
    ogPrimary: number;
    primaryVolumeL: number;
  };

  ingredient: {
    add: () => void;
    remove: (lineId: string) => void;
    reorder: (next: IngredientLineV2[]) => void;

    setName: (lineId: string, name: string) => void;
    selectCatalog: (lineId: string, item: IngredientCatalogItem) => void;

    setBrix: (lineId: string, brix: string) => void;

    setWeightValue: (lineId: string, value: string) => void;
    setWeightUnit: (lineId: string, unit: WeightUnit) => void;

    setVolumeValue: (lineId: string, value: string) => void;
    setVolumeUnit: (lineId: string, unit: VolumeUnit) => void;

    setSecondary: (lineId: string, secondary: boolean) => void;
  };

  setFg: (fg: string) => void;
  setUnitDefaults: (next: RecipeUnitDefaultsV2) => void;
  catalog: {
    ingredientList: IngredientCatalogItem[];
    loadingIngredients: boolean;
  };
};

const RecipeV2Context = createContext<RecipeV2ContextValue | null>(null);

export function RecipeV2Provider({ children }: { children: ReactNode }) {
  // inside RecipeV2Provider
  const { data: ingredientList = [], isLoading: loadingIngredients } =
    useIngredientsQuery();
  const initial = initialRecipeDataV2({ weight: "lb", volume: "gal" });

  const [unitDefaults, setUnitDefaultsState] = useState<RecipeUnitDefaultsV2>(
    initial.unitDefaults
  );
  const [ingredients, setIngredients] = useState<IngredientLineV2[]>(
    initial.ingredients
  );
  const [fg, setFgState] = useState(initial.fg);

  /** ---------------------------
   * Internal helpers
   * --------------------------*/

  const updateLine = (
    lineId: string,
    updater: (line: IngredientLineV2) => IngredientLineV2
  ) => {
    setIngredients((prev) =>
      prev.map((l) => (l.lineId === lineId ? updater(l) : l))
    );
  };

  const removeLine = (lineId: string) => {
    setIngredients((prev) => prev.filter((l) => l.lineId !== lineId));
  };

  /** ---------------------------
   * Derived (ingredients only)
   * --------------------------*/

  const normalized = useMemo(
    () => ingredients.map(normalizeIngredientLine),
    [ingredients]
  );

  const primaryInputs = useMemo(
    () =>
      normalized
        .filter((l) => !l.secondary)
        .map((l) => ({ sg: l.sg, volumeL: l.volumeL })),
    [normalized]
  );

  const secondaryInputs = useMemo(
    () =>
      normalized
        .filter((l) => l.secondary)
        .map((l) => ({ sg: l.sg, volumeL: l.volumeL })),
    [normalized]
  );

  const ogPrimary = useMemo(
    () => calculateOriginalGravity(primaryInputs),
    [primaryInputs]
  );

  const primaryVolumeL = useMemo(
    () => calculateVolume(primaryInputs),
    [primaryInputs]
  );

  /** ---------------------------
   * Public API (small setters)
   * --------------------------*/

  const ingredientApi: RecipeV2ContextValue["ingredient"] = {
    add: () => {
      setIngredients((prev) => [...prev, blankIngredientLineV2(unitDefaults)]);
    },

    remove: (lineId) => removeLine(lineId),

    reorder: (next) => setIngredients(next),

    setName: (lineId, name) => {
      updateLine(lineId, (line) => ({
        ...line,
        name,
        ref: { kind: "custom" } // once they type, treat as custom unless they reselect
      }));
    },

    selectCatalog: (lineId, item) => {
      updateLine(lineId, (line) => {
        const brix = parseNumber(item.sugar_content);
        return {
          ...line,
          name: item.name,
          ref: { kind: "catalog", ingredientId: item.id },
          category: item.category || line.category,
          brix: Number.isFinite(brix) ? brix.toFixed(2) : line.brix
        };
      });
    },
    setBrix: (lineId, brixStr) => {
      if (!isValidNumber(brixStr)) return;

      updateLine(lineId, (line) => {
        const next = { ...line, brix: brixStr };

        if (brixStr === "") return next;

        const sg = toSG(parseNumber(brixStr));
        const hasVol = next.amounts.volume.value !== "";
        const hasWt = next.amounts.weight.value !== "";

        if (hasVol) {
          const volumeL =
            parseNumber(next.amounts.volume.value) *
            VOLUME_TO_L[next.amounts.volume.unit];

          const weightKg = volumeL * (sg || 0);
          const weightInUnit =
            weightKg * KG_TO_WEIGHT[next.amounts.weight.unit];

          return {
            ...next,
            amounts: {
              ...next.amounts,
              weight: { ...next.amounts.weight, value: fmt(weightInUnit) }
            }
          };
        }

        if (hasWt) {
          const weightKg =
            parseNumber(next.amounts.weight.value) *
            WEIGHT_TO_KG[next.amounts.weight.unit];

          const volumeL = sg ? weightKg / sg : 0;
          const volumeInUnit = volumeL * L_TO_VOLUME[next.amounts.volume.unit];

          return {
            ...next,
            amounts: {
              ...next.amounts,
              volume: { ...next.amounts.volume, value: fmt(volumeInUnit) }
            }
          };
        }

        return next;
      });
    },

    setWeightValue: (lineId, value) => {
      if (!isValidNumber(value)) return;

      updateLine(lineId, (line) => {
        // allow blank mid-edit
        if (value === "") {
          return {
            ...line,
            amounts: {
              ...line.amounts,
              weight: { ...line.amounts.weight, value },
              volume: { ...line.amounts.volume, value: "" }
            }
          };
        }

        const brix = parseNumber(line.brix);
        const sg = toSG(brix);

        const weight = parseNumber(value);
        const weightKg = weight * WEIGHT_TO_KG[line.amounts.weight.unit];

        const volumeL = sg ? weightKg / sg : 0;
        const volumeInUnit = volumeL * L_TO_VOLUME[line.amounts.volume.unit];

        return {
          ...line,
          amounts: {
            ...line.amounts,
            weight: { ...line.amounts.weight, value },
            volume: { ...line.amounts.volume, value: fmt(volumeInUnit) }
          }
        };
      });
    },

    setWeightUnit: (lineId, unit) => {
      updateLine(lineId, (line) => ({
        ...line,
        amounts: {
          ...line.amounts,
          weight: { ...line.amounts.weight, unit }
        }
      }));
    },

    setVolumeValue: (lineId, value) => {
      if (!isValidNumber(value)) return;

      updateLine(lineId, (line) => {
        if (value === "") {
          return {
            ...line,
            amounts: {
              ...line.amounts,
              volume: { ...line.amounts.volume, value },
              weight: { ...line.amounts.weight, value: "" }
            }
          };
        }

        const brix = parseNumber(line.brix);
        const sg = toSG(brix);

        const volume = parseNumber(value);
        const volumeL = volume * VOLUME_TO_L[line.amounts.volume.unit];

        const weightKg = volumeL * (sg || 0);
        const weightInUnit = weightKg * KG_TO_WEIGHT[line.amounts.weight.unit];

        return {
          ...line,
          amounts: {
            ...line.amounts,
            volume: { ...line.amounts.volume, value },
            weight: { ...line.amounts.weight, value: fmt(weightInUnit) }
          }
        };
      });
    },

    setVolumeUnit: (lineId, unit) => {
      updateLine(lineId, (line) => ({
        ...line,
        amounts: {
          ...line.amounts,
          volume: { ...line.amounts.volume, unit }
        }
      }));
    },

    setSecondary: (lineId, secondary) => {
      updateLine(lineId, (line) => ({ ...line, secondary }));
    }
  };

  const value: RecipeV2ContextValue = {
    data: { unitDefaults, ingredients, fg },
    derived: {
      normalized,
      primaryInputs,
      secondaryInputs,
      ogPrimary,
      primaryVolumeL
    },

    ingredient: ingredientApi,

    setFg: (next) => {
      if (!isValidNumber(next)) return;
      setFgState(next);
    },

    setUnitDefaults: (next) => {
      setUnitDefaultsState(next);
    },
    catalog: {
      ingredientList,
      loadingIngredients
    }
  };

  useEffect(() => console.log(value), [value]);

  return (
    <RecipeV2Context.Provider value={value}>
      {children}
    </RecipeV2Context.Provider>
  );
}

export function useRecipeV2() {
  const ctx = useContext(RecipeV2Context);
  if (!ctx)
    throw new Error("useRecipeV2 must be used within a RecipeV2Provider");
  return ctx;
}
