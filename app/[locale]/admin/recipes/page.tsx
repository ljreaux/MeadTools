"use client";

import { useState, useEffect } from "react";
import { useAdminRecipesQuery } from "@/hooks/reactQuery/useAdminRecipesQuery";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Loading from "@/components/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { LucideX } from "lucide-react";

const PAGE_SIZE = 10;

function RecipesDashboard() {
  const [page, setPage] = useState(1); // backend is 1-based
  const [search, setSearch] = useState("");

  const debouncedSearch = useDebouncedValue(search, 400);

  // Reset to first page whenever the debounced search term changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, isError, isFetching } = useAdminRecipesQuery({
    page,
    limit: PAGE_SIZE,
    search: debouncedSearch || undefined
  });

  if (isLoading && !data) {
    return <Loading />;
  }

  if (isError) {
    return <div>An error has occured.</div>;
  }

  if (!data) return null;

  const { recipes, totalCount, totalPages } = data;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl">Recipes</h1>

      {/* Search input (hits DB, not local Fuse) */}
      <div className="flex items-center gap-2">
        <label htmlFor="search" className="text-sm font-medium">
          Search:
        </label>
        <div className="relative max-w-sm">
          <Input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, username…"
            className="pr-8"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <LucideX />
            </button>
          )}
        </div>
        {isFetching && (
          <span className="text-xs text-muted-foreground">Updating…</span>
        )}
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Private Recipe</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="text-center">
                No recipes found.
              </TableCell>
            </TableRow>
          ) : (
            recipes.map((recipe) => (
              <TableRow key={recipe.id}>
                <TableCell>{recipe.name}</TableCell>
                <TableCell>{recipe.public_username || "—"}</TableCell>
                <TableCell>{recipe.private ? "Yes" : "No"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {/* Pagination (uses totalCount/totalPages from DB) */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-sm">
        <span>
          Showing{" "}
          {totalCount === 0
            ? "0"
            : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(
                page * PAGE_SIZE,
                totalCount
              )} of ${totalCount}`}
        </span>

        <div className="flex items-center gap-4">
          <Button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page} of {totalPages || 1}
          </span>
          <Button
            disabled={page >= (totalPages || 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

export default RecipesDashboard;
