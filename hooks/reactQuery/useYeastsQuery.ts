import { qk } from "@/lib/db/queryKeys";
import { Yeast } from "@/types/nutrientTypes";

import { useQuery } from "@tanstack/react-query";

export function useYeastsQuery() {
  return useQuery<Yeast[]>({
    queryKey: qk.yeasts,

    queryFn: async () => {
      const res = await fetch("/api/yeasts");

      if (!res.ok) {
        const err: any = new Error(`HTTP ${res.status}`);
        err.status = res.status;
        throw err;
      }

      return (await res.json()) as Yeast[];
    },

    staleTime: 5 * 60 * 1000
  });
}
