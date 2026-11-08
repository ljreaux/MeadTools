"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/auth/useAuth";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { inventoryCurrencyResponseSchema } from "@meadtools/api-contract/inventory";
import type { UpdateInventoryCostExclusionsRequestBody } from "@meadtools/api-contract/contracts";
import {
  brewCostResponseSchema,
  inventoryCostExclusionsResponseSchema,
  publicCostSummaryResponseSchema,
  recipeCostResponseSchema,
} from "@meadtools/api-contract/inventory-costs";
import { InventoryRequestError } from "./useInventory";

function useCostRequest() {
  const token = useAuthToken();
  return async (path: string, init?: RequestInit) => {
    const response = await fetch(`/api${path}`, {
      ...init,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new InventoryRequestError(body.code ?? "FAILED");
    return body;
  };
}

export function useInventoryCurrency() {
  const { user } = useAuth();
  const request = useCostRequest();
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (currency: string) =>
      inventoryCurrencyResponseSchema.parse(
        await request("/account/inventory/currency", {
          method: "PUT",
          body: JSON.stringify({ currency }),
        }),
      ),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["account", "inventory", user?.id] }),
  });
}

export function useBrewCosts(brewId: string) {
  const { user } = useAuth();
  const request = useCostRequest();
  const client = useQueryClient();
  const queryKey = ["account", "brew-costs", user?.id, brewId] as const;
  const operation = useRef<string | null>(null);
  const query = useQuery({
    queryKey,
    enabled: Boolean(user && brewId),
    retry: false,
    queryFn: async () =>
      brewCostResponseSchema.parse(await request(`/brews/${brewId}/costs`)),
  });
  const mutation = useMutation({
    mutationFn: async (
      change:
        | { action: "recalculate" }
        | { action: "share"; share_cost_summary: boolean }
        | { action: "exclude_use"; key: string; excluded: boolean },
    ) => {
      // Keep the operation ID across retries of the same recalculation.
      if (change.action === "recalculate")
        operation.current ??= crypto.randomUUID();
      return brewCostResponseSchema.parse(
        await request(`/brews/${brewId}/costs`, {
          method: "POST",
          body: JSON.stringify(
            change.action === "recalculate"
              ? { action: "recalculate", operation_id: operation.current }
              : change,
          ),
        }),
      );
    },
    onSuccess: (data, change) => {
      if (change.action === "recalculate") operation.current = null;
      client.setQueryData(queryKey, data);
    },
  });
  return { query, mutation };
}

export function useRecipeCosts(recipeId: number | string, enabled = true) {
  const { user } = useAuth();
  const request = useCostRequest();
  const client = useQueryClient();
  const queryKey = ["account", "recipe-costs", user?.id, String(recipeId)] as const;
  const query = useQuery({
    queryKey,
    enabled: Boolean(user && enabled),
    retry: false,
    queryFn: async () =>
      recipeCostResponseSchema.parse(await request(`/recipes/${recipeId}/costs`)),
  });
  const mutation = useMutation({
    mutationFn: async (share: boolean) =>
      recipeCostResponseSchema.parse(
        await request(`/recipes/${recipeId}/costs`, {
          method: "PATCH",
          body: JSON.stringify({ share_cost_summary: share }),
        }),
      ),
    onSuccess: (data) => client.setQueryData(queryKey, data),
  });
  return { query, mutation };
}

/** Opt-in public totals; null when the owner has not shared a summary. */
export function usePublicCostSummary(target: "brews" | "recipes", id: string | number) {
  return useQuery({
    queryKey: ["public-cost-summary", target, String(id)],
    retry: false,
    queryFn: async () => {
      const response = await fetch(`/api/${target}/${id}/costs?public=true`, { cache: "no-store" });
      if (!response.ok) return null;
      return publicCostSummaryResponseSchema.parse(await response.json()).summary;
    },
  });
}

/** Account-wide "don't track cost" choices; refreshes every cost view on change. */
export function useCostExclusions(enabled = true) {
  const { user } = useAuth();
  const request = useCostRequest();
  const client = useQueryClient();
  const queryKey = ["account", "cost-exclusions", user?.id] as const;
  const query = useQuery({
    queryKey,
    enabled: Boolean(user && enabled),
    retry: false,
    queryFn: async () =>
      inventoryCostExclusionsResponseSchema.parse(await request("/account/inventory/cost-exclusions")),
  });
  const mutation = useMutation({
    mutationFn: async (change: UpdateInventoryCostExclusionsRequestBody) =>
      inventoryCostExclusionsResponseSchema.parse(
        await request("/account/inventory/cost-exclusions", {
          method: "PATCH",
          body: JSON.stringify(change),
        }),
      ),
    onSuccess: async (data) => {
      client.setQueryData(queryKey, data);
      await Promise.all([
        client.invalidateQueries({ queryKey: ["account", "brew-costs"] }),
        client.invalidateQueries({ queryKey: ["account", "recipe-costs"] }),
        client.invalidateQueries({ queryKey: ["account", "inventory", user?.id] }),
      ]);
    },
  });
  return { query, mutation };
}
