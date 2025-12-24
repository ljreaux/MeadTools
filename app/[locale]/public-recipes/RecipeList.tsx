"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";

import Rating from "@/components/recipes/Rating";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import PerPageSelect from "@/components/pagination/PerPageSelect";
import { parseNumber } from "@/lib/utils/validateInput";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import type { RecipeData } from "@/types/recipeData";

interface Recipe {
  id: number;
  user_id: number | null; // ✅ was number
  name: string;

  // legacy columns may be empty now
  recipeData: string | null; // ✅ allow null/empty
  yanFromSource: string | null;
  yanContribution: string;
  nutrientData: string;
  advanced: boolean;
  nuteInfo: string | null;

  primaryNotes: string[][] | null;
  secondaryNotes: string[][] | null;

  private: boolean;
  public_username: string | null;

  averageRating?: number;
  numberOfRatings?: number;

  // ✅ new
  dataV2?: RecipeData;
}

function getOgFg(recipe: Recipe) {
  // --- V2 path ---
  if (recipe.dataV2) {
    const fg = parseNumber(recipe.dataV2.fg);

    const deltaSg = parseNumber(recipe.dataV2.nutrients?.inputs?.sg ?? "");

    let OG = "N/A";
    let FG = "N/A";

    if (Number.isFinite(fg)) {
      FG = fg.toFixed(3);
    }

    if (Number.isFinite(fg) && Number.isFinite(deltaSg)) {
      const og = fg + (deltaSg - 1);
      OG = og.toFixed(3);
    }

    return { OG, FG };
  }

  // --- legacy fallback ---
  const raw = recipe.recipeData ?? "";
  if (!raw) return { OG: "N/A", FG: "N/A" };

  try {
    const parsed = JSON.parse(raw);
    const ogNum = parseNumber(parsed.OG);
    const fgNum = parseNumber(parsed.FG);

    return {
      OG: Number.isFinite(ogNum) ? ogNum.toFixed(3) : "N/A",
      FG: Number.isFinite(fgNum) ? fgNum.toFixed(3) : "N/A"
    };
  } catch {
    return { OG: "N/A", FG: "N/A" };
  }
}

type Props = {
  recipes: Recipe[];
  page: number;
  totalPages: number;
  totalCount: number;
  query: string;
  pageSize: number;
  allowedPageSizes: number[];
};

