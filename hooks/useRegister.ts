"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { qk } from "@/lib/db/queryKeys";
import { useTranslation } from "react-i18next";

export function useRegister() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (payload: {
      email: string;
      password: string;
      public_username?: string;
    }) => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Registration failed.");
      }

      // save token for logged-in user
      if (typeof window !== "undefined" && data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken);
      }

      return data;
    },

    onSuccess: () => {
      toast({
        title: t("auth.registration.success.title", "Registration successful."),
        description: t(
          "auth.registration.success.description",
          "Your account has been created!"
        )
      });

      // Revalidate account info immediately
      queryClient.invalidateQueries({ queryKey: qk.authMe });
      queryClient.invalidateQueries({ queryKey: qk.accountInfo });
    },

    onError: (error: any) => {
      toast({
        title: t("auth.registration.error.title", "Registration Failed"),
        description: error.message,
        variant: "destructive"
      });
    }
  });
}
