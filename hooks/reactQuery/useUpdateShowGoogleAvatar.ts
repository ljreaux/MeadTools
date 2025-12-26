"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/db/queryKeys";
import type { AccountInfo, AuthUser } from "@/lib/api/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";

export function useUpdateShowGoogleAvatar() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const fetchWithAuth = useFetchWithAuth();

  return useMutation({
    mutationFn: async (showGoogleAvatar: boolean) => {
      const data = await fetchWithAuth<{ show_google_avatar?: boolean }>(
        "/api/auth/account-info",
        {
          method: "PATCH",
          body: JSON.stringify({ show_google_avatar: showGoogleAvatar })
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
              show_google_avatar: updatedUser.show_google_avatar ?? false
            }
          };
        }
      );

      // Update lightweight auth cache (from useAuth)
      queryClient.setQueryData<AuthUser | null>(qk.authMe, (old) => {
        if (!old) return old;
        return {
          ...old,
          show_google_avatar: updatedUser.show_google_avatar ?? false
        };
      });

      toast({
        title: t("auth.avatar.success.title"),
        description: t("auth.avatar.success.description")
      });
    },

    onError: (error: any) => {
      const message = error?.message ?? t("auth.avatar.error.description");

      toast({
        title: t("auth.avatar.error.title"),
        description: message,
        variant: "destructive"
      });
    }
  });
}
