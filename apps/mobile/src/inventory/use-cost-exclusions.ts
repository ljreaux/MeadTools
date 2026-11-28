import { useQuery } from "@tanstack/react-query";

import { useApiClient, useSession } from "@/providers/app-providers";

export function useCostExclusions(enabled: boolean) {
  const api = useApiClient();
  const { session } = useSession();
  return useQuery({
    queryKey: ["inventory-cost-exclusions", session?.id],
    queryFn: () => api.getInventoryCostExclusions(),
    enabled: enabled && Boolean(session)
  });
}
