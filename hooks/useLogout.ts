"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { qk } from "@/lib/db/queryKeys";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";

export function useLogout() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      // 1) next-auth sign out (Google, etc.)
      await signOut({ redirect: false });

      // 2) clear custom credentials token
      if (typeof window !== "undefined") {
        localStorage.removeItem("accessToken");
      }

      // nothing to return
    },
    onSuccess: () => {
      // 3) Wipe auth-related cache *and* data so useAuth immediately sees "logged out"
      queryClient.setQueryData(qk.authMe, null);
      queryClient.setQueryData(qk.accountInfo, undefined);

      queryClient.removeQueries({ queryKey: qk.authMe, exact: false });
      queryClient.removeQueries({ queryKey: qk.accountInfo, exact: false });

      // 4) Toast
      toast({
        title: t("auth.logout.success.title", "Logged out successfully."),
        description: t("auth.logout.success.description", "See you next time!")
      });

      // 5) Hard redirect to login so we don't rely only on layout guard
      router.replace("/login");
    }
  });

  return {
    logout: () => mutation.mutate(),
    isLoggingOut: mutation.isPending
  };
}
