import Fuse from "fuse.js";
import { useEffect, useMemo, useState } from "react";

interface FuzzySearchProps<T> {
  data: T[];
  pageSize: number;
  searchKey: keyof T | (keyof T)[];
  sortBy?: ((fieldOne: T, fieldTwo: T) => number)[];
}

export const useFuzzySearch = <T>({
  data,
  pageSize,
  searchKey,
  sortBy
}: FuzzySearchProps<T>) => {
  const [page, setPage] = useState(0); // 0-based internal
  const [search, setSearch] = useState("");

  const keys = useMemo(
    () =>
      Array.isArray(searchKey) ? searchKey.map(String) : [String(searchKey)],
    [searchKey]
  );

  const filteredData = useMemo(() => {
    let result: T[] =
      searchKey && search
        ? new Fuse(data || [], {
            keys,
            threshold: 0.4
          })
            .search(search)
            .map((r) => r.item)
        : (data ?? []);

    // prevent in-place sort mutations
    if (sortBy && sortBy.length > 0) {
      result = [...result];
      sortBy.forEach((fn) => {
        result.sort(fn);
      });
    }

    return result;
  }, [data, keys, search, searchKey, sortBy]);

  const totalPages = useMemo(() => {
    if (!filteredData) return 0;
    return Math.ceil(filteredData.length / pageSize);
  }, [filteredData, pageSize]);

  // Clamp internal page whenever data/pageSize/search changes in a way that
  // might invalidate current page.
  useEffect(() => {
    if (totalPages === 0) {
      setPage(0);
      return;
    }
    setPage((prev) => {
      const maxIndex = Math.max(0, totalPages - 1);
      return Math.min(Math.max(prev, 0), maxIndex);
    });
  }, [totalPages]);

  const start = page * pageSize;
  const end = start + pageSize;
  const pageData = filteredData ? filteredData.slice(start, end) : [];

  // When the search string changes, reset to first page.
  useEffect(() => {
    setPage(0);
  }, [search]);

  // When pageSize changes, reset to first page (prevents landing on empty pages).
  useEffect(() => {
    setPage(0);
  }, [pageSize]);

  const goToPage = (pageNumber: number) => {
    // pageNumber is 1-based from UI
    setPage(() => {
      if (totalPages <= 0) return 0;
      const maxIndex = Math.max(0, totalPages - 1);
      const idx = pageNumber - 1;
      return Math.min(Math.max(idx, 0), maxIndex);
    });
  };

  const nextPage = () => {
    setPage((prev) => {
      if (totalPages <= 0) return 0;
      const maxIndex = Math.max(0, totalPages - 1);
      return Math.min(prev + 1, maxIndex);
    });
  };

  const prevPage = () => {
    setPage((prev) => Math.max(prev - 1, 0));
  };

  return {
    page: page + 1, // 1-based for UI
    goToPage,
    nextPage,
    prevPage,
    searchValue: search,
    search: (val: string) => setSearch(val),
    clearSearch: () => setSearch(""),
    totalPages,
    pageData,
    filteredData,
    start,
    end
  };
};
