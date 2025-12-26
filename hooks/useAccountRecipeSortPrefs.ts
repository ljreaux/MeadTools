"use client";

import { useEffect, useState } from "react";

export type AccountSortField = "default" | "name" | "id";
export type AccountSortDir = "asc" | "dec";

type SortPrefs = {
  pageSize: number;
  sortField: AccountSortField;
  sortDir: AccountSortDir;
};

const DEFAULT_PREFS: SortPrefs = {
  pageSize: 5,
  sortField: "default",
  sortDir: "asc"
};

export function useAccountRecipeSortPrefs(
  storageKey = "account.recipes.sortPrefs"
) {
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PREFS.pageSize);
  const [sortField, setSortField] = useState<AccountSortField>(
    DEFAULT_PREFS.sortField
  );
  const [sortDir, setSortDir] = useState<AccountSortDir>(DEFAULT_PREFS.sortDir);

  const [hydrated, setHydrated] = useState(false);

  // hydrate from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SortPrefs>;

        if (typeof parsed.pageSize === "number") setPageSize(parsed.pageSize);

        if (
          parsed.sortField === "default" ||
          parsed.sortField === "name" ||
          parsed.sortField === "id"
        ) {
          setSortField(parsed.sortField);
        }

        if (parsed.sortDir === "asc" || parsed.sortDir === "dec") {
          setSortDir(parsed.sortDir);
        }
      }
    } catch {
      // ignore invalid JSON
    } finally {
      setHydrated(true);
    }
  }, [storageKey]);

  // persist ONLY after hydration
  useEffect(() => {
    if (!hydrated) return;
    const prefs: SortPrefs = { pageSize, sortField, sortDir };
    localStorage.setItem(storageKey, JSON.stringify(prefs));
  }, [pageSize, sortField, sortDir, storageKey, hydrated]);

  const resetSortPrefs = () => {
    setPageSize(DEFAULT_PREFS.pageSize);
    setSortField(DEFAULT_PREFS.sortField);
    setSortDir(DEFAULT_PREFS.sortDir);
    localStorage.setItem(storageKey, JSON.stringify(DEFAULT_PREFS));
  };

  return {
    pageSize,
    setPageSize,
    sortField,
    setSortField,
    sortDir,
    setSortDir,
    resetSortPrefs,
    hydrated // optional, but can be handy
  };
}
