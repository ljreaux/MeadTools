"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ReleaseEmailPreferencesResponse,
  ReleaseEmailPreferencesUpdateBody,
} from "@meadtools/api-contract/contracts";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthToken } from "@/hooks/auth/useAuthToken";

function headers(token: string | null) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
  };
}

export function useReleaseEmails() {
  const { user } = useAuth();
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const queryKey = [
    "account",
    "release-emails",
    String(user?.id ?? "anonymous"),
  ];

  const preferences = useQuery<ReleaseEmailPreferencesResponse>({
    queryKey,
    enabled: Boolean(user),
    queryFn: async () => {
      const response = await fetch("/api/account/release-emails", {
        headers: headers(token),
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error("Unable to load release email preferences.");
      return response.json();
    },
    staleTime: 60_000,
    retry: false,
  });

  const save = useMutation({
    mutationFn: async (choices: ReleaseEmailPreferencesUpdateBody) => {
      const response = await fetch("/api/account/release-emails", {
        method: "PATCH",
        headers: headers(token),
        body: JSON.stringify(choices),
      });
      if (!response.ok)
        throw new Error("Unable to save release email preferences.");
      return response.json() as Promise<ReleaseEmailPreferencesResponse>;
    },
    onSuccess: (saved) => queryClient.setQueryData(queryKey, saved),
  });

  return { preferences, save };
}
