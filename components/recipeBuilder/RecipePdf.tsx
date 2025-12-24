"use client";

import { useMemo } from "react";
import PrintableIframe from "./PrintableIframe";
import RecipePdfView from "./RecipePdfView";

import { useRecipe } from "@/components/providers/RecipeProvider";
import { useNutrients } from "@/components/providers/NutrientProvider";

type Props = {
  // optional metadata you likely have from the saved recipe record
  title?: string;
  publicUsername?: string;
};

export default function RecipePdf({ title, publicUsername }: Props) {
  const recipe = useRecipe();
  const nutrients = useNutrients();

  const yeast = useMemo(() => {
    const yeastList = nutrients.catalog.yeastList ?? [];
    const sel = nutrients.data.selected;

    return (
      (sel.yeastId != null
        ? yeastList.find((y: any) => y.id === sel.yeastId)
        : undefined) ?? yeastList.find((y: any) => y.name === sel.yeastStrain)
    );
  }, [nutrients.catalog.yeastList, nutrients.data.selected]);

  return (
    <PrintableIframe
      content={
        <RecipePdfView
          recipe={recipe}
          nutrients={nutrients}
          yeast={yeast}
          title={title}
          publicUsername={publicUsername}
        />
      }
    />
  );
}
