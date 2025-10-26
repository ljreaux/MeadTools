import Fuse from "fuse.js";
import { useEffect, useState } from "react";

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
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const keys = Array.isArray(searchKey)
    ? searchKey.map(String)
    : [String(searchKey)];

  let filteredData =
    searchKey && search
      ? new Fuse(data || [], {
          keys,
          threshold: 0.4
        })
          .search(search)
          .map((r) => r.item)
      : data;

  if (sortBy) {
    sortBy.forEach((fn) => {
      filteredData = filteredData.sort(fn);
    });
  }

  const totalPages = filteredData
    ? Math.ceil(filteredData.length / pageSize)
    : 0;
  const start = page * pageSize;
  const end = start + pageSize;
  const pageData = filteredData ? filteredData.slice(start, end) : [];

  useEffect(() => {
    setPage(0);
  }, [search]);

  return {
    page: page + 1,
    nextPage: () => setPage((prev) => prev + 1),
    prevPage: () => setPage((prev) => prev - 1),
    searchValue: search,
    search: (val: string) => setSearch(val),
    clearSearch: () => {
      setSearch("");
    },
    totalPages,
    pageData,
    filteredData,
    start,
    end
  };
};
