"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import type { BrewEntryType, BrewStage } from "@/lib/brewEnums";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import type { TempUnits } from "@/lib/brewEnums";
import { qk } from "@/lib/db/queryKeys";

export type AccountBrewListItem = {
  id: string;
  name: string | null;
  start_date: string; // ISO string from API
  end_date: string | null;

  stage: BrewStage;
  current_volume_liters: number | null;

  recipe_id: number | null;
  recipe_name: string | null;

  entry_count: number;
  latest_gravity: number | null;
};

export type AccountBrewEntry = {
  id: string;
  datetime: string; // ISO
  type: BrewEntryType;
  title: string | null;
  note: string | null;

  gravity: number | null;
  temperature: number | null;
  temp_units: string | null;

  data: any | null;
  user_id: number | null;
};

export type AccountEntriesByStage = Array<{
  stage: BrewStage;
  entries: AccountBrewEntry[];
}>;

export type AccountBrew = {
  id: string;
  name: string | null;
  start_date: string;
  end_date: string | null;

  stage: BrewStage;
  batch_number: number | null;
  current_volume_liters: number | null;

  latest_gravity: number | null;

  recipe_id: number | null;
  recipe_name: string | null;

  recipe_snapshot: any | null;
  entry_count: number;

  entries: AccountBrewEntry[];
  entries_by_stage: AccountEntriesByStage;
};

export type CreateBrewEntryInput =
  | {
      type:
        | typeof BREW_ENTRY_TYPE.NOTE
        | typeof BREW_ENTRY_TYPE.TASTING
        | typeof BREW_ENTRY_TYPE.ISSUE;
      datetime?: string; // ISO, optional
      title?: string | null;
      note?: string | null;
      data?: any | null;
    }
  | {
      type: typeof BREW_ENTRY_TYPE.GRAVITY;
      datetime?: string;
      title?: string | null;
      note?: string | null;
      gravity: number; // required for GRAVITY
      data?: any | null;
    }
  | {
      type: typeof BREW_ENTRY_TYPE.TEMPERATURE;
      datetime?: string;
      title?: string | null;
      note?: string | null;
      temperature: number; // required
      temp_units: TempUnits; // required
      data?: any | null;
    }
  | {
      type: typeof BREW_ENTRY_TYPE.PH;
      datetime?: string;
      title?: string | null;
      note?: string | null;
      // store the pH value in data for now, or add a column later
      data: { ph: number } & Record<string, any>;
    };

const accountBrewsQk = qk.accountBrews;

export function useAccountBrews() {
  const fetchWithAuth = useFetchWithAuth();

  return useQuery<AccountBrewListItem[]>({
    queryKey: accountBrewsQk.list(),
    queryFn: async () => {
      // GET /api/brews -> { brews: BrewListItem[] }
      const res = await fetchWithAuth<{ brews: AccountBrewListItem[] }>(
        "/api/brews"
      );
      return res.brews;
    },
    staleTime: 5 * 60 * 1000
  });
}

/**
 * Detail query (full brew: entries + entries_by_stage)
 */
export function useAccountBrew(brewId?: string) {
  const fetchWithAuth = useFetchWithAuth();

  return useQuery<AccountBrew>({
    queryKey: brewId
      ? accountBrewsQk.detail(brewId)
      : accountBrewsQk.detail(""),
    enabled: Boolean(brewId),
    queryFn: async () => {
      return await fetchWithAuth<AccountBrew>(`/api/brews/${brewId}`);
    },
    staleTime: 60 * 1000
  });
}

/**
 * POST /api/brews
 */
export type CreateAccountBrewInput = {
  recipe_id: number;
  name?: string | null;
  current_volume_liters?: number | null;
};

export function useCreateAccountBrew() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateAccountBrewInput) => {
      const res = await fetchWithAuth<{ brew: AccountBrewListItem }>(
        "/api/brews",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        }
      );
      return res.brew;
    },
    onSuccess: (brew) => {
      // insert into list cache (simple + predictable)
      queryClient.setQueryData<AccountBrewListItem[] | undefined>(
        accountBrewsQk.list(),
        (old) => (old ? [brew, ...old] : [brew])
      );
    }
  });
}

/**
 * PATCH /api/brews/:brewId  (metadata only)
 */
export type PatchAccountBrewMetadataInput = {
  name?: string | null;
  stage?: BrewStage;
  current_volume_liters?: number | null;
  requested_email_alerts?: boolean;
  end_date?: string | null; // ISO or null
};

export function usePatchAccountBrewMetadata() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      brewId,
      input
    }: {
      brewId: string;
      input: PatchAccountBrewMetadataInput;
    }) => {
      // your route returns updated metadata object (not full brew)
      return await fetchWithAuth<AccountBrewListItem>(`/api/brews/${brewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
    },

    onSuccess: (updated) => {
      // update list cache
      queryClient.setQueryData<AccountBrewListItem[] | undefined>(
        accountBrewsQk.list(),
        (old) =>
          old
            ? old.map((b) => (b.id === updated.id ? { ...b, ...updated } : b))
            : old
      );

      // also update detail cache if it exists (only metadata fields)
      queryClient.setQueryData<AccountBrew | undefined>(
        accountBrewsQk.detail(updated.id),
        (old) => (old ? ({ ...old, ...updated } as AccountBrew) : old)
      );
    }
  });
}

/**
 * DELETE /api/brews/:brewId
 */
export function useDeleteAccountBrew() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (brewId: string) => {
      await fetchWithAuth(`/api/brews/${brewId}`, { method: "DELETE" });
      return brewId;
    },
    onSuccess: (brewId) => {
      queryClient.setQueryData<AccountBrewListItem[] | undefined>(
        accountBrewsQk.list(),
        (old) => (old ? old.filter((b) => b.id !== brewId) : old)
      );
      queryClient.removeQueries({ queryKey: accountBrewsQk.detail(brewId) });
    }
  });
}
