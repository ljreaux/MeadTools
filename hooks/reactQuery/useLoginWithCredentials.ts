"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { qk } from "@/lib/db/queryKeys";
import { useTranslation } from "react-i18next";

type LoginPayload = {
  email: string;
  password: string;
};

export function useLoginWithCredentials() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ email, password }: LoginPayload) => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.error ?? "Invalid login. Please check your credentials."
        );
      }

      const { accessToken, role, id } = await res.json();

      // store token for our account-info fetch
      if (typeof window !== "undefined" && accessToken) {
        localStorage.setItem("accessToken", accessToken);
      }

      return { accessToken, role, id, email };
    },
    onSuccess: (_data, variables) => {
      toast({
        title: t("login.success.title"),
        description: t("login.success.description", {
          userEmail: variables.email
        })
      });

      // Kick account-info query so useAuth picks up the new user
      queryClient.invalidateQueries({ queryKey: qk.accountInfo });
    },
    onError: (error: any) => {
      toast({
        title: t("login.error.title"),
        description: error.message ?? "Could not log you in.",
        variant: "destructive"
      });
    }
  });
}
