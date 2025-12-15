"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDownUp } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue
} from "@/components/ui/select";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";

import { Button } from "@/components/ui/button";
import { AccountPagination } from "@/components/account/pagination";
import { usePagination } from "@/hooks/usePagination";

import LogRow from "./LogRow";
import LogBatchDeleteForm from "./LogBatchDeleteForm";
import { Skeleton } from "@/components/ui/skeleton";

function LogTable({
  logs,
  removeLog,
  deviceId,
  loading,
  skeletonRows
}: {
  logs: any[];
  removeLog: (id: string) => void;
  deviceId: string;
  loading?: boolean;
  skeletonRows?: number;
}) {
  const { t } = useTranslation();

  const headerKeys = [
    "date",
    "gravity",
    "iSpindelDashboard.calculatedGravity",
    "temperature",
    "desktop.editOrDelete"
  ];

  const {
    currentItems,
    pageCount,
    currentPage, // 0-based
    nextPage,
    prevPage,
    goToPage, // 1-based
    options,
    setNumberPerPage,
    perPage
  } = usePagination(5, logs);

  const [isOpen, setIsOpen] = useState(false);

  const isLoading = !!loading;
  const rowsToShow = skeletonRows ?? perPage; // keeps skeleton height consistent with current per-page

  return (
    <div className="w-full max-w-full min-w-0 space-y-3">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium whitespace-nowrap">
            {t("pagination.perPage", "Per page:")}
          </span>

          {isLoading ? (
            <Skeleton className="h-9 w-[140px]" />
          ) : (
            <Select
              value={String(perPage)}
              onValueChange={(val) => setNumberPerPage(parseInt(val, 10))}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-md border border-border bg-card">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              {headerKeys.map((key, i) => (
                <TableHead key={key} className="whitespace-nowrap">
                  {isLoading ? (
                    <Skeleton
                      className={[
                        "h-4",
                        i === 0 && "w-[160px]", // date
                        i === 1 && "w-[90px]", // gravity
                        i === 2 && "w-[140px]", // calculated gravity
                        i === 3 && "w-[120px]", // temperature
                        i === 4 && "w-[160px]" // actions
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                  ) : (
                    t(key)
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <LogTableSkeleton rows={rowsToShow} />
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headerKeys.length} className="py-6">
                  {t("noLogs")}
                </TableCell>
              </TableRow>
            ) : (
              currentItems.map((log) => (
                <LogRow
                  key={log.id}
                  log={log}
                  remove={() => removeLog(log.id)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {isLoading ? (
        <div className="flex justify-center pt-1">
          <Skeleton className="h-10 w-[260px]" />
        </div>
      ) : (
        <AccountPagination
          page={currentPage + 1}
          totalPages={pageCount}
          canPrev={currentPage > 0}
          canNext={currentPage < pageCount - 1}
          onPrev={prevPage}
          onNext={nextPage}
          onGoTo={goToPage}
        />
      )}

      {/* Batch delete range */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex justify-center sm:justify-end">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              disabled={isLoading}
            >
              {t("iSpindelDashboard.logDeleteRange")}
              <ArrowDownUp className="h-4 w-4 opacity-70" />
              <span className="sr-only">Toggle</span>
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="pt-2">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <LogBatchDeleteForm deviceId={deviceId} />
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default LogTable;

function LogTableSkeleton({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r}>
          {/* DateTimePicker */}
          <TableCell>
            <Skeleton className="h-9 w-[180px] sm:w-[220px] rounded-md" />
          </TableCell>

          {/* gravity input */}
          <TableCell>
            <Skeleton className="h-9 w-[110px] rounded-md" />
          </TableCell>

          {/* calculated gravity input */}
          <TableCell>
            <Skeleton className="h-9 w-[140px] rounded-md" />
          </TableCell>
          {/* temperature InputGroup (single control) */}
          <TableCell>
            <Skeleton className="h-9 w-[150px] rounded-md" />
          </TableCell>

          {/* action buttons (ButtonGroup-style) */}
          <TableCell className="min-w-48">
            <div className="flex w-1/2">
              <Skeleton className="h-9 w-1/2 rounded-l-md rounded-r-none" />
              <Skeleton className="h-9 w-1/2 rounded-r-md rounded-l-none -ml-px" />
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
