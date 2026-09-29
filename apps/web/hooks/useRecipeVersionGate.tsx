"use client";
import { useRouter } from "next/navigation";
import { RecipeWithParsedFields } from "./reactQuery/useRecipeQuery";
import { useRecipe } from "@/components/providers/RecipeProvider";
import { useEffect } from "react";
import { toast } from "./use-toast";
import { useTranslation } from "react-i18next";

export default function useRecipeVersionGate(recipe: RecipeWithParsedFields) {
  const router = useRouter();
  const {
    meta: { hydrate, hydratedRecipeData }
  } = useRecipe();
  const { t } = useTranslation();

  useEffect(() => {
    if (recipe.dataV2) {
      hydrate(recipe.dataV2);
    } else {
      toast({
        title: t("error"),
        description: t("legacyRecipeMessage"),
        variant: "destructive"
      });
      router.push("/account");
    }
  }, [recipe, hydrate, router, t]);

  return !!recipe.dataV2 && hydratedRecipeData === recipe.dataV2;
}
