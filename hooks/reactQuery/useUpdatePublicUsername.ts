"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/db/queryKeys";
import type { AccountInfo, AuthUser } from "@/lib/api/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";

export function useUpdatePublicUsername() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const fetchWithAuth = useFetchWithAuth();

  return useMutation({
    mutationFn: async (username: string) => {
      const data = await fetchWithAuth<{ public_username?: string }>(
        "/api/auth/account-info",
        {
          method: "PATCH",
          body: JSON.stringify({ public_username: username })
        }
      );

      return data;
    },

    onSuccess: (updatedUser) => {
      // Update full account info (includes recipes)
      queryClient.setQueryData<AccountInfo | undefined>(
        qk.accountInfo,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            user: {
              ...old.user,
              public_username: updatedUser.public_username ?? null
            }
          };
        }
      );

      // Update lightweight auth cache (from useAuth)
      queryClient.setQueryData<AuthUser | null>(qk.authMe, (old) => {
        if (!old) return old;
        return {
          ...old,
          public_username: updatedUser.public_username ?? null
        };
      });

      toast({
        title: t("auth.username.success.title"),
        description: t("auth.username.success.description")
      });
    },

    onError: (error: any) => {
      const message = error?.message ?? t("auth.username.error.description");

      toast({
        title: t("auth.username.error.title"),
        description: message,
        variant: "destructive"
      });
    }
  });
}
