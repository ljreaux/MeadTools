"use client";

import { NutrientProvider } from "@/components/providers/NutrientProvider";
import {
  RecipeProvider,
  useRecipe
} from "@/components/providers/RecipeProvider";
import { ReactNode } from "react";

function BrewLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-11/12 max-w-[1200px] relative rounded-xl bg-background px-4 py-6 sm:px-12 sm:py-8">
      <RecipeProvider>
        <Nutrients>{children}</Nutrients>
      </RecipeProvider>
    </div>
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
