"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { NutrientDataV2, NutrientKey } from "@/types/nutrientDataV2";
import {
  getEffectiveMaxGpl,
  initialNutrientDataV2,
  scheduleFromSelected
} from "@/types/nutrientDataV2";
import { useYeastsQuery } from "@/hooks/reactQuery/useYeastsQuery";
import { toBrix } from "@/lib/utils/unitConverter";
import { parseNumber } from "@/lib/utils/validateInput";
type NutrientAdditionsDerived = {
  totalGrams: Record<NutrientKey, number>;
  perAddition: Record<NutrientKey, number>;
};

type NutrientDerivedV2 = {
  targetYanPpm: number;
  remainingYanPpm: number;

  // grams for each nutrient key (fermO/fermK/dap/other)
  nutrientAdditions: NutrientAdditionsDerived;

  // helpful for debugging / settings UI
  providedYanPpm: Record<NutrientKey, number>;
  goFerm: {
    amount: number;
    water: number;
  };
};
type NutrientV2UI = {
  data: NutrientDataV2;

  // derived: add later
  derived: NutrientDerivedV2;

  catalog: {
    yeastList: any[]; // replace with your Yeast type
    loadingYeasts: boolean;
    brands: string[];
  };

  // actions: add later
  actions: {
    setVolume: (v: string) => void;
    setVolumeUnits: (u: NutrientDataV2["inputs"]["volumeUnits"]) => void;
    setSg: (v: string) => void;
    setOffsetPpm: (v: string) => void;
    setYeastBrand: (brand: string) => void; // will auto-pick first strain + sync nitrogen
    setYeastStrain: (strain: string) => void; // will sync brand/id/nitrogen
    selectYeast: (yeast: any) => void; // one-shot (best for SearchableInput onSelect)
    setNitrogenRequirement: (
      v: NutrientDataV2["selected"]["nitrogenRequirement"]
    ) => void;
    toggleNutrient: (key: NutrientKey) => void;
    setOtherNutrientName: (name: string) => void;
    setOtherYanContribution: (v: string) => void; // settings.yanContribution.other
    setMaxGpl: (key: NutrientKey, v: string) => void; // settings.maxGpl[key]
    setYanContribution: (key: NutrientKey, v: string) => void; // settings.yanContribution[key]
    setNumberOfAdditions: (v: string) => void; // inputs.numberOfAdditions
    setAdjustAllowed: (v: boolean) => void; // adjustments.adjustAllowed
    setProvidedYanPpm: (key: NutrientKey, v: string) => void; // adjustments.providedYanPpm[key]
    setGoFermType: (v: NutrientDataV2["inputs"]["goFermType"]) => void;
    setYeastAmountG: (v: string) => void;
    resetYeastAmountAuto: () => void;
  };

  meta: {
    isDirty: boolean;
    markSaved: () => void;
    hydrate: (next: NutrientDataV2) => void;
    reset: () => void;
  };
};

const NutrientV2Context = createContext<NutrientV2UI | null>(null);

type Props =
  | { mode?: "standalone"; initial?: NutrientDataV2; children: React.ReactNode }
  | {
      mode: "controlled";
      value: NutrientDataV2;
      onChange: (next: NutrientDataV2, meta?: { silent?: boolean }) => void;
      children: React.ReactNode;
    };

type ControlledProps = Extract<Props, { mode: "controlled" }>;

const isControlledProps = (p: Props): p is ControlledProps =>
  p.mode === "controlled";

