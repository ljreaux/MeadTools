"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/db/queryKeys";
import { useFetchWithAuth } from "@/hooks/useFetchWithAuth";

export type HydrometerInfo = {
  hydro_token?: string | null;
  devices?: any[];
};

export function useHydrometerInfo() {
  const fetchWithAuth = useFetchWithAuth();

  return useQuery<HydrometerInfo>({
    queryKey: qk.hydrometerInfo,
    queryFn: async () => {
      return await fetchWithAuth<HydrometerInfo>("/api/hydrometer");
    },

    staleTime: 5 * 60 * 1000
  });
}

export function useGenerateHydrometerToken() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetchWithAuth<{ token: string }>(
        "/api/hydrometer/token",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({})
        }
      );

      return res.token;
    },
    onSuccess: (token) => {
      queryClient.setQueryData<HydrometerInfo | undefined>(
        qk.hydrometerInfo,
        (old) => ({
          ...(old || {}),
          hydro_token: token
        })
      );
    }
  });
}
