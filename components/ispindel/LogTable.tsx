"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import LogRow from "./LogRow";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ArrowDownUp } from "lucide-react";
import { useState } from "react";
import { usePagination } from "@/hooks/usePagination";
import LogBatchDeleteForm from "./LogBatchDeleteForm";

function LogTable({
  logs,
  removeLog,
  deviceId,
}: {
  logs: any[];
  removeLog: (id: string) => void;
  deviceId: string;
}) {
  const { t } = useTranslation();
  const {
    currentItems,
    pageCount,
    currentPage,
    nextPage,
    prevPage,

    options,
    setNumberPerPage,
  } = usePagination(5, logs);

  const headerKeys = [
    "date",
    "gravity",
    "iSpindelDashboard.calculatedGravity",
    "temperature",
    "desktop.editOrDelete",
  ];

  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="max-w-full my-4 border-2 rounded-sm border-input">
      <Table className="max-w-full">
        <TableHeader>
          <TableRow>
            {headerKeys.map((key) => (
              <TableHead key={key}>{t(key)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.length === 0 && (
            <TableRow>
              <TableCell colSpan={headerKeys.length}>{t("noLogs")}</TableCell>
            </TableRow>
          )}
          {currentItems.map((log) => (
            <LogRow key={log.id} log={log} remove={() => removeLog(log.id)} />
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={headerKeys.length}>
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage === 0}
                    onClick={prevPage}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span>
                    {currentPage + 1} / {pageCount}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={currentPage >= pageCount - 1}
                    onClick={nextPage}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-4">
                  <Select
                    defaultValue={options[0].value.toString()}
                    onValueChange={(val) => setNumberPerPage(parseInt(val))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt) => (
                        <SelectItem
                          key={opt.value}
                          value={opt.value.toString()}
                        >
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={headerKeys.length}>
              <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <div className="flex items-center justify-center">
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <h3>{t("iSpindelDashboard.logDeleteRange")}</h3>
                      <ArrowDownUp className="w-4 h-4" />
                      <span className="sr-only">Toggle</span>
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <LogBatchDeleteForm deviceId={deviceId} />
                </CollapsibleContent>
              </Collapsible>
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export default LogTable;
