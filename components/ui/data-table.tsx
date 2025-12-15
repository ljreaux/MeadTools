"use client";

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "@/components/ui/pagination";

import { SelectGroup, SelectSeparator } from "@radix-ui/react-select";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function DataTable<TData, TValue>({
  columns,
  data
}: DataTableProps<TData, TValue>) {
  const { t } = useTranslation("YeastTable");

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [tempUnit, setTempUnit] = useState<"C" | "F">("F");
  const [brand, setBrand] = useState<string | undefined>(undefined);
  const [brandSelectKey, setBrandSelectKey] = useState(+new Date());

  const [searchInput, setSearchInput] = useState("");
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter
    },
    meta: {
      unit: tempUnit
    },
    globalFilterFn: "includesString",
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize: 10
      }
    }
  });

  // Brand filter → column filter
  useEffect(() => {
    table.getColumn("brand")?.setFilterValue(brand);
  }, [brand, table]);

  // Pagination info (RecipeList-style window)
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = table.getPageCount();
  const currentPage = pageIndex + 1;

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < pageCount;

  const windowSize = 3;
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(pageCount, startPage + windowSize - 1);
  const pageNumbers =
    pageCount > 0
      ? Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i)
      : [];

  const gotoPage = (page: number) => {
    if (page < 1 || page > pageCount) return;
    table.setPageIndex(page - 1);
  };

  return (
    <>
      <h1 className="sm:text-3xl text-xl text-center text-foreground">
        {t("title")}
      </h1>
      {/* Search + controls (RecipeList-style layout) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Global search */}
        <div className="w-full sm:max-w-[50%] flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("searchAll")}
          </span>
          <form
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              const value = searchInput.trim();
              table.setGlobalFilter(value || undefined);
            }}
          >
            <InputGroup>
              <InputGroupInput
                name="query"
                placeholder={t("searchAll")}
                value={searchInput}
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchInput(value);
                  table.setGlobalFilter(value.trim() || undefined);
                }}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                type="search"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="submit"
                  size="icon-xs"
                  variant="ghost"
                  aria-label={t("searchPlaceholder")}
                >
                  <Search />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>

        {/* Brand + Temperature filters (brand first) */}
        <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3 sm:items-end">
          {/* Brand filter */}
          <div className="flex flex-col gap-1 sm:w-[200px]">
            <span className="text-xs font-medium text-muted-foreground">
              {t("brandPlaceholder")}
            </span>
            <Select
              key={brandSelectKey}
              value={brand}
              onValueChange={(val) => setBrand(val)}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder={t("brandPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="Lalvin">{t("brands.lalvin")}</SelectItem>
                  <SelectItem value="Mangrove Jack">
                    {t("brands.mangrove")}
                  </SelectItem>
                  <SelectItem value="Red Star">
                    {t("brands.redstar")}
                  </SelectItem>
                  <SelectItem value="Fermentis">
                    {t("brands.fermentis")}
                  </SelectItem>
                  <SelectItem value="Other">{t("brands.other")}</SelectItem>
                </SelectGroup>
                <SelectSeparator />
                <Button
                  className="w-full px-2 mt-1"
                  variant="secondary"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setBrand(undefined);
                    setBrandSelectKey(+new Date());
                  }}
                >
                  {t("brands.clear")}
                </Button>
              </SelectContent>
            </Select>
          </div>

          {/* Temperature units */}
          <div className="flex flex-col gap-1 sm:w-[180px]">
            <span className="text-xs font-medium text-muted-foreground">
              {t("units.title")}
            </span>
            <Select
              value={tempUnit}
              onValueChange={(val: "C" | "F") => setTempUnit(val)}
            >
              <SelectTrigger className="w-full h-9">
                <SelectValue placeholder="°F" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="F">{t("units.fahrenheit")}</SelectItem>
                  <SelectItem value="C">{t("units.celsius")}</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Table wrapper – PrimingSugar-style */}
      <div className="mt-4 w-full overflow-x-auto rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      "text-foreground text-[11px] sm:text-xs font-semibold uppercase tracking-wide align-bottom whitespace-normal max-w-[140px] px-3 py-2",
                      header.column.id === "name" &&
                        "sticky left-0 z-10 bg-card border-r min-w-[160px]"
                    )}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="text-xs sm:text-sm"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        "px-3 py-2 align-middle",
                        cell.column.id === "name" &&
                          "sticky left-0 z-10 bg-card border-r font-medium text-xs sm:text-sm text-muted-foreground",
                        cell.column.id === "brand" && "whitespace-nowrap"
                      )}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-xs sm:text-sm"
                >
                  {t("noResults") ?? "No results."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination – RecipeList-style, but client-side */}
      {pageCount > 1 && (
        <div className="space-y-1 mt-3">
          <Pagination>
            <PaginationContent>
              {/* Previous */}
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  aria-label={t("pagination.previous")}
                  aria-disabled={!hasPrev}
                  className={!hasPrev ? "pointer-events-none opacity-50" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    if (hasPrev) gotoPage(currentPage - 1);
                  }}
                >
                  {t("pagination.previous")}
                </PaginationPrevious>
              </PaginationItem>

              {/* First page */}
              <PaginationItem className="hidden sm:list-item">
                <PaginationLink
                  href="#"
                  isActive={currentPage === 1}
                  aria-current={currentPage === 1 ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    gotoPage(1);
                  }}
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
                if (p === 1 || p === pageCount) return null;
                return (
                  <PaginationItem key={p} className="hidden sm:list-item">
                    <PaginationLink
                      href="#"
                      isActive={p === currentPage}
                      aria-current={p === currentPage ? "page" : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        gotoPage(p);
                      }}
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}

              {/* Ellipsis after window */}
              {endPage < pageCount - 1 && (
                <PaginationItem className="hidden sm:list-item">
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              {/* Last page */}
              {pageCount > 1 && (
                <PaginationItem className="hidden sm:list-item">
                  <PaginationLink
                    href="#"
                    isActive={currentPage === pageCount}
                    aria-current={
                      currentPage === pageCount ? "page" : undefined
                    }
                    onClick={(e) => {
                      e.preventDefault();
                      gotoPage(pageCount);
                    }}
                  >
                    {pageCount}
                  </PaginationLink>
                </PaginationItem>
              )}

              {/* Mobile: simple page number display */}
              <PaginationItem className="sm:hidden text-xs text-muted-foreground px-2">
                <span>
                  {currentPage} / {pageCount}
                </span>
              </PaginationItem>

              {/* Next */}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  aria-label={t("pagination.next")}
                  aria-disabled={!hasNext}
                  className={!hasNext ? "pointer-events-none opacity-50" : ""}
                  onClick={(e) => {
                    e.preventDefault();
                    if (hasNext) gotoPage(currentPage + 1);
                  }}
                >
                  {t("pagination.next")}
                </PaginationNext>
              </PaginationItem>
            </PaginationContent>
          </Pagination>

          <p className="mt-1 text-[11px] text-muted-foreground text-center hidden sm:block">
            {t("pagination.pageInfo", {
              page: currentPage,
              totalPages: pageCount
            })}
          </p>
        </div>
      )}
    </>
  );
}
