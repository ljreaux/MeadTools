import { qk } from "@/lib/db/queryKeys";
import type { NutrientPreset } from "@/types/nutrientTypes";
import { useQuery } from "@tanstack/react-query";

export function useNutrientPresetsQuery() {
  return useQuery<NutrientPreset[]>({
    queryKey: qk.nutrientPresets,
    queryFn: async () => {
      const res = await fetch("/api/nutrient-presets");

      if (!res.ok) {
        const err: Error & { status?: number } = new Error(
          `HTTP ${res.status}`
        );
        err.status = res.status;
        throw err;
      }

      return (await res.json()) as NutrientPreset[];
    },
    staleTime: 5 * 60 * 1000
  });
}
