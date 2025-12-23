"use client";
import { useRouter } from "next/navigation";
import { RecipeWithParsedFields } from "./reactQuery/useRecipeQuery";
import { useRecipeV2 } from "@/components/providers/RecipeProviderV2";
import { useEffect } from "react";
import { toast } from "./use-toast";

export default function useRecipeVersionGate(recipe: RecipeWithParsedFields) {
  const router = useRouter();
  const {
    meta: { hydrate }
  } = useRecipeV2();

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