export default function RecipeList({
  recipes,
  page,
  totalPages,
  query,
  pageSize,
  allowedPageSizes
}: Props) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  // --- Search state + debounce ---
  const [searchInput, setSearchInput] = useState(query ?? "");
  const debouncedSearch = useDebouncedValue(searchInput, 400);

  // Keep local input in sync if the URL/query prop changes (e.g. via back/forward)
  useEffect(() => {
    setSearchInput(query ?? "");
  }, [query]);

  // When the debounced value changes, update the URL (which triggers a new server fetch)
  useEffect(() => {
    // If the debounced value matches the current query param, nothing to do
    if ((debouncedSearch ?? "").trim() === (query ?? "").trim()) return;

    const params = new URLSearchParams(searchParams.toString());

    const trimmed = debouncedSearch.trim();
    if (trimmed) {
      params.set("query", trimmed);
    } else {
      params.delete("query");
    }

    // Always reset to first page when the search changes
    params.delete("page");

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  }, [debouncedSearch, query, pathname, router, searchParams]);

  const buildHref = (opts: { page?: number; query?: string }) => {
    const params = new URLSearchParams(searchParams.toString());

    const nextQuery =
      opts.query != null && opts.query.trim() !== ""
        ? opts.query.trim()
        : query;

    if (nextQuery) {
      params.set("query", nextQuery);
    } else {
      params.delete("query");
    }

    if (opts.page && opts.page > 1) {
      params.set("page", String(opts.page));
    } else {
      params.delete("page");
    }

    return {
      pathname,
      query: Object.fromEntries(params.entries())
    };
  };

  const handlePageSizeChange = (nextSize: number) => {
    const params = new URLSearchParams(searchParams.toString());

    params.set("pageSize", String(nextSize));
    // reset to first page when page size changes
    params.delete("page");

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  // Build a small window of page numbers around the current page
  const windowSize = 3;
  const startPage = Math.max(1, page - 2);
  const endPage = Math.min(totalPages, startPage + windowSize - 1);
  const pageNumbers = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  return (
    <div className="space-y-6">
      {/* Search + per-page control */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        {/* Search: debounced client-side update of ?query= */}
        <form
          className="w-full sm:max-w-[50%]"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            // Immediate search on enter/click, using current input
            const params = new URLSearchParams(searchParams.toString());
            const trimmed = searchInput.trim();

            if (trimmed) {
              params.set("query", trimmed);
            } else {
              params.delete("query");
            }
            params.delete("page");

            const qs = params.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname);
          }}
        >
          <InputGroup>
            <InputGroupInput
              name="query"
              placeholder={t("searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              type="search"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                type="submit"
                size="icon-xs"
                aria-label={t("searchPlaceholder")}
              >
                <Search />
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>

        {/* Per-page selector */}
        <div className="w-full sm:w-auto sm:flex sm:justify-end">
          <PerPageSelect
            value={pageSize}
            allowedValues={allowedPageSizes}
            onChange={handlePageSizeChange}
            className="w-full sm:w-auto"
            label={t("pagination.perPage")}
          />
        </div>
      </div>

      {/* Recipe cards */}
      <div className="space-y-4">
        {recipes.length > 0 ? (
          recipes.map((recipe) => {
            const { OG, FG } = getOgFg(recipe);
            return (
              <Card
                key={recipe.id}
                className="group border-border hover:bg-muted/60 transition-colors"
              >
                <Link href={`/recipes/${recipe.id}`}>
                  <CardHeader className="flex flex-row items-start justify-between gap-2 pb-1">
                    <div className="flex flex-col gap-1 sm:gap-0">
                      <CardTitle className="text-xl font-semibold text-card-foreground">
                        {recipe.name}
                      </CardTitle>

                      {/* Mobile: rating under title */}
                      <div className="sm:hidden">
                        <Rating
                          averageRating={recipe.averageRating ?? 0}
                          numberOfRatings={recipe.numberOfRatings ?? 0}
                        />
                      </div>
                    </div>

                    {/* Desktop: rating to the right */}
                    <div className="hidden sm:block sm:shrink-0">
                      <Rating
                        averageRating={recipe.averageRating ?? 0}
                        numberOfRatings={recipe.numberOfRatings ?? 0}
                      />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-1 text-sm">
                    <p className="text-muted-foreground group-hover:text-foreground">
                      {t("byUser", {
                        public_username: !!recipe.public_username
                          ? recipe.public_username
                          : "Anonymous"
                      })}
                    </p>

                    <p className="text-muted-foreground group-hover:text-foreground">
                      {t("OG")}: {OG}, {t("FG")}: {FG}
                    </p>
                  </CardContent>
                </Link>
              </Card>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("noRecipesFound") || "No recipes found."}
          </p>
        )}
      </div>

      {/* Pagination (unchanged) */}
      {totalPages > 0 && (
        <div className="space-y-1">
          <Pagination>
            <PaginationContent>
              {/* Previous */}
              <PaginationItem>
                {hasPrev ? (
                  <PaginationPrevious
                    href={buildHref({ page: page - 1 })}
                    aria-label={t("pagination.previous")}
                  >
                    {t("pagination.previous")}
                  </PaginationPrevious>
                ) : (
                  <PaginationPrevious
                    href={buildHref({ page: 1 })}
                    aria-disabled="true"
                    className="pointer-events-none opacity-50"
                    aria-label={t("pagination.previous")}
                  >
                    {t("pagination.previous")}
                  </PaginationPrevious>
                )}
              </PaginationItem>

              {/* Mobile: compact page input */}
              <PaginationItem className="sm:hidden w-full">
                <form
                  method="GET"
                  className="flex items-center justify-center w-full"
                  autoComplete="off"
                >
                  {query && <input type="hidden" name="query" value={query} />}

                  <InputGroup className="h-7">
                    <InputGroupInput
                      type="number"
                      name="page"
                      min={1}
                      max={totalPages}
                      defaultValue={page}
                      className="h-7 px-1 text-center text-xs"
                    />

                    <InputGroupAddon
                      className="px-1 text-[11px] text-muted-foreground select-none"
                      align="inline-end"
                    >
                      / {totalPages}
                    </InputGroupAddon>
                  </InputGroup>
                </form>
              </PaginationItem>

              {/* Desktop: full numbered pagination */}
              {/* First page */}
              <PaginationItem className="hidden sm:list-item">
                <PaginationLink
                  href={buildHref({ page: 1 })}
                  isActive={page === 1}
                  aria-current={page === 1 ? "page" : undefined}
                >
                  1
                </PaginationLink>
              </PaginationItem>

              {/* Ellipsis before window */}
              {startPage > 2 && (
                <PaginationItem className="hidden sm:list-item">
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              {/* Middle window (skip 1 and last) */}
              {pageNumbers.map((p) => {
                if (p === 1 || p === totalPages) return null;
                return (
                  <PaginationItem key={p} className="hidden sm:list-item">
                    <PaginationLink
                      href={buildHref({ page: p })}
                      isActive={p === page}
                      aria-current={p === page ? "page" : undefined}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              {/* Ellipsis after window */}
              {endPage < totalPages - 1 && (
                <PaginationItem className="hidden sm:list-item">
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              {/* Last page */}
              {totalPages > 1 && (
                <PaginationItem className="hidden sm:list-item">
                  <PaginationLink
                    href={buildHref({ page: totalPages })}
                    isActive={page === totalPages}
                    aria-current={page === totalPages ? "page" : undefined}
                  >
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              )}

              {/* Next */}
              <PaginationItem>
                {hasNext ? (
                  <PaginationNext
                    href={buildHref({ page: page + 1 })}
                    aria-label={t("pagination.next")}
                  >
                    {t("pagination.next")}
                  </PaginationNext>
                ) : (
                  <PaginationNext
                    href={buildHref({ page: totalPages })}
                    aria-disabled="true"
                    className="pointer-events-none opacity-50"
                    aria-label={t("pagination.next")}
                  >
                    {t("pagination.next")}
                  </PaginationNext>
                )}
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          <p className="mt-1 text-[11px] text-muted-foreground text-center hidden sm:block">
            {t("pagination.pageInfo", { page, totalPages })}
          </p>
        </div>
      )}
    </div>
  );
}
