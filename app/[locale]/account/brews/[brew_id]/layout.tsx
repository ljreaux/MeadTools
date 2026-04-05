"use client";

import { NutrientProvider } from "@/components/providers/NutrientProvider";
import {
  RecipeProvider,
  useRecipe
} from "@/components/providers/RecipeProvider";
import { ReactNode } from "react";

function BrewLayout({ children }: { children: ReactNode }) {
  return (
    <RecipeProvider>
      <Nutrients>{children}</Nutrients>
    </RecipeProvider>
  );
}

export default BrewLayout;

const Nutrients = ({ children }: { children: ReactNode }) => {
  const {
    derived: { nutrientValueForRecipe },
    meta: { setNutrients }
  } = useRecipe();
  return (
    <NutrientProvider
      mode="controlled"
      value={nutrientValueForRecipe}
      onChange={setNutrients}
    >
      {children}
    </NutrientProvider>
  );
};
