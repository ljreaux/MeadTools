"use client";

import {
  IngredientCatalogItem,
  IngredientLine,
  RecipeData,
  RecipeUnitDefaults,
  WeightUnit,
  VolumeUnit,
  blankIngredientLine,
  initialRecipeData,
  AdditiveLine,
  Notes,
  blankAdditiveLine,
  blankNoteLine,
  AdditiveCatalogItem,
  NoteLine
} from "@/types/recipeData";
import {
  fmt,
  KG_TO_WEIGHT,
  L_TO_VOLUME,
  normalizeIngredientLine,
  VOLUME_TO_L,
  WEIGHT_TO_KG,
  isEffectivelyEmptyNumericInput,
  calculateHoneyAndWaterL,
  HONEY_BRIX,
  dosageToAmount,
  convertAdditiveAmount,
  inferAdditiveAmountDimFromUnit,
  shouldConvertAdditiveAmount,
  nextAdditiveAmountDimOnUnitChange
} from "@/lib/utils/recipeDataCalculations";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef
} from "react";
import {
  calculateOriginalGravity,
  calculateVolume
} from "@/lib/utils/recipeDataCalculations";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import { useIngredientsQuery } from "@/hooks/reactQuery/useIngredientsQuery";
import { useAdditivesQuery } from "@/hooks/reactQuery/useAdditivesQuery";
import { toSG } from "@/lib/utils/unitConverter";
import { calcABV, toBrix } from "@/lib/utils/unitConverter";
import { initialNutrientData, NutrientData } from "@/types/nutrientData";

type HydratePayload = Pick<
  RecipeData,
  | "unitDefaults"
  | "ingredients"
  | "fg"
  | "additives"
  | "notes"
  | "stabilizers"
  | "nutrients"
>;

type RecipeContextValue = {
  data: Pick<
    RecipeData,
    | "unitDefaults"
    | "ingredients"
    | "fg"
    | "stabilizers"
    | "additives"
    | "notes"
    | "nutrients"
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
    volumeUnit: RecipeUnitDefaults["volume"];
    totalForAbv: number;
    backsweetenedFg: number;
    abv: number;
    delle: number;
    nutrientValueForRecipe: NutrientData;
  };

  ingredient: {
    add: () => void;
    remove: (lineId: string) => void;
    reorder: (next: IngredientLine[]) => void;

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
  additives: {
    add: () => void;
    remove: (lineId: string) => void;
    reorder: (next: AdditiveLine[]) => void;

    setName: (lineId: string, name: string) => void;
    setAmount: (lineId: string, amount: string) => void;
    setUnit: (lineId: string, unit: string) => void;
  };

  notes: {
    primary: {
      add: () => void;
      remove: (lineId: string) => void;
      setText: (lineId: string, text: string) => void;
      setDetails: (lineId: string, details: string) => void;
      reorder: (next: NoteLine[]) => void;
    };
    secondary: {
      add: () => void;
      remove: (lineId: string) => void;
      setText: (lineId: string, text: string) => void;
      setDetails: (lineId: string, details: string) => void;
      reorder: (next: NoteLine[]) => void;
    };
  };
  setFg: (fg: string) => void;
  setUnitDefaults: (next: RecipeUnitDefaults) => void;
  setIngredientsToTarget: (og: number, volume: number) => void;
  adjustSecondaryToTargetBacksweetenedFg: (sg: number) => void;
  setPrimaryTargetsWithRatios: (props: {
    targetOg: number;
    targetVolume: number;
    ratios: { lineId: string; pct: number }[];
  }) => void;
  scaleRecipe: (
    targetVolume: number,
    opts?: { mode?: "total" | "primary" }
  ) => void;

  catalog: {
    ingredientList: IngredientCatalogItem[];
    loadingIngredients: boolean;
    additiveList: AdditiveCatalogItem[];
    loadingAdditives: boolean;
  };

  meta: {
    isDirty: boolean;
    markSaved: () => void;
    markDirty: () => void;
    hydrate: (next: HydratePayload) => void;
    reset: () => void;

    setNutrients: (next: NutrientData, opts?: { silent?: boolean }) => void;
  };
};
type PreferredUnits = "US" | "METRIC";

