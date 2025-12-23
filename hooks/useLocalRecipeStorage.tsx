"use client";

import { useRecipeV2 } from "@/components/providers/RecipeProviderV2";
import { useEffect, useRef, useState } from "react";

type Options = {
  key: string;
};

export function useLocalRecipeStorage({ key }: Options) {
  const {
    data: {
      unitDefaults,
      ingredients,
      fg,
      stabilizers,
      additives,
      notes,
      nutrients
    },
    meta: { hydrate }
  } = useRecipeV2();

  const [didInit, setDidInit] = useState(false);
  const [didHydrate, setDidHydrate] = useState(false);

  const readyToPersistRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;

      const parsed = JSON.parse(raw);

      const hasStabilizers =
        parsed?.stabilizers &&
        typeof parsed.stabilizers.adding === "boolean" &&
        typeof parsed.stabilizers.takingPh === "boolean" &&
        typeof parsed.stabilizers.phReading === "string" &&
        (parsed.stabilizers.type === "kmeta" ||
          parsed.stabilizers.type === "nameta");

      const hasIngredients = Array.isArray(parsed?.ingredients);

      const hasUnits =
        parsed?.unitDefaults &&
        typeof parsed.unitDefaults.weight === "string" &&
        typeof parsed.unitDefaults.volume === "string";

      const hasFg = typeof parsed?.fg === "string";

      const hasAdditives = Array.isArray(parsed?.additives);

      const hasNotes =
        parsed?.notes &&
        Array.isArray(parsed.notes.primary) &&
        Array.isArray(parsed.notes.secondary);

      const hasNutrients =
        parsed?.nutrients &&
        parsed.nutrients.version === 2 &&
        parsed.nutrients.inputs &&
        typeof parsed.nutrients.inputs.volume === "string" &&
        (parsed.nutrients.inputs.volumeUnits === "gal" ||
          parsed.nutrients.inputs.volumeUnits === "liter") &&
        typeof parsed.nutrients.inputs.sg === "string" &&
        typeof parsed.nutrients.inputs.offsetPpm === "string";

      if (
        hasUnits &&
        hasIngredients &&
        hasFg &&
        hasStabilizers &&
        hasAdditives &&
        hasNotes &&
        hasNutrients
      ) {
        hydrate({
          unitDefaults: parsed.unitDefaults,
          ingredients: parsed.ingredients,
          fg: parsed.fg,
          stabilizers: parsed.stabilizers,
          additives: parsed.additives,
          notes: parsed.notes,
          nutrients: parsed.nutrients
        });

        setDidHydrate(true);
      }
    } finally {
      readyToPersistRef.current = true;
      setDidInit(true);
    }
  }, [key, hydrate]);

  useEffect(() => {
    if (!didInit) return;
    if (!readyToPersistRef.current) return;

    try {
      localStorage.setItem(
        key,
        JSON.stringify({
          unitDefaults,
          ingredients,
          fg,
          stabilizers,
          additives,
          notes,
          nutrients
        })
      );
    } catch {
      // ignore
    }
  }, [
    didInit,
    key,
    unitDefaults,
    ingredients,
    fg,
    stabilizers,
    additives,
    notes,
    nutrients
  ]);

  return { didInit, didHydrate };
}
