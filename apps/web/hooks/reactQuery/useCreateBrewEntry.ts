"use client";

import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import {
  useBrewInventory,
  type BrewStockIntent,
} from "@/components/brews/BrewInventoryProvider";
import { toast } from "@/hooks/use-toast";
import { tryInventoryEntryLines } from "@meadtools/inventory-domain";
import { qk } from "@/lib/db/queryKeys";
import type {
  BrewInventorySelection,
  BrewInventoryOutcome,
} from "@meadtools/api-contract/contracts";
import type {
  AccountBrew,
  CreateBrewEntryInput,
  PatchBrewEntryInput,
} from "@/hooks/reactQuery/useAccountBrews";

const accountBrewsQk = qk.accountBrews;
type Attempt = {
  signature: string;
  entryId: string;
  operationId: string;
  selection?: BrewInventorySelection;
};
function useEntryInventory() {
  const inventory = useBrewInventory();
  const client = useQueryClient();
  const { t } = useTranslation();
  const attempt = useRef<Attempt | null>(null);
  function prepare(signature: unknown, entryId?: string) {
    const value = JSON.stringify(signature);
    if (attempt.current?.signature !== value)
      attempt.current = {
        signature: value,
        entryId: entryId ?? crypto.randomUUID(),
        operationId: crypto.randomUUID(),
      };
    return attempt.current;
  }
  async function run<T>(
    intent: BrewStockIntent,
    write: (selection?: BrewInventorySelection) => Promise<T>,
  ) {
    return inventory ? inventory.run(intent, write) : write();
  }
  function outcome(
    result: BrewInventoryOutcome | undefined,
    physicalUse: boolean,
  ) {
    if (!physicalUse) return;
    if (result?.status === "reconciliation_required")
      toast({ duration: 5000, description: t("brewInventory.reconciliation") });
    else if (inventory?.canManage && result?.status === "untracked")
      toast({ duration: 5000, description: t("brewInventory.notUpdated") });
  }
  function failure() {
    void client.invalidateQueries({ queryKey: ["account", "brew-inventory"] });
  }
  function success() {
    attempt.current = null;
    void client.invalidateQueries({ queryKey: ["account", "inventory"] });
    void client.invalidateQueries({ queryKey: ["account", "brew-inventory"] });
  }
  return { prepare, run, outcome, success, failure };
}
export function useCreateBrewEntry() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();
  const inventory = useEntryInventory();
  return useMutation({
    mutationFn: async ({
      brewId,
      input,
    }: {
      brewId: string;
      input: CreateBrewEntryInput;
    }) => {
      const attempt = inventory.prepare(
        { brewId, input },
        input.client_entry_id,
      );
      const write = async (selection?: BrewInventorySelection) => {
        attempt.selection = selection;
        const res = await fetchWithAuth<{
          brew: AccountBrew;
          inventory?: BrewInventoryOutcome;
        }>(`/api/brews/${brewId}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            ...(input.type === "ADDITION" || input.type === "PACKAGING"
              ? { client_entry_id: attempt.entryId }
              : {}),
            ...(selection ? { inventory: selection } : {}),
          }),
        });
        inventory.outcome(
          res.inventory,
          tryInventoryEntryLines(
            input.type,
            "data" in input ? input.data : undefined,
          ).length > 0,
        );
        return res.brew;
      };
      return inventory.run(
        {
          kind: "create",
          brewId,
          entryId: attempt.entryId,
          operationId: attempt.operationId,
          entryType: input.type,
          data: "data" in input ? input.data : undefined,
          retrySelection: attempt.selection,
          selection: input.inventory,
        },
        write,
      );
    },
    onError: () => inventory.failure(),
    onSuccess: (data, vars) => {
      inventory.success();
      queryClient.setQueryData(accountBrewsQk.detail(vars.brewId), data);
      void queryClient.invalidateQueries({ queryKey: accountBrewsQk.list() });
    },
  });
}
export function usePatchBrewEntry() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();
  const inventory = useEntryInventory();
  return useMutation({
    mutationFn: async ({
      brewId,
      entryId,
      input,
    }: {
      brewId: string;
      entryId: string;
      input: PatchBrewEntryInput;
    }) => {
      const attempt = inventory.prepare({ brewId, entryId, input }, entryId);
      const write = async (selection?: BrewInventorySelection) => {
        attempt.selection = selection;
        const res = await fetchWithAuth<{ inventory?: BrewInventoryOutcome }>(
          `/api/brews/${brewId}/entries/${entryId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...input,
              ...(selection ? { inventory: selection } : {}),
            }),
          },
        );
        inventory.outcome(
          res.inventory,
          Boolean(selection) ||
            res.inventory?.status === "reconciliation_required",
        );
        return fetchWithAuth<AccountBrew>(`/api/brews/${brewId}`);
      };
      return inventory.run(
        {
          kind: "edit",
          brewId,
          entryId,
          operationId: attempt.operationId,
          data: input.data,
          retrySelection: attempt.selection,
          selection: input.inventory,
        },
        write,
      );
    },
    onError: () => inventory.failure(),
    onSuccess: (data, vars) => {
      inventory.success();
      queryClient.setQueryData(accountBrewsQk.detail(vars.brewId), data);
      void queryClient.invalidateQueries({ queryKey: accountBrewsQk.list() });
    },
  });
}
export function useDeleteBrewEntry() {
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();
  const inventory = useEntryInventory();
  return useMutation({
    mutationFn: async ({
      brewId,
      entryId,
      inventory: selection,
    }: {
      brewId: string;
      entryId: string;
      inventory?: BrewInventorySelection;
    }) => {
      const attempt = inventory.prepare(
        { brewId, entryId, selection },
        entryId,
      );
      const write = async (selection?: BrewInventorySelection) => {
        attempt.selection = selection;
        const res = await fetchWithAuth<{ inventory?: BrewInventoryOutcome }>(
          `/api/brews/${brewId}/entries/${entryId}`,
          {
            method: "DELETE",
            ...(selection
              ? {
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ inventory: selection }),
                }
              : {}),
          },
        );
        inventory.outcome(
          res.inventory,
          Boolean(selection) ||
            res.inventory?.status === "reconciliation_required",
        );
        return fetchWithAuth<AccountBrew>(`/api/brews/${brewId}`);
      };
      return inventory.run(
        {
          kind: "remove",
          brewId,
          entryId,
          operationId: attempt.operationId,
          retrySelection: attempt.selection,
          selection,
        },
        write,
      );
    },
    onError: () => inventory.failure(),
    onSuccess: (data, vars) => {
      inventory.success();
      queryClient.setQueryData(accountBrewsQk.detail(vars.brewId), data);
      void queryClient.invalidateQueries({ queryKey: accountBrewsQk.list() });
    },
  });
}

