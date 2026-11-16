import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  applyNutrientAction,
  calculateNutrientDerivedState,
  initialNutrientData,
  syncNutrientAutoFields,
  type NutrientAction,
  type NutrientData,
  type NutrientKey,
  type NutrientYeastOption
} from "@meadtools/core/nutrients";

import { useCatalog } from "@/catalogs/use-catalog";

export const NUTRIENT_KEYS = ["fermO", "fermK", "dap", "other"] as const satisfies readonly NutrientKey[];

/**
 * Nutrient calculator state for Mobile. Every change goes through the same
 * shared reducer and automatic fields as the web calculator.
 */
export function useNutrientCalculator() {
  const { t } = useTranslation();
  const yeastCatalog = useCatalog("yeasts");
  const presetCatalog = useCatalog("nutrientPresets");
  const [data, setData] = useState<NutrientData>(() => syncNutrientAutoFields(initialNutrientData()));

  const dispatch = (action: NutrientAction) =>
    setData((current) => syncNutrientAutoFields(applyNutrientAction(current, action)));

  const yeasts = useMemo(() => (yeastCatalog.data?.data ?? []) as NutrientYeastOption[], [yeastCatalog.data]);
  const brands = useMemo(() => Array.from(new Set(yeasts.map((yeast) => yeast.brand))).sort(), [yeasts]);
  const derived = calculateNutrientDerivedState(data);
  const selectedKeys = NUTRIENT_KEYS.filter((key) => data.selected.selectedNutrients[key]);
  const nutrientName = (key: NutrientKey) =>
    key === "other" ? data.settings.other.name.trim() || t("other.label") : t(`nutrients.${key}`);

  return { data, dispatch, derived, yeasts, brands, yeastCatalog, presetCatalog, selectedKeys, nutrientName };
}

export type NutrientCalculator = ReturnType<typeof useNutrientCalculator>;
