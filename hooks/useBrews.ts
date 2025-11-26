"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/db/queryKeys";
import { useFetchWithAuth } from "@/hooks/useFetchWithAuth";

export type Brew = {
  id: string;
  start_date: string; // ISO from API
  end_date: string | null;
  latest_gravity: number | null;
  recipe_id: number | null;
  name: string | null;
  requested_email_alerts: boolean;
};

export function useBrews() {
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

    onSuccess: (_, { brewId, requested }) => {
      // Optimistically update cached brews
      queryClient.setQueryData<Brew[] | undefined>(
        qk.hydrometerBrews,
        (old) => {
          if (!old) return old;
          return old.map((brew) =>
            brew.id === brewId
              ? { ...brew, requested_email_alerts: requested }
              : brew
          );
        }
      );
    }
  });
}

export function useBrewById(brewId?: string) {
  const brewsQuery = useBrews();
  const brew =
    brewId && brewsQuery.data
      ? (brewsQuery.data.find((b) => b.id === brewId) ?? null)
      : null;

  return {
    ...brewsQuery,
    brew
  };
}

type LinkBrewArgs = {
  brewId: string;
  recipeId: number;
};

export function useLinkBrewToRecipe() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ brewId, recipeId }: LinkBrewArgs) => {
      // PATCH /api/hydrometer/brew/:brewId
      const updated = await fetchWithAuth<Brew>(
        `/api/hydrometer/brew/${brewId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipe_id: recipeId })
        }
      );
      return updated;
    },

    onSuccess: (updatedBrew) => {
      queryClient.setQueryData<Brew[] | undefined>(
        qk.hydrometerBrews,
        (old) => {
          if (!old) return old;
          return old.map((b) => (b.id === updatedBrew.id ? updatedBrew : b));
        }
      );
    }
  });
}

export function useDeleteBrew() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (brewId: string) => {
      // DELETE /api/hydrometer/brew/:brewId
      await fetchWithAuth(`/api/hydrometer/brew/${brewId}`, {
        method: "DELETE"
      });
      return brewId;
    },
    onSuccess: (brewId) => {
      queryClient.setQueryData<Brew[] | undefined>(qk.hydrometerBrews, (old) =>
        old ? old.filter((b) => b.id !== brewId) : old
      );
    }
  });
}

type UpdateNameArgs = {
  brewId: string;
  name: string | null;
};

export function useUpdateBrewName() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ brewId, name }: UpdateNameArgs) => {
      // Matches old provider: PATCH /api/hydrometer/brew
      const updated = await fetchWithAuth<Brew>("/api/hydrometer/brew", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brew_id: brewId,
          brew_name: name
        })
      });
      return updated;
    },
    onSuccess: (updatedBrew) => {
      queryClient.setQueryData<Brew[] | undefined>(qk.hydrometerBrews, (old) =>
        old ? old.map((b) => (b.id === updatedBrew.id ? updatedBrew : b)) : old
      );
    }
  });
}
