"use client";

import { useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";

import { useToast } from "@/hooks/use-toast";
import {
  useUpdateRecipeMutation,
  type UpdateRecipePayload
} from "@/hooks/reactQuery/useRecipeQuery";
import { useRecipe } from "@/components/providers/RecipeProvider";
import type { RecipeData } from "@/types/recipeData";

export function useSaveRecipe({
  name,
  privateRecipe,
  emailNotifications
}: {
  name: string;
  privateRecipe: boolean;
  emailNotifications?: boolean;
}) {
  const { t } = useTranslation();
  const params = useParams();
  const recipeId = params?.id as string | undefined;

  const { toast } = useToast();
  const updateRecipeMutation = useUpdateRecipeMutation();

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
    meta: { markSaved }
  } = useRecipe();

  const dataV2: RecipeData = useMemo(
    () => ({
      version: 2,
      unitDefaults,
      ingredients,
      fg,
      additives,
      stabilizers,
      notes,
      nutrients,
      flags: { private: privateRecipe }
    }),
    [
      unitDefaults,
      ingredients,
      fg,
      additives,
      stabilizers,
      notes,
      nutrients,
      privateRecipe
    ]
  );

  const save = useCallback(() => {
    if (!recipeId) {
      toast({
        title: t("errorLabel"),
        description: t("error.generic"),
        variant: "destructive"
      });
      return;
    }

    const body: UpdateRecipePayload = {
      name,
      private: privateRecipe,
      activityEmailsEnabled: emailNotifications ?? false,
      dataV2
    };

    updateRecipeMutation.mutate(
      { id: recipeId, body },
      {
        onSuccess: () => {
          toast({ description: t("recipeUpdate") });
          markSaved();
        },
        onError: (error: any) => {
          console.error("Error updating recipe:", error);
          toast({
            title: t("errorLabel"),
            description: t("error.generic"),
            variant: "destructive"
          });
        }
      }
    );
  }, [
    recipeId,
    toast,
    t,
    name,
    privateRecipe,
    emailNotifications,
    dataV2,
    updateRecipeMutation,
    markSaved
  ]);

  return {
    save,
    isSaving: updateRecipeMutation.isPending
  };
}
