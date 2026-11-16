"use client";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import type { NutrientData, NutrientKey } from "@/types/nutrientData";
import { initialNutrientData } from "@/types/nutrientData";
import { useYeastsQuery } from "@/hooks/reactQuery/useYeastsQuery";
import { useNutrientPresetsQuery } from "@/hooks/reactQuery/useNutrientPresetsQuery";
import type { NutrientPreset } from "@/types/nutrientTypes";
import {
  applyNutrientAction,
  calculateNutrientDerivedState,
  syncNutrientAutoFields,
  type NutrientAction,
  type NutrientDerivedState,
  type NutrientYeastOption
} from "@meadtools/core/nutrients";
type NutrientUI = {
  data: NutrientData;

  // derived: add later
  derived: NutrientDerivedState;

  catalog: {
    yeastList: {
      id: number | string;
      brand: string;
      name: string;
      nitrogen_requirement?: NutrientData["selected"]["nitrogenRequirement"];
    }[]; // replace with your Yeast type
    loadingYeasts: boolean;
    brands: string[];
    nutrientPresetList: NutrientPreset[];
  };

  // actions: add later
  actions: {
    setVolume: (v: string) => void;
    setVolumeUnits: (u: NutrientData["inputs"]["volumeUnits"]) => void;
    setSg: (v: string) => void;
    setOffsetPpm: (v: string) => void;
    setYeastBrand: (brand: string) => void; // will auto-pick first strain + sync nitrogen
    setYeastStrain: (strain: string) => void; // will sync brand/id/nitrogen
    selectYeast: (yeast: any) => void; // one-shot (best for SearchableInput onSelect)
    setNitrogenRequirement: (
      v: NutrientData["selected"]["nitrogenRequirement"]
    ) => void;
    toggleNutrient: (key: NutrientKey) => void;
    setOtherNutrientName: (name: string) => void;
    selectOtherNutrientPreset: (preset: NutrientPreset) => void;
    setOtherUsesOrganicMultiplier: (value: boolean) => void;
    setOtherYanContribution: (v: string) => void; // settings.yanContribution.other
    setMaxGpl: (key: NutrientKey, v: string) => void; // settings.maxGpl[key]
    setYanContribution: (key: NutrientKey, v: string) => void; // settings.yanContribution[key]
    setNumberOfAdditions: (v: string) => void; // inputs.numberOfAdditions
    setAdjustAllowed: (v: boolean) => void; // adjustments.adjustAllowed
    setProvidedYanPpm: (key: NutrientKey, v: string) => void; // adjustments.providedYanPpm[key]
    setGoFermType: (v: NutrientData["inputs"]["goFermType"]) => void;
    setYeastAmountG: (v: string) => void;
    resetYeastAmountAuto: () => void;
  };

  meta: {
    isDirty: boolean;
    markSaved: () => void;
    hydrate: (next: NutrientData) => void;
    reset: () => void;
  };
};

const NutrientContext = createContext<NutrientUI | null>(null);

type Props =
  | { mode?: "standalone"; initial?: NutrientData; children: React.ReactNode }
  | {
      mode: "controlled";
      value: NutrientData;
      onChange: (next: NutrientData, meta?: { silent?: boolean }) => void;
      children: React.ReactNode;
    };

type ControlledProps = Extract<Props, { mode: "controlled" }>;

const isControlledProps = (p: Props): p is ControlledProps =>
  p.mode === "controlled";

