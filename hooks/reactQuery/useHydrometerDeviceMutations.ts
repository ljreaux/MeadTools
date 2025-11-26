"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";

type UpdateCoeffArgs = {
  deviceId: string;
  coefficients: number[];
};

export function useHydrometerDeviceMutations() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  const updateCoefficientsMutation = useMutation({
    mutationFn: async ({ deviceId, coefficients }: UpdateCoeffArgs) => {
      return await fetchWithAuth(`/api/hydrometer/device/${deviceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coefficients })
      });
    },
    onSuccess: () => {
      // Device details live inside hydrometerInfo
      queryClient.invalidateQueries({ queryKey: qk.hydrometerInfo });
    }
  });

  const deleteDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return await fetchWithAuth(`/api/hydrometer/device/${deviceId}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      // Remove from device list
      queryClient.invalidateQueries({ queryKey: qk.hydrometerInfo });
    }
  });

  return {
    updateCoefficients: (args: UpdateCoeffArgs) =>
      updateCoefficientsMutation.mutateAsync(args),
    deleteDevice: (deviceId: string) =>
      deleteDeviceMutation.mutateAsync(deviceId),

    isUpdatingCoefficients: updateCoefficientsMutation.isPending,
    isDeletingDevice: deleteDeviceMutation.isPending
  };
}
