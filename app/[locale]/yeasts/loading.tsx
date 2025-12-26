// app/(whatever)/yeasts/loading.tsx

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  PaginationLink,
  PaginationEllipsis
} from "@/components/ui/pagination";

export default function Loading() {
  // Roughly match your real table: 6 columns, 10 rows
  const columns = Array.from({ length: 6 });
  const rows = Array.from({ length: 10 });

  return (
    <>
      {/* Heading skeleton – same spot as real title */}
      <h1 className="sm:text-3xl text-xl text-center text-foreground">
        <Skeleton className="h-7 w-40 mx-auto" />
      </h1>

      {/* Search + controls row – same flex wrapper as real table */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Global search skeleton */}
        <div className="w-full sm:max-w-[50%] flex flex-col gap-1">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-9 w-full" />
        </div>

        {/* Brand + Temperature filters (same layout as real) */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 sm:items-end">
          {/* Brand filter */}
          <div className="flex flex-col gap-1 sm:w-[200px]">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>

          {/* Temperature units */}
          <div className="flex flex-col gap-1 sm:w-[180px]">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        </div>
      </div>

      {/* Table wrapper – same classes as real table */}
      <div className="mt-4 w-full overflow-x-auto rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((_, idx) => (
                <TableHead
                  key={idx}
                  className={
                    idx === 0
                      ? "sticky left-0 z-10 bg-card border-r min-w-[160px]"
                      : ""
                  }
                >
                  <Skeleton className="h-4 w-24" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {rows.map((_, rIdx) => (
              <TableRow key={rIdx} className="text-xs sm:text-sm">
                {columns.map((_, cIdx) => (
                  <TableCell
                    key={cIdx}
                    className={
                      cIdx === 0 ? "sticky left-0 z-10 bg-card border-r" : ""
                    }
                  >
                    <Skeleton className="h-4 w-full max-w-[120px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination skeleton – same wrapper as real pagination */}
      <div className="space-y-1 mt-3">
        <Pagination>
          <PaginationContent>
            {/* Previous */}
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled="true"
                className="pointer-events-none opacity-50"
              >
                <Skeleton className="h-8 w-16" />
              </PaginationPrevious>
            </PaginationItem>

            {/* First page */}
            <PaginationItem className="hidden sm:list-item">
              <PaginationLink href="#" aria-disabled="true">
                <Skeleton className="h-8 w-6" />
              </PaginationLink>
            </PaginationItem>

            {/* Ellipsis + middle pages */}
            <PaginationItem className="hidden sm:list-item">
              <PaginationEllipsis />
            </PaginationItem>

            <PaginationItem className="hidden sm:list-item">
              <PaginationLink href="#" aria-disabled="true">
                <Skeleton className="h-8 w-6" />
              </PaginationLink>
            </PaginationItem>

            {/* Mobile compact display */}
            <PaginationItem className="sm:hidden text-xs text-muted-foreground px-2">
              <Skeleton className="h-4 w-16 mx-auto" />
            </PaginationItem>

            {/* Next */}
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled="true"
                className="pointer-events-none opacity-50"
              >
                <Skeleton className="h-8 w-16" />
              </PaginationNext>
            </PaginationItem>
          </PaginationContent>
        </Pagination>

        {/* Page info skeleton – matches real text block */}
        <p className="mt-1 text-[11px] text-muted-foreground text-center hidden sm:block">
          <Skeleton className="h-3 w-40 mx-auto" />
        </p>
      </div>
    </>
  );
}
