"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";
import type {
  AccountBrew,
  AccountBrewListItem,
  CreateBrewEntryInput
} from "@/hooks/reactQuery/useAccountBrews";

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

    onSuccess: (brew) => {
      // detail cache becomes authoritative (server returns entries + entries_by_stage)
      queryClient.setQueryData<AccountBrew | undefined>(
        qk.accountBrews.detail(brew.id),
        brew
      );

      // keep list cache in sync for common fields (name, stage, end_date, counts, etc.)
      queryClient.setQueryData<AccountBrewListItem[] | undefined>(
        qk.accountBrews.list(),
        (old) =>
          old
            ? old.map((b) =>
                b.id === brew.id
                  ? {
                      ...b,
                      id: brew.id,
                      name: brew.name,
                      start_date: brew.start_date,
                      end_date: brew.end_date,
                      stage: brew.stage,
                      current_volume_liters: brew.current_volume_liters,
                      recipe_id: brew.recipe_id,
                      recipe_name: brew.recipe_name,
                      entry_count: brew.entry_count,
                      latest_gravity: brew.latest_gravity
                    }
                  : b
              )
            : old
      );
    }
  });
}
