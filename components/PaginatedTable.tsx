"use client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import Fuse from "fuse.js";
import { Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "./ui/input-group";
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
  getRowKey?: (item: T) => React.Key;
}

export function PaginatedTable<T>({
  data,
  columns,
  pageSize = 10,
  onRowClick,
  searchKey,
  getRowKey
}: PaginatedTableProps<T>) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const keys = Array.isArray(searchKey)
    ? searchKey.map(String)
    : searchKey
      ? [String(searchKey)]
      : [];

  const filteredData =
    searchKey && search
      ? new Fuse(data, {
          keys,
          threshold: 0.4
        })
          .search(search)
          .map((r) => r.item)
      : data;

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const start = page * pageSize;
  const end = start + pageSize;
  const pageData = filteredData.slice(start, end);

  useEffect(() => {
    if (page > 0 && page >= totalPages) setPage(Math.max(0, totalPages - 1));
  }, [page, totalPages]);

  return (
    <div className="space-y-4">
      {searchKey && (
        <InputGroup className="max-w-xl">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder={t("search", "Search")}
          />
          {search && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                title={t("clear", "Clear")}
                onClick={() => {
                  setSearch("");
                  setPage(0);
                }}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>
      )}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={String(col.key)}>{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length ? (
              pageData.map((item, i) => (
                <TableRow
                  key={getRowKey?.(item) ?? i}
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
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-28 text-center text-muted-foreground"
                >
                  {t("noResults", "No results found.")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 text-sm">
        <span>
          {t("showing", "Showing")}{" "}
          {filteredData.length === 0
            ? "0"
            : `${start + 1}–${Math.min(end, filteredData.length)} of ${filteredData.length}`}
        </span>

        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("previous", "Previous")}
          </Button>
          <span>
            {t("pageOf", "Page {{page}} of {{total}}", {
              page: totalPages ? page + 1 : 1,
              total: totalPages || 1
            })}
          </span>
          <Button
            variant="outline"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("next", "Next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
