import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import lodash from "lodash";
import Fuse from "fuse.js";

function useSuggestions<T extends { [key: string]: any }>(
  items: T[],
  query: string,
  key: keyof T
) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);

  // Memoize translated search keys
  const fuse = useMemo(() => {
    const listWithTranslatedKeys = items.map((item) => ({
      ...item,
      __translated: t(lodash.camelCase(item[key]?.toString())),
    }));

    return new Fuse(listWithTranslatedKeys, {
      keys: ["__translated"],
      includeScore: true,
      threshold: 0.4, // adjust fuzziness here
    });
  }, [items, key, t]);

  useEffect(() => {
    if (query.trim().length === 0) {
      setIsDropdownVisible(false);
      setSuggestions([]);
      return;
    }

    const results = fuse.search(query);
    const matched = results.map((r) => r.item);

    setIsDropdownVisible(true);
    setSuggestions(matched);
  }, [query, fuse]);

  useEffect(() => {
    if (
      suggestions[0] &&
      t(lodash.camelCase(suggestions[0][key]?.toString())) === query
    ) {
      setIsDropdownVisible(false);
    }
  }, [suggestions, key, query, t]);

  return {
    suggestions,
    isDropdownVisible,
  };
}

export default useSuggestions;
