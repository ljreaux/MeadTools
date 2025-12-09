"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { calculateAdjunctValues } from "../../lib/utils/benchTrials";
import {
  isValidNumber,
  normalizeNumberString
} from "@/lib/utils/validateInput";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from "../ui/input-group";

interface TrialsProps {
  batchDetails: BatchDetails;
}

export type BatchDetails = {
  batchSize: string;
  sampleSize: string;
  stockSolutionConcentration: string;
  units: string;
};

export default function Trials({ batchDetails }: TrialsProps) {
  const { i18n, t } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const [stockVolume, setStockVolume] = useState<string[]>([
    (0.5).toLocaleString(currentLocale),
    (1).toLocaleString(currentLocale),
    (1.5).toLocaleString(currentLocale),
    (2).toLocaleString(currentLocale)
  ]);

  const handleStockVolumeChange = (index: number, value: string) => {
    setStockVolume((prev) => prev.map((vol, i) => (i === index ? value : vol)));
  };

  return (
    <div className="mt-6 w-full overflow-x-auto rounded-md border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Solution volume input (sticky first column) */}
            <TableHead className="min-w-[140px] sticky left-0 z-10 bg-card border-r">
              <span className="block text-[11px] sm:text-xs uppercase tracking-wide">
                {t("solutionVolume")}
              </span>
            </TableHead>

            {/* Adjunct amount */}
            <TableHead className="text-right align-top whitespace-normal max-w-[120px]">
              <span className="block text-[11px] sm:text-xs uppercase tracking-wide leading-tight">
                {t("adjunctAmount")}
              </span>
            </TableHead>

            {/* Adjunct concentration */}
            <TableHead className="text-right align-top whitespace-normal max-w-[120px]">
              <span className="block text-[11px] sm:text-xs uppercase tracking-wide leading-tight">
                {t("adjunctConcentration")}
              </span>
            </TableHead>

            {/* Scaled adjunct */}
            <TableHead className="text-right align-top whitespace-normal max-w-[120px]">
              <span className="block text-[11px] sm:text-xs uppercase tracking-wide leading-tight">
                {t(`${batchDetails.units}ScaledAdjunct`)}
              </span>
            </TableHead>

            {/* Scaled batch */}
            <TableHead className="text-right align-top whitespace-normal max-w-[120px]">
              <span className="block text-[11px] sm:text-xs uppercase tracking-wide leading-tight">
                {t("scaledBatch")}
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {stockVolume.map((volume, index) => {
            const {
              adjunctAmount,
              adjunctConcentration,
              scaledAdjunct,
              scaledBatch
            } = calculateAdjunctValues(volume, batchDetails);

            return (
              <TableRow key={index} className="text-xs sm:text-sm">
                <TableCell className="sticky left-0 z-10 bg-card border-r align-middle">
                  <InputGroup>
                    <InputGroupInput
                      id={`stockVolume-${index}`}
                      inputMode="decimal"
                      value={volume}
                      onChange={(e) => {
                        if (isValidNumber(e.target.value)) {
                          handleStockVolumeChange(index, e.target.value);
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                    />
                    <InputGroupAddon align="inline-end">
                      {t("ML")}
                    </InputGroupAddon>
                  </InputGroup>
                </TableCell>

                {/* Adjunct amount */}
                <TableCell className="text-right align-middle">
                  {normalizeNumberString(adjunctAmount, 3, currentLocale)}
                </TableCell>

                {/* Adjunct concentration */}
                <TableCell className="text-right align-middle">
                  {normalizeNumberString(
                    adjunctConcentration,
                    3,
                    currentLocale
                  )}
                </TableCell>

                {/* Scaled adjunct */}
                <TableCell className="text-right align-middle">
                  {normalizeNumberString(scaledAdjunct, 3, currentLocale)}
                </TableCell>

                {/* Scaled batch */}
                <TableCell className="text-right align-middle">
                  {normalizeNumberString(scaledBatch, 3, currentLocale)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
