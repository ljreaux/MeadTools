import { qk } from "@/lib/db/queryKeys";
import { Ingredient } from "@/types/recipeDataTypes";
import { useQuery } from "@tanstack/react-query";

export function useIngredientsQuery(category?: string) {
  return useQuery<Ingredient[]>({
    queryKey: qk.ingredients(category),

    queryFn: async () => {
      const url = category
        ? `/api/ingredients?category=${encodeURIComponent(category)}`
        : `/api/ingredients`;

      const res = await fetch(url);

      if (!res.ok) {
        const err: any = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }

      return (await res.json()) as Ingredient[];
    },

    staleTime: 5 * 60 * 1000
  });
}
