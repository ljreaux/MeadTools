"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";
import type {
  AccountBrew,
  CreateBrewEntryInput
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
