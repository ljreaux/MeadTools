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
  WEIGHT_TO_KG,
  isEffectivelyEmptyNumericInput,
  calculateHoneyAndWaterL,
  HONEY_BRIX
} from "@/lib/utils/recipeDataCalculations";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
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
import { calcABV, toBrix } from "@/lib/utils/unitConverter";

type HydratePayload = Pick<
  RecipeDataV2,
  "unitDefaults" | "ingredients" | "fg" | "stabilizers"
>;

type RecipeV2ContextValue = {
  data: Pick<
    RecipeDataV2,
    "unitDefaults" | "ingredients" | "fg" | "stabilizers"
  >;

  derived: {
    normalized: ReturnType<typeof normalizeIngredientLine>[];
    primaryInputs: { sg: number; volumeL: number }[];
    secondaryInputs: { sg: number; volumeL: number }[];
    ogPrimary: number;
    primaryVolumeL: number;
    secondaryVolumeL: number;
    totalVolumeL: number;
    primaryVolume: number;
    secondaryVolume: number;
    totalVolume: number;
    volumeUnit: RecipeUnitDefaultsV2["volume"];
    totalForAbv: number;
    backsweetenedFg: number;
    abv: number;
    delle: number;
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
    fillToNext: (lineId: string) => void;
  };
  stabilizers: {
    addingStabilizers: boolean;
    toggleStabilizers: (val: boolean) => void;

    takingPh: boolean;
    toggleTakingPh: (val: boolean) => void;

    phReading: string;
    updatePhReading: (val: string) => void;

    stabilizerType: "kmeta" | "nameta";
    setStabilizerType: (val: "kmeta" | "nameta") => void;

    sorbate: number;
    sulfite: number;
    campden: number;
  };
  setFg: (fg: string) => void;
  setUnitDefaults: (next: RecipeUnitDefaultsV2) => void;
  setIngredientsToTarget: (og: number, volume: number) => void;
  scaleRecipe: (
    targetVolume: number,
    opts?: { mode?: "total" | "primary" }
  ) => void;

  catalog: {
    ingredientList: IngredientCatalogItem[];
    loadingIngredients: boolean;
  };

  meta: {
    isDirty: boolean;
    markSaved: () => void;
    hydrate: (next: HydratePayload) => void;
  };
};

const RecipeV2Context = createContext<RecipeV2ContextValue | null>(null);

