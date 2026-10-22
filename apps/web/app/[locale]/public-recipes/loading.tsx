// app/[locale]/public-recipes/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem
} from "@/components/ui/pagination";

const CARD_SKELETON_COUNT = 5;

export default function LoadingPublicRecipes() {
  return (
    <div className="flex flex-col p-12 py-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1000px]">
      {/* Title */}
      <Skeleton className="h-7 w-40" />

      {/* Search + per-page select layout */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        {/* Search input skeleton (matches InputGroup width) */}
        <Skeleton className="h-9 w-full sm:max-w-[50%]" />

        {/* Per-page select skeleton */}
        <div className="w-full sm:w-auto sm:flex sm:justify-end">
          <Skeleton className="h-9 w-full sm:w-36" />
        </div>
      </div>

      {/* Recipe cards skeleton */}
      <div className="space-y-4 mt-2">
        {Array.from({ length: CARD_SKELETON_COUNT }).map((_, i) => (
          <Card
            key={i}
            className="border-border hover:bg-muted/60 transition-colors"
          >
            <CardHeader className="flex flex-row items-start justify-between gap-2 pb-1">
              <div className="flex flex-col gap-1 sm:gap-0 w-full">
                {/* Title line */}
                <Skeleton className="h-5 w-2/3" />
                {/* Mobile rating skeleton */}
                <div className="sm:hidden pt-1">
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              {/* Desktop rating skeleton */}
              <div className="hidden sm:block sm:shrink-0">
                <Skeleton className="h-4 w-24" />
              </div>
            </CardHeader>

            <CardContent className="space-y-2 text-sm">
              {/* byUser line */}
              <Skeleton className="h-4 w-32" />
              {/* OG/FG line */}
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination skeleton */}
      <div className="mt-2 space-y-1">
        <Pagination>
          <PaginationContent className="gap-2">
            {/* Previous button */}
            <PaginationItem>
              <Skeleton className="h-8 w-20" />
            </PaginationItem>

            {/* A few page pills (desktop only, matches your real layout) */}
            <PaginationItem className="hidden sm:list-item">
              <Skeleton className="h-8 w-8" />
            </PaginationItem>
            <PaginationItem className="hidden sm:list-item">
              <Skeleton className="h-8 w-8" />
            </PaginationItem>
            <PaginationItem className="hidden sm:list-item">
              <Skeleton className="h-8 w-8" />
            </PaginationItem>

            {/* Next button */}
            <PaginationItem>
              <Skeleton className="h-8 w-20" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>

        {/* Page info text (desktop only, like your t("pagination.pageInfo") line) */}
        <div className="hidden sm:flex justify-center">
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
    </div>
  );
}
