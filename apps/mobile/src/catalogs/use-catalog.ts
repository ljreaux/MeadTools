import { useQueries, useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

import type { MeadToolsApiClient } from "@meadtools/api-client";

import { useIsOnline } from "@/hooks/useIsOnline";
import { createExpoDocumentFileSystem } from "@/outbox/expo-outbox-file-system";
import { useApiClient } from "@/providers/app-providers";

import { createCatalogStore, type CatalogData, type CatalogName, type CatalogStore } from "./catalog-store";
import { resolveCatalog, type ResolvedCatalog } from "./resolve-catalog";

let store: CatalogStore | null = null;
const catalogStore = () => (store ??= createCatalogStore(createExpoDocumentFileSystem("meadtools-catalogs")));

const fetchers: { [N in CatalogName]: (client: MeadToolsApiClient) => Promise<CatalogData[N]> } = {
  yeasts: (client) => client.listYeasts(),
  ingredients: (client) => client.listIngredients(),
  nutrientPresets: (client) => client.listNutrientPresets()
};

function catalogQuery<N extends CatalogName>(
  name: N,
  client: MeadToolsApiClient,
  online: boolean
): UseQueryOptions<ResolvedCatalog<N>> {
  return {
    queryKey: ["catalog", name],
    queryFn: () =>
      resolveCatalog({ name, online, fetchRemote: () => fetchers[name](client), store: catalogStore() }),
    // Catalogs change rarely: fetch once per launch, then reuse.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    // Offline the query still runs, so it can read the saved copy.
    networkMode: "always"
  };
}

/** Calls `onReconnect` when the device goes from offline to online. */
function useReconnect(online: boolean, onReconnect: () => void) {
  const wasOnline = useRef(online);
  const callback = useRef(onReconnect);
  useEffect(() => {
    callback.current = onReconnect;
  });
  useEffect(() => {
    if (online && !wasOnline.current) callback.current();
    wasOnline.current = online;
  }, [online]);
}

/**
 * Calls `retry` each time the screen comes back into view. A catalog can fail
 * while the device stays online (the server was down or slow), so no reconnect
 * follows; without this the Tools list would keep asking to connect until the
 * app restarts.
 */
function useRetryOnFocus(retry: () => void) {
  const callback = useRef(retry);
  useEffect(() => {
    callback.current = retry;
  });
  useFocusEffect(useCallback(() => callback.current(), []));
}

/**
 * A public catalog for the calculators, from the server when online and from
 * the device otherwise. A copy read offline is refreshed when the device comes
 * back online.
 */
export function useCatalog<N extends CatalogName>(name: N) {
  const client = useApiClient();
  const online = useIsOnline();
  const query = useQuery(catalogQuery(name, client, online));

  useReconnect(online, () => {
    if (query.data?.source !== "network") void query.refetch();
  });
  useRetryOnFocus(() => {
    if (query.isError) void query.refetch();
  });

  return query;
}

/** Every calculator catalog at once, so all of them are saved for offline use. */
export function useAllCatalogs() {
  const client = useApiClient();
  const online = useIsOnline();
  const results = useQueries({
    queries: (["yeasts", "ingredients", "nutrientPresets"] as const).map((name) =>
      catalogQuery(name, client, online)
    )
  });

  useReconnect(online, () => {
    for (const result of results) if (result.data?.source !== "network") void result.refetch();
  });
  useRetryOnFocus(() => {
    for (const result of results) if (result.isError) void result.refetch();
  });

  return results;
}
