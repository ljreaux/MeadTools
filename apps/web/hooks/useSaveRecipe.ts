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
      nutrients,
      lossAdjustment
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
      lossAdjustment,
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
      lossAdjustment,
      privateRecipe
    ]
  );

  const saveAsync = useCallback(async () => {
    if (!recipeId) {
      throw new Error(t("error.generic"));
    }

    const body: UpdateRecipePayload = {
      name,
      private: privateRecipe,
      activityEmailsEnabled: emailNotifications ?? false,
      dataV2
    };

    await updateRecipeMutation.mutateAsync({ id: recipeId, body });
    toast({ description: t("recipeUpdate") });
    markSaved();
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

  const save = useCallback(() => {
    void saveAsync().catch((error) => {
      console.error("Error updating recipe:", error);
      toast({
        title: t("errorLabel"),
        description: t("error.generic"),
        variant: "destructive"
      });
    });
  }, [saveAsync, toast, t]);

  return {
    save,
    saveAsync,
    isSaving: updateRecipeMutation.isPending
  };
}
