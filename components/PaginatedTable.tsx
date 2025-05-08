"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "./ui/input";
import Fuse from "fuse.js";
import { LucideX } from "lucide-react";
interface PaginatedTableProps<T> {
  data: T[];
  columns: {
    key: keyof T;
    header: string;
    render?: (item: T) => React.ReactNode;
  }[];
  pageSize?: number;
  onRowClick?: (item: T) => void;
  searchKey?: keyof T | (keyof T)[];
}

export function PaginatedTable<T>({
  data,
  columns,
  pageSize = 10,
  onRowClick,
  searchKey,
}: PaginatedTableProps<T>) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const keys = Array.isArray(searchKey)
    ? searchKey.map(String)
    : [String(searchKey)];

  const filteredData =
    searchKey && search
      ? new Fuse(data, {
          keys,
          threshold: 0.4,
        })
          .search(search)
          .map((r) => r.item)
      : data;

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const start = page * pageSize;
  const end = start + pageSize;
  const pageData = filteredData.slice(start, end);

  return (
    <div className="space-y-4">
      {searchKey && (
        <div className="flex items-center gap-2">
          <label htmlFor="search" className="text-sm font-medium">
            Search:
          </label>
          <div className="relative max-w-sm">
            <Input
              id="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={`Search ${
                Array.isArray(searchKey)
                  ? searchKey.map((key) => String(key)).join(", ")
                  : String(searchKey)
              }`}
              className="pr-8" // Add space for the clear button
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(0);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <LucideX />
              </button>
            )}
          </div>
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={String(col.key)}>{col.header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageData.map((item, i) => (
            <TableRow
              key={i}
              className={onRowClick ? "cursor-pointer hover:bg-muted" : ""}
              onClick={onRowClick ? () => onRowClick(item) : undefined}
            >
              {columns.map((col) => {
                const isEmpty =
                  item[col.key] === null ||
                  item[col.key] === undefined ||
                  item[col.key] === "";
                return (
                  <TableCell
                    key={String(col.key)}
                    className={isEmpty ? "text-muted-foreground" : ""}
                  >
                    {col.render
                      ? col.render(item)
                      : isEmpty
                        ? "—"
                        : String(item[col.key])}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-sm">
        <span>
          Showing{" "}
          {filteredData.length === 0
            ? "0"
            : `${start + 1}–${Math.min(end, filteredData.length)} of ${filteredData.length}`}
        </span>

        <div className="flex items-center gap-4">
          <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <Button
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
