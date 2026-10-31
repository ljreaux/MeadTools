"use client";

import { useQuery } from "@tanstack/react-query";
import { premiumAccessResponseSchema } from "@meadtools/api-contract/premium";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthToken } from "@/hooks/auth/useAuthToken";

/** Share rollout and membership status without reusing another account's cache. */
export function usePremiumAccess() {
  const { user } = useAuth();
  const token = useAuthToken();

  return useQuery({
    queryKey: ["premium-access", user?.id, token ? "bearer" : "session"],
    enabled: Boolean(user),
    queryFn: async () => {
      const response = await fetch("/api/account/premium", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Premium status request failed");
      return premiumAccessResponseSchema.parse(await response.json());
    },
    retry: false,
    staleTime: 5_000,
  });
}
