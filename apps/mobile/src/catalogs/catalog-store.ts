import {
  ingredientsResponseSchema,
  nutrientPresetListResponseSchema,
  yeastsResponseSchema,
  type IngredientsResponse,
  type NutrientPresetListResponse,
  type YeastsResponse
} from "@meadtools/api-contract";

import type { OutboxFileSystem } from "../outbox/entry-outbox-store";

/** Public catalogs the calculators read; none of them is account data. */
export type CatalogData = {
  yeasts: YeastsResponse;
  ingredients: IngredientsResponse;
  nutrientPresets: NutrientPresetListResponse;
};
export type CatalogName = keyof CatalogData;

export const CATALOG_NAMES = ["yeasts", "ingredients", "nutrientPresets"] as const satisfies readonly CatalogName[];

const SCHEMAS = {
  yeasts: yeastsResponseSchema,
  ingredients: ingredientsResponseSchema,
  nutrientPresets: nutrientPresetListResponseSchema
} as const;

export type CachedCatalog<N extends CatalogName> = {
  /** When the server returned this copy (ISO 8601). */
  fetchedAt: string;
  data: CatalogData[N];
};

export type CatalogStore = {
  read<N extends CatalogName>(name: N): Promise<CachedCatalog<N> | null>;
  write<N extends CatalogName>(name: N, catalog: CachedCatalog<N>): Promise<void>;
};

const VERSION = 1;
const path = (name: CatalogName) => [`v${VERSION}`, `${name}.json`] as const;
const tempPath = (name: CatalogName) => [`v${VERSION}`, `${name}.json.tmp`] as const;

/**
 * Keeps the last good copy of each catalog as one JSON file. A write goes to a
 * temporary file that is then renamed over the copy, so a crash never leaves a
 * half-written catalog. A copy that no longer matches the API contract (for
 * example after an app update) reads as missing and is replaced on the next
 * successful fetch.
 */
export function createCatalogStore(fileSystem: OutboxFileSystem): CatalogStore {
  return {
    async read(name) {
      const text = await fileSystem.read([...path(name)]);
      if (text === null) return null;
      try {
        const parsed = JSON.parse(text) as { version?: unknown; fetchedAt?: unknown; data?: unknown };
        if (parsed.version !== VERSION || typeof parsed.fetchedAt !== "string") return null;
        if (Number.isNaN(Date.parse(parsed.fetchedAt))) return null;
        const data = SCHEMAS[name].safeParse(parsed.data);
        return data.success ? { fetchedAt: parsed.fetchedAt, data: data.data as CatalogData[typeof name] } : null;
      } catch {
        return null;
      }
    },

    async write(name, catalog) {
      await fileSystem.write([...tempPath(name)], JSON.stringify({ version: VERSION, ...catalog }));
      await fileSystem.move([...tempPath(name)], [...path(name)]);
    }
  };
}
