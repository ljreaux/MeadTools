"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { qk } from "@/lib/db/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export function useLogout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  const mutation = useMutation({
    mutationFn: async () => {
      // next-auth sign out (for Google)
      await signOut({ redirect: false });

      // clear custom credentials token
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken");
      }
    },
    onSuccess: () => {
      // clear auth-related caches
      queryClient.removeQueries({ queryKey: qk.authMe, exact: false });
      queryClient.removeQueries({ queryKey: qk.accountInfo, exact: false });

      toast({
        title: t("auth.logout.success.title", "Logged out successfully."),
        description: t("auth.logout.success.description", "See you next time!")
      });
    }
  });

  return {
    logout: () => mutation.mutate(),
    isLoggingOut: mutation.isPending
  };
}
