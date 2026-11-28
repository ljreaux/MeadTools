import { useQuery } from "@tanstack/react-query";

import { useApiClient, useSession } from "@/providers/app-providers";

export function useFinishedMeads() {
  const api = useApiClient();
  const { session } = useSession();
  return useQuery({
    queryKey: ["finished-meads", session?.id],
    queryFn: () => api.getFinishedMeads(),
    enabled: Boolean(session)
  });
}

export function useInventoryOrganization(enabled = true) {
  const api = useApiClient();
  const { session } = useSession();
  return useQuery({
    queryKey: ["inventory-organization", session?.id],
    queryFn: () => api.getInventoryOrganization(),
    enabled: enabled && Boolean(session)
  });
}
