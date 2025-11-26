import { qk } from "@/lib/db/queryKeys";
import { Additive } from "@/types/recipeDataTypes";
import { useQuery } from "@tanstack/react-query";

export function useAdditivesQuery() {
  return useQuery<Additive[]>({
    queryKey: qk.additives,

    queryFn: async () => {
      const res = await fetch("/api/additives");

      if (!res.ok) {
        const err: any = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }

      return (await res.json()) as Additive[];
    },

    staleTime: 5 * 60 * 1000
  });
}
