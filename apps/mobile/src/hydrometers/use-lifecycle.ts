import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MeadToolsApiError } from "@meadtools/api-client";
import { isConnectionError } from "@/api/errors";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useApiClient, useSession } from "@/providers/app-providers";

export function useHydrometerCollections() {
  const api = useApiClient();
  const { session } = useSession();
  const retry = (count: number, error: unknown) =>
    !(error instanceof MeadToolsApiError && error.status === 401) && count < 1;
  const devices = useQuery({
    queryKey: ["hydrometerDevices", session?.id],
    queryFn: () => api.listHydrometerDevices(),
    enabled: Boolean(session),
    retry
  });
  const brews = useQuery({
    queryKey: ["hydrometerBrews", session?.id],
    queryFn: () => api.listHydrometerBrews(),
    enabled: Boolean(session),
    retry
  });
  return { devices, brews };
}

export function useHydrometerAction() {
  const cache = useQueryClient();
  const { session } = useSession();
  const online = useIsOnline();
  const inFlight = useRef(false);
  const [failure, setFailure] = useState<"offline" | "session" | "changed" | "failed" | null>(null);
  const mutation = useMutation({
    mutationFn: (operation: () => Promise<unknown>) => operation(),
    retry: false,
    // Refresh after failures too: a lost response may have followed a completed write.
    onSettled: async () => {
      await Promise.all(
        ["hydrometerDevices", "hydrometerBrews", "hydrometerLogs", "brews", "brew"].map((key) =>
          cache.invalidateQueries({ queryKey: [key, session?.id] })
        )
      );
    }
  });
  async function run<T>(operation: () => Promise<T>): Promise<{ value: T } | null> {
    if (inFlight.current || !online) return null;
    inFlight.current = true;
    setFailure(null);
    try {
      return { value: (await mutation.mutateAsync(operation)) as T };
    } catch (error) {
      setFailure(
        isConnectionError(error)
          ? "offline"
          : error instanceof MeadToolsApiError && error.status === 401
            ? "session"
            : error instanceof MeadToolsApiError &&
                (error.status === 404 || error.status === 400 || error.status === 409)
              ? "changed"
              : "failed"
      );
      return null;
    } finally {
      inFlight.current = false;
    }
  }
  return { run, busy: mutation.isPending, online, failure, clearFailure: () => setFailure(null) };
}
