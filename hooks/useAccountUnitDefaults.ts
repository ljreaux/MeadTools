"use client";

import { useEffect, useRef } from "react";
import { useRecipeV2 } from "@/components/providers/RecipeProviderV2";

type PreferredUnits = "US" | "METRIC";

export function useAccountUnitDefaults(args: {
  didInit: boolean;
  didHydrate: boolean;
}) {
  const appliedRef = useRef(false);

  const {
    data: { unitDefaults },
    setUnitDefaults
  } = useRecipeV2();

  useEffect(() => {
    if (!args.didInit) return;
    if (args.didHydrate) return; // draft exists -> never override
    if (appliedRef.current) return; // prevent re-apply (StrictMode/remounts)

    const preferred = localStorage.getItem("units") as PreferredUnits | null;

    const next =
      preferred === "METRIC"
        ? ({ weight: "kg", volume: "L" } as const)
        : preferred === "US"
        ? ({ weight: "lb", volume: "gal" } as const)
        : null;

    if (!next) return;

    // If already correct, do nothing
    if (
      unitDefaults.weight === next.weight &&
      unitDefaults.volume === next.volume
    ) {
      appliedRef.current = true;
      return;
    }

    appliedRef.current = true;
    setUnitDefaults(next);
  }, [
    args.didInit,
    args.didHydrate,
    setUnitDefaults,
    unitDefaults.weight,
    unitDefaults.volume
  ]);
}
