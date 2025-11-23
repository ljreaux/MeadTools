"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { qk } from "@/lib/db/queryKeys";
import type { AccountInfo } from "@/lib/api/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (recipeId: number) => {
      const storedToken =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      const nextAuthAccessToken = (session as any)?.accessToken ?? null;
      const authToken = nextAuthAccessToken || storedToken;

      const res = await fetch(`/api/recipes/${recipeId}`, {
        method: "DELETE",
        headers: authToken
          ? {
              Authorization: `Bearer ${authToken}`
            }
          : {}
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error ||
            t("auth.delete.error.description", "Failed to delete recipe.")
        );
      }

      return { recipeId, message: data.message as string | undefined };
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
      toast({
        title: t("auth.delete.error.title", "Delete Failed"),
        description: error.message,
        variant: "destructive"
      });
    }
  });
}
