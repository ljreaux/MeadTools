import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import lodash from "lodash";
import Fuse from "fuse.js";

function useSuggestions<T extends Record<string, any>>(
  items: T[],
  query: string,
  key: keyof T
) {
  const { t } = useTranslation();

  const fuse = useMemo(() => {
    const listWithTranslatedKeys = items.map((item) => ({
      ...item,
      __translated: t(lodash.camelCase(item[key]?.toString()))
    }));

    return new Fuse(listWithTranslatedKeys, {
      keys: ["__translated"],
      includeScore: true,
      threshold: 0.4
    });
  }, [items, key, t]);

  const suggestions = useMemo(() => {
    if (query.trim().length === 0) return [];
    return fuse.search(query).map((r) => r.item as T);
  }, [fuse, query]);

  return { suggestions };
}

export default useSuggestions;