export function useCreateBrewEntryBatch() {
  const fetchWithAuth = useFetchWithAuth();
  const client = useQueryClient();
  const pending = useRef<{
    signature: string;
    entries: CreateBrewEntryInput[];
  } | null>(null);
  return useMutation({
    mutationFn: async ({
      brewId,
      entries,
      operationId,
    }: {
      brewId: string;
      entries: CreateBrewEntryInput[];
      operationId: string;
    }) => {
      const signature = JSON.stringify({ brewId, entries, operationId });
      if (pending.current?.signature !== signature)
        pending.current = {
          signature,
          entries: entries.map((entry) => ({
            ...entry,
            client_entry_id: entry.client_entry_id ?? crypto.randomUUID(),
          })),
        };
      return fetchWithAuth<{ brew: AccountBrew }>(
        `/api/brews/${brewId}/entries/batch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation_id: operationId,
            entries: pending.current.entries,
          }),
        },
      );
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["account", "inventory"] });
      void client.invalidateQueries({
        queryKey: ["account", "brew-inventory"],
      });
    },
    onSuccess: (result, vars) => {
      client.setQueryData(accountBrewsQk.detail(vars.brewId), result.brew);
      void client.invalidateQueries({ queryKey: accountBrewsQk.list() });
    },
  });
}
