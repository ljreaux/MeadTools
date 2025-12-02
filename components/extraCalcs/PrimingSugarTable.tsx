import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "../ui/table";
import { useTranslation } from "react-i18next";
import lodash from "lodash";
import { normalizeNumberString } from "@/lib/utils/validateInput";

type PrimingSugar =
  | {
      amount: number;
      perBottle: {
        label: string;
        amount: number;
      }[];
      label: string;
    }[]
  | undefined;

function PrimingSugarTable({ primingSugar }: { primingSugar: PrimingSugar }) {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  if (!primingSugar) return null;

  const bottleSizes = ["12oz", "22oz", "330ml", "500ml", "750ml"];

  return (
    <div className="mt-6 w-full overflow-x-auto rounded-md border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Sugar name */}
            <TableHead className="min-w-[140px] sticky left-0 z-10 bg-card border-r">
              <span className="text-xs sm:text-sm font-medium">
                {t("primingTable.sugarHeading")}
              </span>
            </TableHead>

            {/* Per batch */}
            <TableHead className="text-right whitespace-nowrap">
              <span className="block text-[11px] sm:text-xs uppercase tracking-wide">
                {t("primingTable.perBatchShort") /* e.g. "Per batch" */}
              </span>
              <span className="block text-[11px] text-muted-foreground">g</span>
            </TableHead>

            {/* Per bottle sizes */}
            {bottleSizes.map((size) => (
              <TableHead key={size} className="text-right whitespace-nowrap">
                <span className="block text-[11px] sm:text-xs uppercase tracking-wide">
                  {t("primingTable.perBottleShort") /* e.g. "Per bottle" */}
                </span>
                <span className="block text-[11px] text-muted-foreground">
                  {size}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {primingSugar.map((sugar) => (
            <TableRow key={sugar.label}>
              {/* Sugar label */}
              <TableCell className="sticky left-0 z-10 bg-card font-medium text-xs sm:text-sm text-muted-foreground border-r">
                {t(lodash.camelCase(sugar.label))}
              </TableCell>

              {/* Per batch amount */}
              <TableCell className="text-right text-xs sm:text-sm">
                {normalizeNumberString(sugar.amount, 3, currentLocale)}g
              </TableCell>

              {/* Per bottle amounts */}
              {sugar.perBottle.map((bottle) => (
                <TableCell
                  key={bottle.label}
                  className="text-right text-xs sm:text-sm"
                >
                  {normalizeNumberString(bottle.amount, 3, currentLocale)}g
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default PrimingSugarTable;
