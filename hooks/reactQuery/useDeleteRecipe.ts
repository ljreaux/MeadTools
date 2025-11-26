"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/db/queryKeys";
import type { AccountInfo } from "@/lib/api/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";

type DeleteRecipeResponse = {
  message?: string;
  [key: string]: unknown;
};

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const fetchWithAuth = useFetchWithAuth();

  return useMutation({
    mutationFn: async (recipeId: number) => {
      // `fetchWithAuth` will:
      // - attach Authorization header
      // - throw on non-2xx with a typed error
      const data = await fetchWithAuth<DeleteRecipeResponse>(
        `/api/recipes/${recipeId}`,
        { method: "DELETE" }
      );

      return { recipeId, message: data?.message };
    },

    onSuccess: ({ recipeId, message }) => {
      // Update the cached account info (remove recipe)
      queryClient.setQueryData<AccountInfo | undefined>(
        qk.accountInfo,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            recipes: old.recipes.filter((r) => r.id !== recipeId)
          };
        }
      );

      toast({
        title: t("auth.delete.success.title", "Recipe Deleted"),
        description:
          message ||
          t(
            "auth.delete.success.description",
            "Recipe has been successfully deleted."
          )
      });
    },

    onError: (error: any) => {
      // Special-case: no token at all
      if (error?.code === "NO_TOKEN") {
        toast({
          title: t("auth.delete.error.title", "Delete Failed"),
          description: t(
            "auth.delete.error.noToken",
            "You must be logged in to delete a recipe."
          ),
          variant: "destructive"
        });
        return;
      }

      toast({
        title: t("auth.delete.error.title", "Delete Failed"),
        description:
          error?.message ||
          t("auth.delete.error.description", "Failed to delete recipe."),
        variant: "destructive"
      });
    }
  });
}