export function RecipeV2Provider({ children }: { children: ReactNode }) {
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
  // ---- Stabilizers (inputs only) ----
  const [addingStabilizers, setAddingStabilizers] = useState(
    initial.stabilizers.adding
  );
  const [takingPh, setTakingPh] = useState(initial.stabilizers.takingPh);
  const [phReading, setPhReading] = useState(initial.stabilizers.phReading);
  const [stabilizerType, setStabilizerType] = useState<"kmeta" | "nameta">(
    initial.stabilizers.type
  );
  // ---- Dirty tracking ----
  const [isDirty, setIsDirty] = useState(false);

  const commit = useCallback((fn: () => void, opts?: { silent?: boolean }) => {
    fn();
    if (!opts?.silent) setIsDirty(true);
  }, []);

  const markSaved = useCallback(() => setIsDirty(false), []);

  const hydrate = useCallback(
    (next: HydratePayload) => {
      commit(
        () => {
          setUnitDefaultsState(next.unitDefaults);
          setIngredients(next.ingredients);
          setFgState(next.fg);
          setIsDirty(false);
          setAddingStabilizers(next.stabilizers.adding);
          setTakingPh(next.stabilizers.takingPh);
          setPhReading(next.stabilizers.phReading);
          setStabilizerType(next.stabilizers.type);
        },
        { silent: true }
      );
    },
    [commit]
  );
  const toggleStabilizers = useCallback(
    (val: boolean) => {
      commit(() => setAddingStabilizers(val));
    },
    [commit]
  );

  const toggleTakingPh = useCallback(
    (val: boolean) => {
      commit(() => setTakingPh(val));
    },
    [commit]
  );

  const updatePhReading = useCallback(
    (val: string) => {
      if (!isValidNumber(val)) return;
      commit(() => setPhReading(val));
    },
    [commit]
  );

  const setStabilizerTypeCommitted = useCallback(
    (val: "kmeta" | "nameta") => {
      commit(() => setStabilizerType(val));
    },
    [commit]
  );
  /** ---------------------------
   * Internal helpers
   * --------------------------*/
  const updateLine = useCallback(
    (lineId: string, updater: (line: IngredientLineV2) => IngredientLineV2) => {
      setIngredients((prev) =>
        prev.map((l) => (l.lineId === lineId ? updater(l) : l))
      );
    },
    []
  );

  const removeLine = useCallback((lineId: string) => {
    setIngredients((prev) => prev.filter((l) => l.lineId !== lineId));
  }, []);

  function phToPpm(ph: number) {
    if (ph <= 2.9) return 11;
    if (ph === 3.0) return 13;
    if (ph === 3.1) return 16;
    if (ph === 3.2) return 21;
    if (ph === 3.3) return 26;
    if (ph === 3.4) return 32;
    if (ph === 3.5) return 39;
    if (ph === 3.6) return 50;
    if (ph === 3.7) return 63;
    if (ph === 3.8) return 98;
    return 123; // >= 3.9
  }
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

  const secondaryVolumeL = useMemo(
    () => calculateVolume(secondaryInputs),
    [secondaryInputs]
  );

  const totalVolumeL = useMemo(
    () => primaryVolumeL + secondaryVolumeL,
    [primaryVolumeL, secondaryVolumeL]
  );

  const volumeFactor = useMemo(
    () => L_TO_VOLUME[unitDefaults.volume],
    [unitDefaults.volume]
  );

  const primaryVolume = useMemo(
    () => primaryVolumeL * volumeFactor,
    [primaryVolumeL, volumeFactor]
  );

  const secondaryVolume = useMemo(
    () => secondaryVolumeL * volumeFactor,
    [secondaryVolumeL, volumeFactor]
  );

  const totalVolume = useMemo(
    () => totalVolumeL * volumeFactor,
    [totalVolumeL, volumeFactor]
  );

  const totalForAbv = useMemo(
    () => calculateOriginalGravity([...primaryInputs, ...secondaryInputs]),
    [primaryInputs, secondaryInputs]
  );

  // Secondary blend SG (what V1 called `secondaryVal`)
  const secondarySg = useMemo(
    () => calculateOriginalGravity(secondaryInputs),
    [secondaryInputs]
  );

  // backsweetenedFG = blend(FG over primaryVol) with (secondary blend SG over secondaryVol)
  const backsweetenedFg = useMemo(() => {
    const fgSg = parseNumber(fg); // fg is SG string in V2 (same as V1 recipeData.FG)

    return calculateOriginalGravity([
      { sg: fgSg, volumeL: primaryVolumeL },
      { sg: secondarySg, volumeL: secondaryVolumeL }
    ]);
  }, [fg, primaryVolumeL, secondarySg, secondaryVolumeL]);

  const abv = useMemo(
    () => calcABV(totalForAbv, backsweetenedFg),
    [totalForAbv, backsweetenedFg]
  );

  const delle = useMemo(
    () => toBrix(backsweetenedFg) + 4.5 * abv,
    [backsweetenedFg, abv]
  );

  const stabilizerResults = useMemo(() => {
    if (!addingStabilizers) return { sorbate: 0, sulfite: 0, campden: 0 };

    const ph = Math.round(parseNumber(phReading) * 10) / 10;
    const ppm = phToPpm(ph);

    // ✅ use TOTAL volume (canonical liters)
    const liters = totalVolumeL;
    const gallons = liters / 3.78541;
    const m3 = liters / 1000;

    // ✅ use ABV from derived (backsweetened-aware)
    const sorbate = ((-abv * 25 + 400) / 0.75) * m3;

    const multiplier = stabilizerType === "kmeta" ? 570 : 674;
    const sulfite = (liters * ppm) / multiplier;

    const campden = (ppm / 75) * gallons;

    return { sorbate, sulfite, campden };
  }, [addingStabilizers, phReading, stabilizerType, totalVolumeL, abv]);

  /** ---------------------------
   * Public API (small setters)
   * --------------------------*/
  const ingredientApi = useMemo<RecipeV2ContextValue["ingredient"]>(
    () => ({
      add: () => {
        commit(() => {
          setIngredients((prev) => [
            ...prev,
            blankIngredientLineV2(unitDefaults, { name: "Honey", brix: "79.6" })
          ]);
        });
      },

      remove: (lineId) => {
        commit(() => removeLine(lineId));
      },

      reorder: (next) => {
        commit(() => setIngredients(next));
      },

      setName: (lineId, name) => {
        commit(() => {
          updateLine(lineId, (line) => ({
            ...line,
            name,
            ref: { kind: "custom" }
          }));
        });
      },
      selectCatalog: (lineId, item) => {
        commit(() => {
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
        });
      },

      setBrix: (lineId, brixStr) => {
        if (!isValidNumber(brixStr)) return;

        commit(() => {
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
              const volumeInUnit =
                volumeL * L_TO_VOLUME[next.amounts.volume.unit];

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
        });
      },

      setWeightValue: (lineId, value) => {
        if (!isValidNumber(value)) return;

        commit(() => {
          updateLine(lineId, (line) => {
            if (value === "") {
              return {
                ...line,
                amounts: {
                  ...line.amounts,
                  basis: "weight",
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
            const volumeInUnit =
              volumeL * L_TO_VOLUME[line.amounts.volume.unit];

            return {
              ...line,
              amounts: {
                ...line.amounts,
                basis: "weight",
                weight: { ...line.amounts.weight, value },
                volume: { ...line.amounts.volume, value: fmt(volumeInUnit) }
              }
            };
          });
        });
      },

      setWeightUnit: (lineId, nextUnit) => {
        commit(() => {
          updateLine(lineId, (line) => {
            const prevUnit = line.amounts.weight.unit;
            const prevStr = line.amounts.weight.value;

            // If empty/placeholder, just swap units (no conversion)
            if (isEffectivelyEmptyNumericInput(prevStr)) {
              return {
                ...line,
                amounts: {
                  ...line.amounts,
                  weight: { ...line.amounts.weight, unit: nextUnit }
                }
              };
            }

            // Convert displayed value -> canonical kg -> displayed in nextUnit
            const kg = parseNumber(prevStr) * WEIGHT_TO_KG[prevUnit];
            const nextVal = kg * KG_TO_WEIGHT[nextUnit];

            return {
              ...line,
              amounts: {
                ...line.amounts,
                weight: {
                  ...line.amounts.weight,
                  unit: nextUnit,
                  value: fmt(nextVal)
                }
              }
            };
          });
        });
      },

      setVolumeValue: (lineId, value) => {
        if (!isValidNumber(value)) return;

        commit(() => {
          updateLine(lineId, (line) => {
            if (value === "") {
              return {
                ...line,
                amounts: {
                  ...line.amounts,
                  basis: "volume",
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
            const weightInUnit =
              weightKg * KG_TO_WEIGHT[line.amounts.weight.unit];

            return {
              ...line,
              amounts: {
                ...line.amounts,
                basis: "volume",
                volume: { ...line.amounts.volume, value },
                weight: { ...line.amounts.weight, value: fmt(weightInUnit) }
              }
            };
          });
        });
      },

      setVolumeUnit: (lineId, nextUnit) => {
        commit(() => {
          updateLine(lineId, (line) => {
            const prevUnit = line.amounts.volume.unit;
            const prevStr = line.amounts.volume.value;

            // If empty/placeholder, just swap units (no conversion)
            if (isEffectivelyEmptyNumericInput(prevStr)) {
              return {
                ...line,
                amounts: {
                  ...line.amounts,
                  volume: { ...line.amounts.volume, unit: nextUnit }
                }
              };
            }

            // Convert displayed value -> canonical L -> displayed in nextUnit
            const L = parseNumber(prevStr) * VOLUME_TO_L[prevUnit];
            const nextVal = L * L_TO_VOLUME[nextUnit];

            return {
              ...line,
              amounts: {
                ...line.amounts,
                volume: {
                  ...line.amounts.volume,
                  unit: nextUnit,
                  value: fmt(nextVal)
                }
              }
            };
          });
        });
      },

      setSecondary: (lineId, secondary) => {
        commit(() => {
          updateLine(lineId, (line) => ({ ...line, secondary }));
        });
      },
      fillToNext: (lineId: string) => {
        const line = ingredients.find((l) => l.lineId === lineId);
        if (!line) return;

        // current line volume in L
        const lineVolL =
          parseNumber(line.amounts.volume.value) *
          VOLUME_TO_L[line.amounts.volume.unit];

        // pick which "group" we’re rounding: primary-only vs total
        const groupTotalL = line.secondary ? totalVolumeL : primaryVolumeL;

        // round group total up to next whole GLOBAL unit (unitDefaults.volume)
        const globalUnit = unitDefaults.volume;
        const groupTotalGlobal = groupTotalL * L_TO_VOLUME[globalUnit];
        const targetGlobal = Math.ceil(groupTotalGlobal);
        const targetGroupL = targetGlobal * VOLUME_TO_L[globalUnit];

        // compute what THIS line’s volume would need to be to hit target, keeping others the same
        const desiredLineVolL = targetGroupL - (groupTotalL - lineVolL);

        // if already at/above target (or weird negatives), do nothing
        if (!Number.isFinite(desiredLineVolL) || desiredLineVolL <= lineVolL)
          return;

        // convert desired liters to the line’s own unit for display storage
        const desiredLineVolInLineUnit =
          desiredLineVolL * L_TO_VOLUME[line.amounts.volume.unit];
        const nextVolStr = fmt(desiredLineVolInLineUnit);

        // IMPORTANT: mark that the user intent is volume-driven
        // and reuse your existing setVolumeValue logic so weight sync stays consistent.
        commit(() => {
          updateLine(lineId, (l) => ({
            ...l,
            amounts: { ...l.amounts, basis: "volume" }
          }));
        });

        ingredientApi.setVolumeValue(lineId, nextVolStr);
      }
    }),
    [
      commit,
      unitDefaults,
      updateLine,
      removeLine,
      ingredients,
      totalVolumeL,
      primaryVolumeL
    ]
  );

  const value: RecipeV2ContextValue = useMemo(
    () => ({
      data: {
        unitDefaults,
        ingredients,
        fg,
        stabilizers: {
          adding: addingStabilizers,
          takingPh,
          phReading,
          type: stabilizerType
        }
      },

      derived: {
        normalized,
        primaryInputs,
        secondaryInputs,
        ogPrimary,
        primaryVolumeL,
        secondaryVolumeL,
        totalVolumeL,
        primaryVolume,
        secondaryVolume,
        totalVolume,
        volumeUnit: unitDefaults.volume,
        totalForAbv,
        backsweetenedFg,
        abv,
        delle
      },

      ingredient: ingredientApi,

      stabilizers: {
        addingStabilizers,
        toggleStabilizers,

        takingPh,
        toggleTakingPh,

        phReading,
        updatePhReading,

        stabilizerType,
        setStabilizerType: setStabilizerTypeCommitted,

        sorbate: stabilizerResults.sorbate,
        sulfite: stabilizerResults.sulfite,
        campden: stabilizerResults.campden
      },

      setFg: (next) => {
        if (!isValidNumber(next)) return;
        commit(() => setFgState(next));
      },

      setUnitDefaults: (next) => {
        commit(() => {
          setUnitDefaultsState(next);

          setIngredients((prev) =>
            prev.map((line) => {
              const weightEmpty = isEffectivelyEmptyNumericInput(
                line.amounts.weight.value
              );
              const volumeEmpty = isEffectivelyEmptyNumericInput(
                line.amounts.volume.value
              );

              if (!weightEmpty && !volumeEmpty) return line;

              return {
                ...line,
                amounts: {
                  ...line.amounts,
                  weight: weightEmpty
                    ? { ...line.amounts.weight, unit: next.weight }
                    : line.amounts.weight,
                  volume: volumeEmpty
                    ? { ...line.amounts.volume, unit: next.volume }
                    : line.amounts.volume
                }
              };
            })
          );
        });
      },

      setIngredientsToTarget: (og: number, volume: number) => {
        const totalVolumeL = volume * VOLUME_TO_L[unitDefaults.volume];
        const desiredOg = og;

        const { honeyL, waterL } = calculateHoneyAndWaterL(
          desiredOg,
          totalVolumeL
        );

        const honeySg = toSG(HONEY_BRIX);
        const waterSg = toSG(0);

        const honeyVolInGlobal = honeyL * L_TO_VOLUME[unitDefaults.volume];
        const waterVolInGlobal = waterL * L_TO_VOLUME[unitDefaults.volume];

        const honeyWeightKg = honeyL * honeySg;
        const waterWeightKg = waterL * waterSg;

        const honeyWeightInGlobal =
          honeyWeightKg * KG_TO_WEIGHT[unitDefaults.weight];
        const waterWeightInGlobal =
          waterWeightKg * KG_TO_WEIGHT[unitDefaults.weight];

        const waterLine = blankIngredientLineV2(unitDefaults, {
          name: "Water",
          category: "water",
          brix: "0.00",
          ref: { kind: "custom" },
          secondary: false,
          amounts: {
            basis: "volume",
            volume: { value: fmt(waterVolInGlobal), unit: unitDefaults.volume },
            weight: {
              value: fmt(waterWeightInGlobal),
              unit: unitDefaults.weight
            }
          }
        });

        const honeyLine = blankIngredientLineV2(unitDefaults, {
          name: "Honey",
          category: "sugar",
          brix: HONEY_BRIX.toFixed(2),
          ref: { kind: "custom" },
          secondary: false,
          amounts: {
            basis: "volume",
            volume: { value: fmt(honeyVolInGlobal), unit: unitDefaults.volume },
            weight: {
              value: fmt(honeyWeightInGlobal),
              unit: unitDefaults.weight
            }
          }
        });

        commit(() => {
          setIngredients([waterLine, honeyLine]);
        });
      },

      scaleRecipe: (
        targetVolume: number,
        opts?: { mode?: "total" | "primary" }
      ) => {
        const mode = opts?.mode ?? "total";

        if (!Number.isFinite(targetVolume) || targetVolume <= 0) return;

        const currentBase = mode === "primary" ? primaryVolume : totalVolume;

        if (!Number.isFinite(currentBase) || currentBase <= 0) return;

        const scale = targetVolume / currentBase;

        commit(() => {
          setIngredients((prev) =>
            prev.map((line) => {
              const nextWeight = parseNumber(line.amounts.weight.value) * scale;
              const nextVolume = parseNumber(line.amounts.volume.value) * scale;

              return {
                ...line,
                amounts: {
                  ...line.amounts,
                  weight: { ...line.amounts.weight, value: fmt(nextWeight) },
                  volume: { ...line.amounts.volume, value: fmt(nextVolume) }
                }
              };
            })
          );
        });
      },

      catalog: {
        ingredientList,
        loadingIngredients
      },

      meta: {
        isDirty,
        markSaved,
        hydrate
      }
    }),
    [
      // state
      unitDefaults,
      ingredients,
      fg,
      isDirty,

      // derived
      normalized,
      primaryInputs,
      secondaryInputs,
      ogPrimary,
      primaryVolumeL,
      secondaryVolumeL,
      totalVolumeL,
      primaryVolume,
      secondaryVolume,
      totalVolume,
      totalForAbv,
      backsweetenedFg,
      abv,
      delle,

      // api + helpers used inside
      ingredientApi,
      addingStabilizers,
      takingPh,
      phReading,
      stabilizerType,
      toggleStabilizers,
      toggleTakingPh,
      updatePhReading,
      stabilizerResults,
      ingredientList,
      loadingIngredients,
      markSaved,
      hydrate,
      commit
    ]
  );
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
