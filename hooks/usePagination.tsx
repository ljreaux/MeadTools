import { useEffect, useMemo, useState } from "react";

export const usePagination = (itemsPerPage: number, items: any[]) => {
  const [currentPage, setCurrentPage] = useState(0); // 0-based
  const [perPage, setPerPage] = useState(itemsPerPage);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(items.length / perPage)),
    [items.length, perPage]
  );

  // Keep currentPage in range when items/perPage changes
  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, pageCount - 1));
  }, [pageCount]);

  const currentItems = useMemo(() => {
    const start = currentPage * perPage;
    return items.slice(start, start + perPage);
  }, [items, currentPage, perPage]);

  const nextPage = () => {
    setCurrentPage((prev) => (prev < pageCount - 1 ? prev + 1 : prev));
  };

  const prevPage = () => {
    setCurrentPage((prev) => (prev > 0 ? prev - 1 : prev));
  };

  /** 0-based setter (keep for existing usage) */
  const setPage = (page: number) => {
    const clamped = Math.max(0, Math.min(page, pageCount - 1));
    setCurrentPage(clamped);
  };

  /** 1-based setter (nice for UI components) */
  const goToPage = (page: number) => {
    // AccountPagination uses 1..totalPages
    setPage(page - 1);
  };

  const setNumberPerPage = (num: number) => {
    setPerPage(num);
    setCurrentPage(0); // reset to first page
  };

  const options = [5, 10, 20, 50].map((num) => ({
    value: num,
    label: `${num} items`
  }));

  return {
    currentItems,
    pageCount,
    currentPage, // 0-based
    nextPage,
    prevPage,
    setPage, // 0-based
    goToPage, // 1-based
    options,
    setNumberPerPage,
    perPage
  };
};
