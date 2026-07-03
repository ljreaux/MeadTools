"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";

export type Log = {
  id: string;
  brew_id: string | null;
  device_id: string;
  angle?: number | null;
  temperature: number;
  temp_units?: "C" | "F" | "K";
  battery?: number | null;
  gravity: number;
  interval?: number | null;
  datetime: string; // from DB
  calculated_gravity: number | null;
};

// 1) Logs for a device over a date range (used on device page, RecentLogsForm)
type DeviceLogsArgs = {
  deviceId: string;
  startDate: string; // ISO
  endDate: string; // ISO
};

export function useDeviceLogs({
  deviceId,
  startDate,
  endDate
}: DeviceLogsArgs) {
  const fetchWithAuth = useFetchWithAuth();

  return useQuery<Log[]>({
    queryKey: qk.hydrometerDeviceLogs(deviceId, startDate, endDate),
    queryFn: async () => {
      if (!deviceId) return [];
      return await fetchWithAuth<Log[]>(
        `/api/hydrometer/logs?start_date=${encodeURIComponent(
          startDate
        )}&end_date=${encodeURIComponent(endDate)}&device_id=${deviceId}`
      );
    },
    enabled: !!deviceId && !!startDate && !!endDate
  });
}

// 2) Logs for a brew (used on /account/hydrometer/logs/[brewId])
export function useBrewLogs(brewId?: string) {
  const fetchWithAuth = useFetchWithAuth();

  return useQuery<Log[]>({
    queryKey: qk.hydrometerBrewLogs(brewId || ""),
    queryFn: async () => {
      if (!brewId) return [];
      return await fetchWithAuth<Log[]>(`/api/hydrometer/logs/${brewId}`);
    },
    enabled: !!brewId
  });
}

// 3) Update a log
export function useUpdateLog() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (log: Log) => {
      // The backend does sanitization; we just send the log back
      return await fetchWithAuth<Log>(
        `/api/hydrometer/logs/${log.id}?device_id=${log.device_id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(log)
        }
      );
    },
    onSuccess: (updatedLog) => {
      // Update any device log query that matches this device
      queryClient.setQueriesData<Log[]>(
        { queryKey: qk.hydrometerDeviceLogsPrefix(updatedLog.device_id) },
        (old) => {
          if (!old) return old;
          return old.map((l) => (l.id === updatedLog.id ? updatedLog : l));
        }
      );

      // And the brew logs query (if any)
      if (updatedLog.brew_id) {
        queryClient.setQueryData<Log[] | undefined>(
          qk.hydrometerBrewLogs(updatedLog.brew_id),
          (old) => {
            if (!old) return old;
            return old.map((l) => (l.id === updatedLog.id ? updatedLog : l));
          }
        );
      }
    }
  });
}

// 4) Delete a single log
export function useDeleteLog() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      logId,
      deviceId
    }: {
      logId: string;
      deviceId: string;
    }) => {
      await fetchWithAuth(
        `/api/hydrometer/logs/${logId}?device_id=${deviceId}`,
        { method: "DELETE" }
      );
      return { logId, deviceId };
    },
    onSuccess: ({ logId, deviceId }) => {
      // Remove from any device logs queries for that device
      queryClient.setQueriesData<Log[]>(
        { queryKey: qk.hydrometerDeviceLogsPrefix(deviceId) },
        (old) => {
          if (!old) return old;
          return old.filter((l) => l.id !== logId);
        }
      );
      // Also remove from any brew logs queries that happen to have it
      queryClient.setQueriesData<Log[]>(
        { queryKey: qk.hydrometerBrewLogsPrefix },
        (old) => {
          if (!old) return old;
          return old.filter((l) => l.id !== logId);
        }
      );
    }
  });
}

// 5) Delete logs in a range
type DeleteRangeArgs = {
  startDate: Date;
  endDate: Date;
  deviceId: string;
};

export function useDeleteLogsInRange() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ startDate, endDate, deviceId }: DeleteRangeArgs) => {
      const res = await fetchWithAuth<{ message?: string }>(
        `/api/hydrometer/logs/range?start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}&device_id=${deviceId}`,
        { method: "DELETE" }
      );
      return { deviceId, message: res?.message };
    },
    onSuccess: ({ deviceId }) => {
      // 1) Immediately clear all cached device logs for this device
      queryClient.setQueriesData<Log[]>(
        { queryKey: qk.hydrometerDeviceLogsPrefix(deviceId) },
        () => []
      );

      // 2) Also mark them stale so any active views refetch if needed
      queryClient.invalidateQueries({
        queryKey: qk.hydrometerDeviceLogsPrefix(deviceId)
      });
    }
  });
}
