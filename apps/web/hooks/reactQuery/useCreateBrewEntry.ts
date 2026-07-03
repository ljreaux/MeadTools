"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";
import type {
  AccountBrew,
  CreateBrewEntryInput,
  PatchBrewEntryInput
} from "@/hooks/reactQuery/useAccountBrews";
const accountBrewsQk = qk.accountBrews;
export function useCreateBrewEntry() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      brewId,
      input
    }: {
      brewId: string;
      input: CreateBrewEntryInput;
    }) => {
      // POST /api/brews/:brewId/entries -> { brew: AccountBrew }
      const res = await fetchWithAuth<{ brew: AccountBrew }>(
        `/api/brews/${brewId}/entries`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        }
      );

      return res.brew;
    },

    onSuccess: (data, vars) => {
      queryClient.setQueryData(accountBrewsQk.detail(vars.brewId), data);

      // list cache may need updates (entry_count/latest_gravity/stage)
      queryClient.invalidateQueries({ queryKey: accountBrewsQk.list() });
    }
  });
}

export function usePatchBrewEntry() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      brewId,
      entryId,
      input
    }: {
      brewId: string;
      entryId: string;
      input: PatchBrewEntryInput;
    }) => {
      await fetchWithAuth(`/api/brews/${brewId}/entries/${entryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const res = await fetchWithAuth<AccountBrew>(`/api/brews/${brewId}`);
      return res;
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(accountBrewsQk.detail(vars.brewId), data);
      queryClient.invalidateQueries({ queryKey: accountBrewsQk.list() });
    }
  });
}

export function useDeleteBrewEntry() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ brewId, entryId }: { brewId: string; entryId: string }) => {
      await fetchWithAuth(`/api/brews/${brewId}/entries/${entryId}`, {
        method: "DELETE"
      });
      const res = await fetchWithAuth<AccountBrew>(`/api/brews/${brewId}`);
      return res;
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(accountBrewsQk.detail(vars.brewId), data);
      queryClient.invalidateQueries({ queryKey: accountBrewsQk.list() });
    }
  });
}
