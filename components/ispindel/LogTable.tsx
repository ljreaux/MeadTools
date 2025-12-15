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

function LogTable({
  logs,
  removeLog,
  deviceId
}: {
  logs: any[];
  removeLog: (id: string) => void;
  deviceId: string;
}) {
  const { t } = useTranslation();

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

  const headerKeys = [
    "date",
    "gravity",
    "iSpindelDashboard.calculatedGravity",
    "temperature",
    "desktop.editOrDelete"
  ];

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full max-w-full min-w-0 space-y-3">
      {/* Controls row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium whitespace-nowrap">
            {t("pagination.perPage", "Per page:")}
          </span>

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
        </div>
      </div>

      {/* Table */}
      <div className="w-full max-w-full min-w-0 overflow-x-auto rounded-md border border-border bg-card">
        <Table className="w-full">
          <TableHeader>
            <TableRow>
              {headerKeys.map((key) => (
                <TableHead key={key} className="whitespace-nowrap">
                  {t(key)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {logs.length === 0 ? (
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

      <AccountPagination
        page={currentPage + 1}
        totalPages={pageCount}
        canPrev={currentPage > 0}
        canNext={currentPage < pageCount - 1}
        onPrev={prevPage}
        onNext={nextPage}
        onGoTo={goToPage}
      />

      {/* Batch delete range */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex justify-center sm:justify-end">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              {t("iSpindelDashboard.logDeleteRange")}
              <ArrowDownUp className="h-4 w-4 opacity-70" />
              <span className="sr-only">Toggle</span>
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="pt-2">
          <LogBatchDeleteForm deviceId={deviceId} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default LogTable;
