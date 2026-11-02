"use client";

import { BrewInventoryProvider } from "@/components/brews/BrewInventoryProvider";
import { NutrientProvider } from "@/components/providers/NutrientProvider";
import {
  RecipeProvider,
  useRecipe
} from "@/components/providers/RecipeProvider";
import { useParams } from "next/navigation";
import { ReactNode } from "react";

function BrewLayout({ children }: { children: ReactNode }) {
  const { brew_id: brewId } = useParams<{ brew_id: string }>();
  return (
    <RecipeProvider>
      <Nutrients>
        <BrewInventoryProvider key={brewId}>{children}</BrewInventoryProvider>
      </Nutrients>
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