function preferredToUnitDefaults(
  preferred: PreferredUnits | null
): RecipeUnitDefaults {
  return preferred === "METRIC"
    ? { weight: "kg", volume: "L" }
    : { weight: "lb", volume: "gal" };
}

const RecipeContext = createContext<RecipeContextValue | null>(null);

export function RecipeProvider({ children }: { children: ReactNode }) {
  const { data: ingredientList = [], isLoading: loadingIngredients } =
    useIngredientsQuery();
  const { data: additiveList = [], isLoading: loadingAdditives } =
    useAdditivesQuery();
  const hydratingRef = useRef(false);
  const didMountRef = useRef(false);
  // fallback for SSR + first paint
  const [preferredDefaults, setPreferredDefaults] =
    useState<RecipeUnitDefaults>({
      weight: "lb",
      volume: "gal"
    });

  useEffect(() => {
    try {
      const preferred = localStorage.getItem("units") as PreferredUnits | null;
      setPreferredDefaults(preferredToUnitDefaults(preferred));
    } catch {
      // ignore
    }
  }, []);

  const initial = initialRecipeData({ weight: "lb", volume: "gal" });

  const [unitDefaults, setUnitDefaultsState] = useState<RecipeUnitDefaults>(
    initial.unitDefaults
  );
  const [ingredients, setIngredients] = useState<IngredientLine[]>(
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
  const [additives, setAdditives] = useState<AdditiveLine[]>(initial.additives);
  const [notes, setNotes] = useState<Notes>(initial.notes);

  const [nutrients, setNutrients] = useState<NutrientData>(
    initialNutrientData()
  );

  // ---- Dirty tracking ----
  const [isDirty, setIsDirty] = useState(false);

  const commit = useCallback((fn: () => void, opts?: { silent?: boolean }) => {
    fn();
    if (!opts?.silent) setIsDirty(true);
  }, []);

  const markSaved = useCallback(() => setIsDirty(false), []);
  const markDirty = useCallback(() => setIsDirty(true), []);
  const hydrate = useCallback(
    (next: HydratePayload) => {
      hydratingRef.current = true;
      commit(
        () => {
          setUnitDefaultsState(next.unitDefaults);
          setIngredients(next.ingredients);
          setFgState(next.fg);

          setAdditives(next.additives);
          setNotes(next.notes);

          setAddingStabilizers(next.stabilizers.adding);
          setTakingPh(next.stabilizers.takingPh);
          setPhReading(next.stabilizers.phReading);
          setStabilizerType(next.stabilizers.type);
          setNutrients(next.nutrients ?? initialNutrientData());

          setIsDirty(false);
        },
        { silent: true }
      );
      queueMicrotask(() => {
        hydratingRef.current = false;
      });
    },
    [commit]
  );

  const reset = useCallback(() => {
    hydratingRef.current = true;
    commit(
      () => {
        const fresh = initialRecipeData(preferredDefaults);

        setUnitDefaultsState(fresh.unitDefaults);
        setIngredients(fresh.ingredients);
        setFgState(fresh.fg);

        setAdditives(fresh.additives);
        setNotes(fresh.notes);

        setAddingStabilizers(fresh.stabilizers.adding);
        setTakingPh(fresh.stabilizers.takingPh);
        setPhReading(fresh.stabilizers.phReading);
        setStabilizerType(fresh.stabilizers.type);

        setNutrients(fresh.nutrients ?? initialNutrientData()); // ✅ add

        setIsDirty(false);
      },
      { silent: true }
    );
    queueMicrotask(() => {
      hydratingRef.current = false;
    });
  }, [commit, preferredDefaults]);

  const toggleStabilizers = useCallback(
    (val: boolean) => {
      commit(() => setAddingStabilizers(val));
    },
    [commit]
  );

  const toggleTakingPh = useCallback(
    (val: boolean) => {
      commit(() => {
        setTakingPh(val);

        // if user turns off pH tracking, reset to default
        if (!val) setPhReading("3.6");
      });
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
    (lineId: string, updater: (line: IngredientLine) => IngredientLine) => {
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
    const fgSg = parseNumber(fg);

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

  // --- NUTRIENTS: recipe-derived inputs for the embedded calculator (VIEW ONLY) ---
  const nutrientVolumeUnits: NutrientData["inputs"]["volumeUnits"] =
    unitDefaults.volume === "gal" ? "gal" : "liter";

  // delta gravity: 1 + (OG_primary - FG)
  // ex: 1.100 -> 0.996 => 1 + (0.104) = 1.104
  // ex: 1.100 -> 1.010 => 1 + (0.090) = 1.090
  const nutrientSg = useMemo(() => {
    const fgSg = parseNumber(fg);
    const og = ogPrimary;

    if (!Number.isFinite(og) || !Number.isFinite(fgSg)) return 1;

    return 1 + (og - fgSg);
  }, [ogPrimary, fg]);

  const nutrientValueForRecipe = useMemo<NutrientData>(() => {
    return {
      ...nutrients,
      inputs: {
        ...nutrients.inputs,

        // override these 3 from recipe-derived values
        volume: fmt(primaryVolume),
        volumeUnits: nutrientVolumeUnits,
        sg: fmt(nutrientSg)
      }
    };
  }, [nutrients, primaryVolume, nutrientVolumeUnits, nutrientSg]);

  // --- Default offset (25 ppm per lb of PRIMARY fruit per gal of PRIMARY volume) ---
  const defaultOffsetPpm = useMemo(() => {
    // primary volume in gallons (canonical liters -> gal)
    const primaryVolGal = primaryVolumeL / 3.78541;
    if (!Number.isFinite(primaryVolGal) || primaryVolGal <= 0) return "0";

    // total PRIMARY fruit weight in pounds
    // NOTE: normalizeIngredientLine gives you canonical weightKg + category + secondary.
    const primaryFruitLb = normalized
      .filter((l) => !l.secondary && l.category === "fruit")
      .reduce((sum, l) => {
        const kg = l.weightKg ?? 0; // depends on your normalizeIngredientLine shape
        return sum + kg * 2.2046226218;
      }, 0);

    const ppm = (primaryFruitLb * 25) / primaryVolGal;

    // match old behavior: integer ppm string
    return Number.isFinite(ppm) ? String(Math.round(ppm)) : "0";
  }, [normalized, primaryVolumeL]);
  // a stable-ish signature so we can trigger resets only when ingredients meaningfully change
  const ingredientNutrientSig = useMemo(() => {
    // we only include fields that affect the offset default calc
    return normalized
      .filter((l) => !l.secondary) // offset uses primary-only
      .map((l) => `${l.lineId}:${l.category}:${l.weightKg ?? 0}`)
      .join("|");
  }, [normalized]);

  useEffect(() => {
    // Skip first mount (initial render) so we don't clobber hydrated/localStorage data
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    // Skip while hydrate() is applying localStorage state
    if (hydratingRef.current) return;

    // Reset offset whenever ingredients meaningfully change (silent)
    commit(
      () => {
        setNutrients((prev) => {
          if (prev.inputs.offsetPpm === defaultOffsetPpm) return prev;
          return {
            ...prev,
            inputs: {
              ...prev.inputs,
              offsetPpm: defaultOffsetPpm
            }
          };
        });
      },
      { silent: true }
    );
  }, [commit, ingredientNutrientSig, defaultOffsetPpm]);

  /** ---------------------------
   * Public API (small setters)
   * --------------------------*/
  const ingredientApi = useMemo<RecipeContextValue["ingredient"]>(
    () => ({
      add: () => {
        commit(() => {
          setIngredients((prev) => [
            ...prev,
            blankIngredientLine(unitDefaults, { name: "Honey", brix: "79.6" })
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

  const additivesApi = useMemo<RecipeContextValue["additives"]>(
    () => ({
      add: () => {
        commit(() => {
          setAdditives((prev) => [...prev, blankAdditiveLine()]);
        });
      },

      remove: (lineId) => {
        commit(() => {
          setAdditives((prev) => prev.filter((a) => a.lineId !== lineId));
        });
      },

      reorder: (next) => {
        commit(() => setAdditives(next));
      },

      setName: (lineId, name) => {
        commit(() => {
          const found = additiveList.find((a) => a.name === name);

          // Catalog select: overwrite unit + amount (like V1)
          if (found) {
            const dosage =
              typeof (found as any).dosage === "number"
                ? (found as any).dosage
                : parseNumber(String(found.dosage));

            const amount = dosageToAmount({ dosage, totalVolumeL });

            setAdditives((prev) =>
              prev.map((a) =>
                a.lineId === lineId
                  ? {
                      ...a,
                      name: found.name,
                      unit: found.unit,
                      amount,

                      // IMPORTANT: reset the conversion state to "trusted"
                      amountTouched: false,
                      amountDim: inferAdditiveAmountDimFromUnit(found.unit)
                    }
                  : a
              )
            );
            return;
          }

          // Custom text input: only update name
          setAdditives((prev) =>
            prev.map((a) => (a.lineId === lineId ? { ...a, name } : a))
          );
        });
      },

      setAmount: (lineId, amount) => {
        if (!isValidNumber(amount)) return;

        commit(() => {
          setAdditives((prev) =>
            prev.map((a) =>
              a.lineId === lineId
                ? {
                    ...a,
                    amount,
                    // user typed -> trust conversions within this unit's dimension
                    amountTouched: true,
                    amountDim: inferAdditiveAmountDimFromUnit(a.unit)
                  }
                : a
            )
          );
        });
      },

      setUnit: (lineId, nextUnit) => {
        commit(() => {
          setAdditives((prev) =>
            prev.map((a) => {
              if (a.lineId !== lineId) return a;

              const fromUnit = a.unit;

              const doConvert = shouldConvertAdditiveAmount({
                amountStr: a.amount,
                fromUnit,
                toUnit: nextUnit,
                amountTouched: a.amountTouched,
                amountDim: a.amountDim
              });

              const nextAmount = doConvert
                ? convertAdditiveAmount({
                    amountStr: a.amount,
                    fromUnit,
                    toUnit: nextUnit
                  })
                : a.amount;

              const nextDim = nextAdditiveAmountDimOnUnitChange({
                fromUnit,
                toUnit: nextUnit,
                prevAmountDim: a.amountDim
              });

              return {
                ...a,
                unit: nextUnit,
                amount: nextAmount,
                amountDim: nextDim
                // NOTE: we deliberately do NOT flip amountTouched here.
                // If user had typed it, it's still "touched".
                // If it was auto-filled and we crossed dimensions, nextDim becomes "unknown"
                // and shouldConvertAdditiveAmount will block future same-dim conversions
                // until user types a new amount or selects a catalog item again.
              };
            })
          );
        });
      }
    }),
    [commit, additiveList, totalVolumeL]
  );

  const notesApi = useMemo<RecipeContextValue["notes"]>(
    () => ({
      primary: {
        add: () => {
          commit(() => {
            setNotes((prev) => ({
              ...prev,
              primary: [...prev.primary, blankNoteLine()]
            }));
          });
        },

        remove: (lineId) => {
          commit(() => {
            setNotes((prev) => ({
              ...prev,
              primary: prev.primary.filter((n) => n.lineId !== lineId)
            }));
          });
        },

        reorder: (next) => {
          commit(() => {
            setNotes((prev) => ({
              ...prev,
              primary: next
            }));
          });
        },

        setText: (lineId, text) => {
          commit(() => {
            setNotes((prev) => ({
              ...prev,
              primary: prev.primary.map((n) =>
                n.lineId === lineId
                  ? { ...n, content: [text, n.content[1]] }
                  : n
              )
            }));
          });
        },

        setDetails: (lineId, details) => {
          commit(() => {
            setNotes((prev) => ({
              ...prev,
              primary: prev.primary.map((n) =>
                n.lineId === lineId
                  ? { ...n, content: [n.content[0], details] }
                  : n
              )
            }));
          });
        }
      },

      secondary: {
        add: () => {
          commit(() => {
            setNotes((prev) => ({
              ...prev,
              secondary: [...prev.secondary, blankNoteLine()]
            }));
          });
        },

        remove: (lineId) => {
          commit(() => {
            setNotes((prev) => ({
              ...prev,
              secondary: prev.secondary.filter((n) => n.lineId !== lineId)
            }));
          });
        },

        reorder: (next) => {
          commit(() => {
            setNotes((prev) => ({
              ...prev,
              secondary: next
            }));
          });
        },

        setText: (lineId, text) => {
          commit(() => {
            setNotes((prev) => ({
              ...prev,
              secondary: prev.secondary.map((n) =>
                n.lineId === lineId
                  ? { ...n, content: [text, n.content[1]] }
                  : n
              )
            }));
          });
        },

        setDetails: (lineId, details) => {
          commit(() => {
            setNotes((prev) => ({
              ...prev,
              secondary: prev.secondary.map((n) =>
                n.lineId === lineId
                  ? { ...n, content: [n.content[0], details] }
                  : n
              )
            }));
          });
        }
      }
    }),
    [commit]
  );

  const setUnitDefaults = useCallback(
    (next: RecipeUnitDefaults) => {
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
    [commit]
  );

  const adjustSecondaryToTargetBacksweetenedFg = useCallback(
    (targetSg: number) => {
      const fgSg = parseNumber(fg);
      const P = primaryVolumeL; // liters
      const S0 = secondaryVolumeL; // liters

      if (!Number.isFinite(targetSg)) return;
      if (!Number.isFinite(fgSg) || !Number.isFinite(P) || !Number.isFinite(S0))
        return;

      // If there's NO secondary yet, add a secondary honey line sized to the required S.
      if (S0 <= 0) {
        const honeySg = toSG(HONEY_BRIX);
        const denom = targetSg - honeySg;
        if (Math.abs(denom) < 1e-6) return;

        const S = (P * (fgSg - targetSg)) / denom; // required secondary liters (honey)
        if (!Number.isFinite(S) || S <= 0) return;

        const volInGlobal = S * L_TO_VOLUME[unitDefaults.volume];
        const weightKg = S * honeySg;
        const weightInGlobal = weightKg * KG_TO_WEIGHT[unitDefaults.weight];

        const honeyLine = blankIngredientLine(unitDefaults, {
          name: "Honey",
          category: "sugar",
          brix: HONEY_BRIX.toFixed(2),
          ref: { kind: "custom" },
          secondary: true,
          amounts: {
            basis: "volume",
            volume: { value: fmt(volInGlobal), unit: unitDefaults.volume },
            weight: { value: fmt(weightInGlobal), unit: unitDefaults.weight }
          }
        });

        commit(() => {
          setIngredients((prev) => [...prev, honeyLine]);
        });

        return;
      }

      // Normal path: you already have secondary ingredients, so scale them as a group.
      const secSg = secondarySg;
      if (!Number.isFinite(secSg)) return;

      const denom = targetSg - secSg;
      if (Math.abs(denom) < 1e-6) return;

      const S = (P * (fgSg - targetSg)) / denom;
      if (!Number.isFinite(S) || S < 0) return;

      const scale = S / S0;
      if (!Number.isFinite(scale)) return;

      commit(() => {
        setIngredients((prev) =>
          prev.map((line) => {
            if (!line.secondary) return line;

            const wStr = line.amounts.weight.value;
            const vStr = line.amounts.volume.value;

            const nextWeight = isEffectivelyEmptyNumericInput(wStr)
              ? wStr
              : fmt(parseNumber(wStr) * scale);

            const nextVolume = isEffectivelyEmptyNumericInput(vStr)
              ? vStr
              : fmt(parseNumber(vStr) * scale);

            return {
              ...line,
              amounts: {
                ...line.amounts,
                weight: { ...line.amounts.weight, value: nextWeight },
                volume: { ...line.amounts.volume, value: nextVolume }
              }
            };
          })
        );
      });
    },
    [fg, primaryVolumeL, secondaryVolumeL, secondarySg, unitDefaults, commit]
  );

  const setPrimaryTargetsWithRatios = useCallback(
    ({
      targetOg,
      targetVolume,
      ratios
    }: {
      targetOg: number;
      targetVolume: number;
      ratios: { lineId: string; pct: number }[];
    }) => {
      if (!Number.isFinite(targetOg) || targetOg <= 1) return;
      if (!Number.isFinite(targetVolume) || targetVolume <= 0) return;

      const VtargetL = targetVolume * VOLUME_TO_L[unitDefaults.volume];
      if (!Number.isFinite(VtargetL) || VtargetL <= 0) return;

      // Only primary, non-water, non-secondary
      const primaryFermentables = ingredients.filter(
        (l) => !l.secondary && l.category !== "water"
      );

      if (primaryFermentables.length === 0) return;

      // Build a ratio map (0..1)
      const ratioMap = new Map<string, number>();
      const pctSum = ratios.reduce(
        (s, r) => s + (Number.isFinite(r.pct) ? r.pct : 0),
        0
      );
      if (!Number.isFinite(pctSum) || pctSum <= 0) return;

      ratios.forEach((r) => {
        ratioMap.set(r.lineId, r.pct / pctSum); // normalize defensively
      });

      // Total gravity points needed (points/L)
      const GP_TARGET = (targetOg - 1) * 1000 * VtargetL;
      if (!Number.isFinite(GP_TARGET) || GP_TARGET <= 0) return;

      // Compute required fermentable liters from allocated gravity points
      const solved = primaryFermentables.map((line) => {
        const ratio = ratioMap.get(line.lineId) ?? 0;
        const sg = toSG(parseNumber(line.brix));
        const gpPerL = (sg - 1) * 1000;

        return {
          lineId: line.lineId,
          sg,
          ratio,
          gpPerL
        };
      });

      // If any included fermentable has invalid sg, bail
      if (
        solved.some(
          (x) =>
            !Number.isFinite(x.sg) ||
            x.sg <= 1 ||
            !Number.isFinite(x.gpPerL) ||
            x.gpPerL <= 0
        )
      ) {
        return;
      }

      const fermentableVolumesL = solved.map((x) => {
        const gp_i = GP_TARGET * x.ratio;
        const vL = gp_i / x.gpPerL;
        return { lineId: x.lineId, vL, sg: x.sg };
      });

      const fermentableSumL = fermentableVolumesL.reduce((s, x) => s + x.vL, 0);
      if (!Number.isFinite(fermentableSumL) || fermentableSumL <= 0) return;

      // Water = leftover volume
      const waterL = VtargetL - fermentableSumL;

      // If water would be negative, we cannot meet the target OG *and* keep ratios with these SGs.
      // (Would require “negative water”.) Bail instead of doing something surprising.
      if (waterL < -1e-6) return;

      // Find existing primary water line (optional)
      const existingWater = ingredients.find(
        (l) => !l.secondary && l.category === "water"
      );

      commit(() => {
        setIngredients((prev) => {
          const next = prev.map((line) => {
            // Update fermentables by setting volume/weight directly
            const solvedLine = fermentableVolumesL.find(
              (x) => x.lineId === line.lineId
            );
            if (solvedLine) {
              const volInLineUnit =
                solvedLine.vL * L_TO_VOLUME[line.amounts.volume.unit];
              const weightKg = solvedLine.vL * solvedLine.sg;
              const weightInLineUnit =
                weightKg * KG_TO_WEIGHT[line.amounts.weight.unit];

              return {
                ...line,
                amounts: {
                  ...line.amounts,
                  basis: "volume" as IngredientLine["amounts"]["basis"],
                  volume: { ...line.amounts.volume, value: fmt(volInLineUnit) },
                  weight: {
                    ...line.amounts.weight,
                    value: fmt(weightInLineUnit)
                  }
                }
              };
            }

            // Update water if it exists
            if (!line.secondary && line.category === "water") {
              const volInGlobal = waterL * L_TO_VOLUME[unitDefaults.volume];
              const weightKg = waterL * toSG(0); // ~1
              const weightInGlobal =
                weightKg * KG_TO_WEIGHT[unitDefaults.weight];

              return {
                ...line,
                amounts: {
                  ...line.amounts,
                  basis: "volume" as IngredientLine["amounts"]["basis"],
                  volume: {
                    ...line.amounts.volume,
                    value: fmt(volInGlobal),
                    unit: unitDefaults.volume
                  },
                  weight: {
                    ...line.amounts.weight,
                    value: fmt(weightInGlobal),
                    unit: unitDefaults.weight
                  }
                }
              };
            }

            return line;
          });

          // If there’s no water line yet, add one (only if we have leftover > 0)
          if (!existingWater && waterL > 1e-6) {
            const volInGlobal = waterL * L_TO_VOLUME[unitDefaults.volume];
            const weightKg = waterL * 1;
            const weightInGlobal = weightKg * KG_TO_WEIGHT[unitDefaults.weight];

            const waterLine = blankIngredientLine(unitDefaults, {
              name: "Water",
              category: "water",
              brix: "0.00",
              ref: { kind: "custom" },
              secondary: false,
              amounts: {
                basis: "volume",
                volume: { value: fmt(volInGlobal), unit: unitDefaults.volume },
                weight: {
                  value: fmt(weightInGlobal),
                  unit: unitDefaults.weight
                }
              }
            });

            return [...next, waterLine];
          }

          return next;
        });
      });
    },
    [ingredients, unitDefaults, commit]
  );

  const onNutrientsChange = useCallback(
    (next: NutrientData, meta?: { silent?: boolean }) => {
      commit(() => setNutrients(next), { silent: meta?.silent });
    },
    [commit]
  );

  const value: RecipeContextValue = useMemo(
    () => ({
      data: {
        unitDefaults,
        ingredients,
        fg,
        additives,
        notes,
        stabilizers: {
          adding: addingStabilizers,
          takingPh,
          phReading,
          type: stabilizerType
        },
        nutrients
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
        delle,
        nutrientValueForRecipe
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
      additives: additivesApi,
      notes: notesApi,

      setFg: (next) => {
        if (!isValidNumber(next)) return;
        commit(() => setFgState(next));
      },

      setUnitDefaults,

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

        const waterLine = blankIngredientLine(unitDefaults, {
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

        const honeyLine = blankIngredientLine(unitDefaults, {
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

      adjustSecondaryToTargetBacksweetenedFg,
      setPrimaryTargetsWithRatios,

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
        loadingIngredients,
        additiveList,
        loadingAdditives
      },

      meta: {
        isDirty,
        markSaved,
        markDirty,
        hydrate,
        reset,
        setNutrients: onNutrientsChange
      }
    }),
    [
      // state
      unitDefaults,
      ingredients,
      additives,
      notes,
      fg,
      isDirty,
      nutrients,
      additiveList,
      loadingAdditives,
      reset,
      onNutrientsChange,

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
      additivesApi,
      notesApi,
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
    <RecipeContext.Provider value={value}>{children}</RecipeContext.Provider>
  );
}

export function useRecipe() {
  const ctx = useContext(RecipeContext);
  if (!ctx) throw new Error("useRecipe must be used within a RecipeProvider");
  return ctx;
}
