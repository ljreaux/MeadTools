import Fuse from "fuse.js";
import { useState } from "react";

interface FuzzySearchProps<T> {
  data: T[];
  pageSize: number;
  searchKey: keyof T | (keyof T)[];
}

export const useFuzzySearch = <T>({
  data,
  pageSize,
  searchKey,
}: FuzzySearchProps<T>) => {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const keys = Array.isArray(searchKey)
    ? searchKey.map(String)
    : [String(searchKey)];

  const filteredData =
    searchKey && search
      ? new Fuse(data || [], {
          keys,
          threshold: 0.4,
        })
          .search(search)
          .map((r) => r.item)
      : data;

  const totalPages = filteredData
    ? Math.ceil(filteredData.length / pageSize)
    : 0;
  const start = page * pageSize;
  const end = start + pageSize;
  const pageData = filteredData ? filteredData.slice(start, end) : [];

  return {
    page: page + 1,
    nextPage: () => setPage(page + 1),
    prevPage: () => setPage(page - 1),
    searchValue: search,
    search: (val: string) => {
      setSearch(val);
      setPage(0);
    },
    clearSearch: () => {
      setSearch("");
      setPage(0);
    },
    totalPages,
    pageData,
    filteredData,
    start,
    end,
  };
};
