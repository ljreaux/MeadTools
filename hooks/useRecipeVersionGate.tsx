"use client";
import { useRouter } from "next/navigation";
import { RecipeWithParsedFields } from "./reactQuery/useRecipeQuery";
import { useRecipe } from "@/components/providers/RecipeProvider";
import { useEffect } from "react";
import { toast } from "./use-toast";

export default function useRecipeVersionGate(recipe: RecipeWithParsedFields) {
  const router = useRouter();
  const {
    meta: { hydrate }
  } = useRecipe();

  useEffect(() => {
    if (recipe.dataV2) {
      hydrate(recipe.dataV2);
    } else {
      toast({
        title: "Error",
        description:
          "Legacy Recipes are no longer supported, please use the contact page to resolve this issue.",
        variant: "destructive"
      });
      router.push("/account");
    }
  }, [recipe]);
}