export function NutrientProviderV2(props: Props) {
  const { data: yeastList = [], isPending: loadingYeasts } = useYeastsQuery();
  const brands = useMemo(
    () => Array.from(new Set(yeastList.map((y) => y.brand))).sort(),
    [yeastList]
  );
  const controlled = isControlledProps(props);

  const [local, setLocal] = useState<NutrientDataV2>(
    controlled
      ? initialNutrientDataV2()
      : props.initial ?? initialNutrientDataV2()
  );

  const data = controlled ? props.value : local;

  const [dirtyLocal, setDirtyLocal] = useState(false);
  const isDirty = controlled ? false : dirtyLocal;

  const commit = useCallback(
    (
      updater: (prev: NutrientDataV2) => NutrientDataV2,
      opts?: { silent?: boolean }
    ) => {
      if (controlled) {
        const next = updater(props.value);
        props.onChange(next, opts);
        return;
      }

      setLocal((prev) => {
        const next = updater(prev);
        if (!opts?.silent) setDirtyLocal(true);
        return next;
      });
    },
    [controlled, props]
  );

  const markSaved = useCallback(() => {
    if (!controlled) setDirtyLocal(false);
  }, [controlled]);

  const hydrate = useCallback(
    (next: NutrientDataV2) => {
      if (controlled) props.onChange(next, { silent: true });
      else {
        setLocal(next);
        setDirtyLocal(false);
      }
    },
    [controlled, props]
  );
  const reset = useCallback(() => {
    const fresh = initialNutrientDataV2();
    hydrate(fresh);
  }, [hydrate]);

  // ---- actions (add as we go, starting with VolumeInputs)
  // 2) implement them
  const actions = useMemo<NutrientV2UI["actions"]>(
    () => ({
      setVolume: (v) => {
        commit((prev) => ({
          ...prev,
          inputs: { ...prev.inputs, volume: v }
        }));
      },

      setVolumeUnits: (u) => {
        commit((prev) => ({
          ...prev,
          inputs: { ...prev.inputs, volumeUnits: u }
        }));
      },

      setSg: (v) => {
        commit((prev) => ({
          ...prev,
          inputs: { ...prev.inputs, sg: v }
        }));
      },

      setOffsetPpm: (v) => {
        commit((prev) => ({
          ...prev,
          inputs: { ...prev.inputs, offsetPpm: v }
        }));
      },
      selectYeast: (yeast) => {
        commit((prev) => ({
          ...prev,
          selected: {
            ...prev.selected,
            yeastBrand: yeast.brand,
            yeastStrain: yeast.name,
            yeastId: yeast.id,
            // IMPORTANT: keep nitrogen in sync like old provider did
            nitrogenRequirement:
              yeast.nitrogen_requirement ?? prev.selected.nitrogenRequirement
          }
        }));
      },

      setYeastBrand: (brand: string) => {
        // match old behavior: select first yeast of that brand
        const first = yeastList.find((y) => y.brand === brand);

        commit((prev) => ({
          ...prev,
          selected: {
            ...prev.selected,
            yeastBrand: brand,
            yeastStrain: first?.name ?? prev.selected.yeastStrain,
            yeastId: first?.id ?? prev.selected.yeastId,
            nitrogenRequirement:
              first?.nitrogen_requirement ?? prev.selected.nitrogenRequirement
          }
        }));
      },

      setYeastStrain: (strain: string) => {
        const found = yeastList.find((y) => y.name === strain);

        commit((prev) => ({
          ...prev,
          selected: {
            ...prev.selected,
            yeastStrain: strain,
            yeastBrand: found?.brand ?? prev.selected.yeastBrand,
            yeastId: found?.id ?? prev.selected.yeastId,
            nitrogenRequirement:
              found?.nitrogen_requirement ?? prev.selected.nitrogenRequirement
          }
        }));
      },
      setNitrogenRequirement: (
        req: NutrientDataV2["selected"]["nitrogenRequirement"]
      ) => {
        commit((prev) => ({
          ...prev,
          selected: { ...prev.selected, nitrogenRequirement: req }
        }));
      },
      setNumberOfAdditions: (v) => {
        commit((prev) => ({
          ...prev,
          inputs: { ...prev.inputs, numberOfAdditions: v }
        }));
      },

      toggleNutrient: (key) => {
        commit((prev) => {
          const nextSelected = {
            ...prev.selected.selectedNutrients,
            [key]: !prev.selected.selectedNutrients[key]
          };

          const nextSchedule = scheduleFromSelected(nextSelected);

          return {
            ...prev,
            selected: {
              ...prev.selected,
              selectedNutrients: nextSelected,
              schedule: nextSchedule
            }
          };
        });
      },

      setOtherNutrientName: (name) => {
        commit((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            other: { ...prev.settings.other, name }
          }
        }));
      },

      setOtherYanContribution: (v) => {
        commit((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            yanContribution: { ...prev.settings.yanContribution, other: v }
          }
        }));
      },

      setMaxGpl: (key, v) => {
        commit((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            maxGplTouched: true,
            maxGpl: { ...prev.settings.maxGpl, [key]: v }
          }
        }));
      },

      setYanContribution: (key, v) => {
        commit((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            yanContribution: { ...prev.settings.yanContribution, [key]: v }
          }
        }));
      },

      setAdjustAllowed: (v) => {
        commit((prev) => ({
          ...prev,
          adjustments: { ...prev.adjustments, adjustAllowed: v }
        }));
      },

      setProvidedYanPpm: (key, v) => {
        commit((prev) => ({
          ...prev,
          adjustments: {
            ...prev.adjustments,
            providedYanPpm: { ...prev.adjustments.providedYanPpm, [key]: v }
          }
        }));
      },
      setGoFermType: (v) => {
        commit((prev) => ({
          ...prev,
          inputs: { ...prev.inputs, goFermType: v }
        }));
      },

      setYeastAmountG: (v) => {
        commit((prev) => ({
          ...prev,
          inputs: {
            ...prev.inputs,
            yeastAmountG: v,
            yeastAmountTouched: true
          }
        }));
      },
      resetYeastAmountAuto: () => {
        commit((prev) => ({
          ...prev,
          inputs: { ...prev.inputs, yeastAmountTouched: false }
        }));
      }
    }),

    [commit, yeastList]
  );
  const derived = useMemo<NutrientDerivedV2>(() => {
    const sg = parseNumber(data.inputs.sg);
    const offset = parseNumber(data.inputs.offsetPpm || "0");
    const volume = parseNumber(data.inputs.volume);
    const numberOfAdditions = Math.max(
      1,
      parseNumber(data.inputs.numberOfAdditions || "1")
    );

    // nitrogen multiplier (add a mapping for "Very Low" even if you treat it same as Low)
    const n2 = data.selected.nitrogenRequirement;
    const n2Multiplier =
      n2 === "Very Low"
        ? 0.75
        : n2 === "Low"
        ? 0.75
        : n2 === "Medium"
        ? 0.9
        : n2 === "High"
        ? 1.25
        : 1.8; // Very High

    const gpl = toBrix(sg) * sg * 10;
    const targetYanPpm = Math.round(gpl * n2Multiplier - offset);

    // parse provided ppm from state (user editable when adjustAllowed)
    const providedYanPpm: Record<NutrientKey, number> = {
      fermO: parseNumber(data.adjustments.providedYanPpm.fermO),
      fermK: parseNumber(data.adjustments.providedYanPpm.fermK),
      dap: parseNumber(data.adjustments.providedYanPpm.dap),
      other: parseNumber(data.adjustments.providedYanPpm.other)
    };

    // If adjust is ON, grams are based on user-provided ppm.
    // If adjust is OFF, we *still* compute grams from "computed ppm",
    // but that computed ppm will be synced into state by the effect in step 4.
    const ppmToUse = providedYanPpm;

    const yanContribution = {
      fermO: parseNumber(data.settings.yanContribution.fermO),
      fermK: parseNumber(data.settings.yanContribution.fermK),
      dap: parseNumber(data.settings.yanContribution.dap),
      other: parseNumber(data.settings.yanContribution.other)
    };

    // old behavior: organic multiplier depends on goFermType
    const organicMultiplier = data.inputs.goFermType === "none" ? 3 : 4;
    const effectiveYanContribution = {
      ...yanContribution,
      fermO: yanContribution.fermO * organicMultiplier
    };

    // grams conversion (matches old provider)
    const litersPerUnit = data.inputs.volumeUnits === "liter" ? 1 : 3.785;

    const nutrientAdditionsTotal: Record<NutrientKey, number> = {
      fermO: 0,
      fermK: 0,
      dap: 0,
      other: 0
    };

    (Object.keys(nutrientAdditionsTotal) as NutrientKey[]).forEach((key) => {
      const ppm = Math.max(0, ppmToUse[key] || 0);
      const contrib = effectiveYanContribution[key] || 0;

      const gPerLiter = contrib === 0 ? 0 : ppm / contrib;
      const grams = gPerLiter * volume * litersPerUnit;
      nutrientAdditionsTotal[key] = grams;
    });

    const nutrientAdditionsPer: Record<NutrientKey, number> = {
      fermO: nutrientAdditionsTotal.fermO / numberOfAdditions,
      fermK: nutrientAdditionsTotal.fermK / numberOfAdditions,
      dap: nutrientAdditionsTotal.dap / numberOfAdditions,
      other: nutrientAdditionsTotal.other / numberOfAdditions
    };

    const remainingYanPpm =
      targetYanPpm -
      (ppmToUse.fermO + ppmToUse.fermK + ppmToUse.dap + ppmToUse.other);
    // ----- Go-Ferm (matches old provider)
    const yeastAmount = parseNumber(data.inputs.yeastAmountG || "0");

    let gfMultiplier = 0;
    let waterMultiplier = 20;

    if (data.inputs.goFermType === "none") {
      waterMultiplier = 0;
    }

    if (
      data.inputs.goFermType === "Go-Ferm" ||
      data.inputs.goFermType === "protect"
    ) {
      gfMultiplier = 1.25;
    }

    if (data.inputs.goFermType === "sterol-flash") {
      gfMultiplier = 1.2;
      waterMultiplier = waterMultiplier / 2;
    }

    const gfAmount = yeastAmount * gfMultiplier;
    const gfWater = gfAmount * waterMultiplier;

    const goFerm = {
      amount: Math.round(gfAmount * 100) / 100,
      water: Math.round(gfWater * 100) / 100
    };
    return {
      targetYanPpm,
      remainingYanPpm,
      nutrientAdditions: {
        totalGrams: nutrientAdditionsTotal,
        perAddition: nutrientAdditionsPer
      },
      providedYanPpm,
      goFerm
    };
  }, [data]);

  useEffect(() => {
    if (data.adjustments.adjustAllowed) return;

    // When NOT adjusting, we want to compute the ppm breakdown from target + max g/L limits,
    // and write it into adjustments.providedYanPpm (silently).
    //
    // Minimal version for now: use data.settings.maxGpl as the "effective max g/L".
    // Later you can swap this to schedule presets + tiering.

    const sg = parseNumber(data.inputs.sg);
    const offset = parseNumber(data.inputs.offsetPpm || "0");

    const n2 = data.selected.nitrogenRequirement;
    const n2Multiplier =
      n2 === "Very Low"
        ? 0.75
        : n2 === "Low"
        ? 0.75
        : n2 === "Medium"
        ? 0.9
        : n2 === "High"
        ? 1.25
        : 1.8;

    const gpl = toBrix(sg) * sg * 10;
    const target = Math.round(gpl * n2Multiplier - offset);

    const organicMultiplier = data.inputs.goFermType === "none" ? 3 : 4;

    const yanContribution = {
      fermO:
        parseNumber(data.settings.yanContribution.fermO) * organicMultiplier,
      fermK: parseNumber(data.settings.yanContribution.fermK),
      dap: parseNumber(data.settings.yanContribution.dap),
      other: parseNumber(data.settings.yanContribution.other)
    };

    const enabled = data.selected.selectedNutrients;

    const maxGpl = {
      fermO: enabled.fermO ? parseNumber(data.settings.maxGpl.fermO) : 0,
      fermK: enabled.fermK ? parseNumber(data.settings.maxGpl.fermK) : 0,
      dap: enabled.dap ? parseNumber(data.settings.maxGpl.dap) : 0,
      other: enabled.other ? parseNumber(data.settings.maxGpl.other) : 0
    };

    let remaining = target;
    const nextProvided: Record<NutrientKey, string> = {
      fermO: "0",
      fermK: "0",
      dap: "0",
      other: "0"
    };

    (["fermO", "fermK", "dap", "other"] as NutrientKey[]).forEach((key) => {
      if (remaining <= 0) return;

      const cap = (yanContribution[key] || 0) * (maxGpl[key] || 0);
      if (cap <= 0) return;

      const use = Math.min(cap, remaining);
      nextProvided[key] = String(use);
      remaining -= use;
    });

    // Only commit if it actually changed (prevents loops)
    const cur = data.adjustments.providedYanPpm;
    const changed =
      cur.fermO !== nextProvided.fermO ||
      cur.fermK !== nextProvided.fermK ||
      cur.dap !== nextProvided.dap ||
      cur.other !== nextProvided.other;

    if (!changed) return;

    commit(
      (prev) => ({
        ...prev,
        adjustments: { ...prev.adjustments, providedYanPpm: nextProvided }
      }),
      { silent: true }
    );
  }, [
    data.adjustments.adjustAllowed,
    data.inputs.sg,
    data.inputs.offsetPpm,
    data.inputs.goFermType,
    data.selected.nitrogenRequirement,
    data.selected.schedule,
    data.selected.selectedNutrients,
    data.settings.yanContribution,
    data.adjustments.providedYanPpm,
    data.settings.maxGpl.fermO,
    data.settings.maxGpl.fermK,
    data.settings.maxGpl.dap,
    data.settings.maxGpl.other,

    commit
  ]);

  useEffect(() => {
    if (data.settings.maxGplTouched) return;

    const next = getEffectiveMaxGpl({
      schedule: data.selected.schedule,
      sg: data.inputs.sg,
      selected: data.selected.selectedNutrients
    });

    const cur = data.settings.maxGpl;
    const changed =
      cur.fermO !== next.fermO ||
      cur.fermK !== next.fermK ||
      cur.dap !== next.dap ||
      cur.other !== next.other;

    if (!changed) return;

    commit(
      (prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          maxGpl: { ...prev.settings.maxGpl, ...next }
        }
      }),
      { silent: true }
    );
  }, [
    data.selected.schedule,
    data.inputs.sg,
    data.selected.selectedNutrients,
    data.settings.maxGplTouched,
    commit
  ]);

  useEffect(() => {
    if (data.inputs.yeastAmountTouched) return;

    const units = data.inputs.volumeUnits;
    const volume = parseNumber(data.inputs.volume);
    const sg = parseNumber(data.inputs.sg);

    // old multiplier logic
    let multiplier = 1;
    if (units === "liter") multiplier /= 3.78541;

    if (sg >= 1.125) multiplier *= 4;
    else if (sg > 1.1 && sg < 1.125) multiplier *= 3;
    else multiplier *= 2;

    const yeastAmount = Math.round(volume * multiplier * 100) / 100;
    const nextStr = String(yeastAmount);

    if (data.inputs.yeastAmountG === nextStr) return;

    commit(
      (prev) => ({
        ...prev,
        inputs: { ...prev.inputs, yeastAmountG: nextStr }
      }),
      { silent: true }
    );
  }, [
    data.inputs.volume,
    data.inputs.volumeUnits,
    data.inputs.sg,
    data.inputs.yeastAmountTouched,
    data.inputs.yeastAmountG,
    commit
  ]);

  const value = useMemo<NutrientV2UI>(
    () => ({
      data,
      derived,
      catalog: { yeastList, loadingYeasts, brands },
      actions,
      meta: { isDirty, markSaved, hydrate, reset }
    }),
    [
      data,
      derived,
      actions,
      isDirty,
      markSaved,
      hydrate,
      reset,
      yeastList,
      loadingYeasts,
      brands
    ]
  );

  return (
    <NutrientV2Context.Provider value={value}>
      {props.children}
    </NutrientV2Context.Provider>
  );
}

export function useNutrientsV2() {
  const ctx = useContext(NutrientV2Context);
  if (!ctx)
    throw new Error("useNutrientsV2 must be used within NutrientProviderV2");
  return ctx;
}
