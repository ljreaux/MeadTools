"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/db/queryKeys";
import { useFetchWithAuth } from "@/hooks/useFetchWithAuth";

export type Brew = {
  id: string;
  start_date: string; // ISO from API
  end_date: string | null; // ISO or null
  latest_gravity: number | null;
  recipe_id: number | null;
  name: string | null;
  requested_email_alerts: boolean;
};

export function useHydrometerBrews() {
  const fetchWithAuth = useFetchWithAuth();

  return useQuery<Brew[]>({
    queryKey: qk.hydrometerBrews,
    queryFn: async () => {
      // GET /api/hydrometer/brew -> Brew[]
      return await fetchWithAuth<Brew[]>("/api/hydrometer/brew");
    },
    staleTime: 5 * 60 * 1000
  });
}

type UpdateEmailArgs = {
  brewId: string;
  requested: boolean;
};

export function useUpdateEmailAlerts() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ brewId, requested }: UpdateEmailArgs) => {
      // PATCH /api/hydrometer/brew/:brewId
      return await fetchWithAuth(`/api/hydrometer/brew/${brewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_email_alerts: requested
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.hydrometerBrews });
    }
  });
}
