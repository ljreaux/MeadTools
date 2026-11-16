import type { CachedCatalog, CatalogData, CatalogName, CatalogStore } from "./catalog-store";

/** A catalog has never been downloaded on this device and the network is unavailable. */
export class CatalogUnavailableError extends Error {
  readonly catalog: CatalogName;

  constructor(catalog: CatalogName, cause?: unknown) {
    super(`The ${catalog} catalog has not been downloaded yet`, { cause });
    this.name = "CatalogUnavailableError";
    this.catalog = catalog;
  }
}

export type ResolvedCatalog<N extends CatalogName> = CachedCatalog<N> & {
  /** `network` when just fetched; `cache` when read from the device. */
  source: "network" | "cache";
};

/**
 * Online: fetch, save, and return the fresh list; if the fetch fails, fall back
 * to the saved copy. Offline: return the saved copy without trying the network.
 * Throws `CatalogUnavailableError` only when there is nothing saved to show.
 */
export async function resolveCatalog<N extends CatalogName>(input: {
  name: N;
  online: boolean;
  fetchRemote: () => Promise<CatalogData[N]>;
  store: CatalogStore;
  now?: () => Date;
}): Promise<ResolvedCatalog<N>> {
  const { name, store } = input;
  let fetchError: unknown;

  if (input.online) {
    try {
      const data = await input.fetchRemote();
      const fetchedAt = (input.now?.() ?? new Date()).toISOString();
      // A failed save must not hide a good response; the next fetch saves again.
      await store.write(name, { fetchedAt, data }).catch(() => undefined);
      return { fetchedAt, data, source: "network" };
    } catch (error) {
      fetchError = error;
    }
  }

  const cached = await store.read(name).catch(() => null);
  if (cached) return { ...cached, source: "cache" };
  throw new CatalogUnavailableError(name, fetchError);
}

export type CatalogStatus =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "ready"; updatedAt: string };

/**
 * One status for several catalogs: ready (with the oldest copy's date) only
 * when every catalog is available, missing when any is unavailable.
 */
export function combinedCatalogStatus(
  results: readonly { data?: { fetchedAt: string }; error?: unknown; isPending: boolean }[]
): CatalogStatus {
  if (results.some((result) => result.error)) return { kind: "missing" };
  if (results.some((result) => result.isPending || !result.data)) return { kind: "loading" };
  const updatedAt = results
    .map((result) => result.data!.fetchedAt)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0];
  return { kind: "ready", updatedAt };
}
