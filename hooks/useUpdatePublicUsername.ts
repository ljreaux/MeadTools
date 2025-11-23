"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { qk } from "@/lib/db/queryKeys";
import type { AccountInfo, AuthUser } from "@/lib/api/auth";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

export function useUpdatePublicUsername() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (username: string) => {
      const accessToken =
        typeof window !== "undefined"
          ? localStorage.getItem("accessToken")
          : null;
      const nextAuthAccessToken = (session as any)?.accessToken ?? null;

      const res = await fetch("/api/auth/account-info", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(nextAuthAccessToken || accessToken
            ? { Authorization: `Bearer ${nextAuthAccessToken || accessToken}` }
            : {})
        },
        body: JSON.stringify({ public_username: username })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data.error ||
            t(
              "auth.username.error.description",
              "An error occurred while updating your username."
            )
        );
      }

      return data; // should include public_username
    },
    onSuccess: (updatedUser) => {
      // Update full account info cache
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

      // Update lightweight auth cache
      queryClient.setQueryData<any>(qk.authMe, (old: AuthUser) => {
        if (!old) return old;
        return {
          ...old,
          public_username: updatedUser.public_username ?? null
        };
      });

      toast({
        title: t("auth.username.success.title", "Username Updated!"),
        description: t(
          "auth.username.success.description",
          "Your public username has been successfully updated."
        )
      });
    },
    onError: (error: any) => {
      toast({
        title: t("auth.username.error.title", "Update Failed"),
        description: error.message,
        variant: "destructive"
      });
    }
  });
}
