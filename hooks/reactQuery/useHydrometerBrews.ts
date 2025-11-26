"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";

type StartBrewArgs = {
  deviceId: string;
  brewName: string | null;
};

type EndBrewArgs = {
  deviceId: string;
  brewId: string | null;
};

export function useHydrometerBrews() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  const startBrewMutation = useMutation({
    mutationFn: async ({ deviceId, brewName }: StartBrewArgs) => {
      // Backend currently returns [brew, device]
      const [brew, device] = await fetchWithAuth<[any, any]>(
        "/api/hydrometer/brew",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: deviceId,
            brew_name: brewName
          })
        }
      );

      return { brew, device };
    },
    onSuccess: () => {
      // Device card needs updated brew_id / status
      queryClient.invalidateQueries({ queryKey: qk.hydrometerInfo });
      // Brew list (Brews table, useBrewById, etc.) needs the new/updated brew
      queryClient.invalidateQueries({ queryKey: qk.hydrometerBrews });
    }
  });

  const endBrewMutation = useMutation({
    mutationFn: async ({ deviceId, brewId }: EndBrewArgs) => {
      // Old code ignored the first tuple element; still return it in case we want it later
      const [brew, device] = await fetchWithAuth<[any, any]>(
        "/api/hydrometer/brew",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_id: deviceId,
            brew_id: brewId
          })
        }
      );

      return { brew, device };
    },
    onSuccess: () => {
      // Device no longer has an active brew
      queryClient.invalidateQueries({ queryKey: qk.hydrometerInfo });
      // Brew list should reflect end_date / status change
      queryClient.invalidateQueries({ queryKey: qk.hydrometerBrews });
    }
  });

  return {
    startBrew: (deviceId: string, brewName: string | null) =>
      startBrewMutation.mutateAsync({ deviceId, brewName }),

    endBrew: (deviceId: string, brewId: string | null) =>
      endBrewMutation.mutateAsync({ deviceId, brewId }),

    isStarting: startBrewMutation.isPending,
    isEnding: endBrewMutation.isPending
  };
}