export function NutrientProvider(props: Props) {
  const { data: yeastList = [], isPending: loadingYeasts } = useYeastsQuery();
  const { data: nutrientPresetList = [] } = useNutrientPresetsQuery();
  const brands = useMemo(
    () => Array.from(new Set(yeastList.map((y) => y.brand))).sort(),
    [yeastList]
  );
  const controlled = isControlledProps(props);

  const [local, setLocal] = useState<NutrientData>(
    controlled ? initialNutrientData() : props.initial ?? initialNutrientData()
  );

  const data = controlled ? props.value : local;

  const [dirtyLocal, setDirtyLocal] = useState(false);
  const isDirty = controlled ? false : dirtyLocal;

  const commit = useCallback(
    (
      updater: (prev: NutrientData) => NutrientData,
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
    (next: NutrientData) => {
      if (controlled) props.onChange(next, { silent: true });
      else {
        setLocal(next);
        setDirtyLocal(false);
      }
    },
    [controlled, props]
  );
  const reset = useCallback(() => {
    const fresh = initialNutrientData();
    hydrate(fresh);
  }, [hydrate]);

  // Every change goes through the shared reducer so Mobile uses the same rules.
  const actions = useMemo<NutrientUI["actions"]>(() => {
    const dispatch = (action: NutrientAction) =>
      commit((prev) => applyNutrientAction(prev, action));
    const yeasts = yeastList as NutrientYeastOption[];

    return {
      setVolume: (value) => dispatch({ type: "setVolume", value }),
      setVolumeUnits: (value) => dispatch({ type: "setVolumeUnits", value }),
      setSg: (value) => dispatch({ type: "setSg", value }),
      setOffsetPpm: (value) => dispatch({ type: "setOffsetPpm", value }),
      selectYeast: (yeast) => dispatch({ type: "selectYeast", yeast }),
      setYeastBrand: (brand) => dispatch({ type: "setYeastBrand", brand, yeasts }),
      setYeastStrain: (strain) =>
        dispatch({ type: "setYeastStrain", strain, yeasts }),
      setNitrogenRequirement: (value) =>
        dispatch({ type: "setNitrogenRequirement", value }),
      setNumberOfAdditions: (value) =>
        dispatch({ type: "setNumberOfAdditions", value }),
      toggleNutrient: (key) => dispatch({ type: "toggleNutrient", key }),
      setOtherNutrientName: (value) =>
        dispatch({ type: "setOtherNutrientName", value }),
      selectOtherNutrientPreset: (preset) =>
        dispatch({ type: "selectOtherNutrientPreset", preset }),
      setOtherUsesOrganicMultiplier: (value) =>
        dispatch({ type: "setOtherUsesOrganicMultiplier", value }),
      setOtherYanContribution: (value) =>
        dispatch({ type: "setOtherYanContribution", value }),
      setMaxGpl: (key, value) => dispatch({ type: "setMaxGpl", key, value }),
      setYanContribution: (key, value) =>
        dispatch({ type: "setYanContribution", key, value }),
      setAdjustAllowed: (value) => dispatch({ type: "setAdjustAllowed", value }),
      setProvidedYanPpm: (key, value) =>
        dispatch({ type: "setProvidedYanPpm", key, value }),
      setGoFermType: (value) => dispatch({ type: "setGoFermType", value }),
      setYeastAmountG: (value) => dispatch({ type: "setYeastAmountG", value }),
      resetYeastAmountAuto: () => dispatch({ type: "resetYeastAmountAuto" })
    };
  }, [commit, yeastList]);
  const derived = useMemo(() => calculateNutrientDerivedState(data), [data]);

  // Keep automatic fields (max g/L, the YAN split and the yeast amount) filled
  // in, silently. The shared sync returns the same object when nothing changes,
  // which stops the loop.
  useEffect(() => {
    if (syncNutrientAutoFields(data) === data) return;
    commit((prev) => syncNutrientAutoFields(prev), { silent: true });
  }, [data, commit]);

  const value = useMemo<NutrientUI>(
    () => ({
      data,
      derived,
      catalog: { yeastList, loadingYeasts, brands, nutrientPresetList },
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
      brands,
      nutrientPresetList
    ]
  );

  return (
    <NutrientContext.Provider value={value}>
      {props.children}
    </NutrientContext.Provider>
  );
}

export function useNutrients() {
  const ctx = useContext(NutrientContext);
  if (!ctx)
    throw new Error("useNutrients must be used within NutrientProvider");
  return ctx;
}
