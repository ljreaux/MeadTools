import { useQuery } from "@tanstack/react-query";

import { useApiClient, useSession } from "@/providers/app-providers";

export function useStockOverview() {
  const api = useApiClient();
  const { session } = useSession();
  return useQuery({
    queryKey: ["inventory", session?.id],
    queryFn: () => api.getInventoryOverview(),
    enabled: Boolean(session)
  });
}
