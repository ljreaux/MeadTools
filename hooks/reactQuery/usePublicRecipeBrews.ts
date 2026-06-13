"use client";

import { useQuery } from "@tanstack/react-query";

import { qk } from "@/lib/db/queryKeys";
import type { BrewViewListItem } from "@/types/brewView";

export function usePublicRecipeBrews(recipeId?: string | number) {
  return useQuery<BrewViewListItem[]>({
    queryKey: qk.publicRecipeBrews.list(recipeId ?? ""),
    enabled: recipeId != null && String(recipeId).length > 0,
    queryFn: async () => {
      const response = await fetch(`/api/recipes/${recipeId}/brews`);

      if (!response.ok) {
        const err: any = new Error(`HTTP ${response.status}`);
        err.status = response.status;
        throw err;
      }

      const json = (await response.json()) as { brews: BrewViewListItem[] };
      return json.brews;
    },
    staleTime: 60 * 1000
  });
}
