"use client";

import { blendingArr, blendValues } from "@/lib/utils/blendValues";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  isValidNumber,
  normalizeNumberString
} from "@/lib/utils/validateInput";

function Blending() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const [input, setInput] = useState<blendingArr>([
    ["0", "0"],
    ["0", "0"]
  ]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement>,
    row: number,
    col: number
  ) {
    if (!isValidNumber(e.target.value)) return;

    setInput((prev) =>
      prev.map((arr, i) =>
        i === row
          ? ([...arr.slice(0, col), e.target.value, ...arr.slice(col + 1)] as [
              string,
              string
            ])
          : arr
      )
    );
  }

  const { blendedValue, totalVolume } = blendValues(input);

  const blendedValueDisplay = normalizeNumberString(
    blendedValue,
    3,
    currentLocale
  );
  const totalVolumeDisplay = normalizeNumberString(
    totalVolume,
    0,
    currentLocale
  );

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-2xl mx-auto">
      {/* Heading */}
      <h1 className="sm:text-3xl text-xl text-center text-foreground">
        {t("blendingHeading")}
      </h1>

      {/* Inputs – 2 inputs per line (val + vol) */}
      <div className="flex flex-col gap-6">
        {input.map(([val, vol], rowIndex) => (
          <div key={rowIndex} className="flex flex-col gap-6">
            {/* Row */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Value */}
              <div className="flex-1 space-y-2">
                <label
                  htmlFor={`val-${rowIndex}`}
                  className="text-sm font-medium"
                >
                  {t(`val${rowIndex + 1}`)}
                </label>
                <Input
                  id={`val-${rowIndex}`}
                  inputMode="decimal"
                  value={val}
                  onChange={(e) => handleChange(e, rowIndex, 0)}
                  onFocus={(e) => e.target.select()}
                  className="text-lg"
                />
              </div>

              {/* Volume */}
              <div className="flex-1 space-y-2">
                <label
                  htmlFor={`vol-${rowIndex}`}
                  className="text-sm font-medium"
                >
                  {t(`vol${rowIndex + 1}`)}
                </label>
                <Input
                  id={`vol-${rowIndex}`}
                  inputMode="decimal"
                  value={vol}
                  onChange={(e) => handleChange(e, rowIndex, 1)}
                  onFocus={(e) => e.target.select()}
                  className="text-lg"
                />
              </div>
            </div>

            {/* Separator between row 1 and row 2 ONLY */}
            {rowIndex === 0 && <Separator className="my-2" />}
          </div>
        ))}
      </div>

      {/* Results – split like other pages */}
      <div className="w-full max-w-2xl mx-auto flex flex-col gap-3">
        <div className="flex items-center w-full p-2">
          {/* Left: blended value */}
          <div className="flex-1 flex justify-end">
            <div className="text-center mr-3">
              <p className="sm:text-2xl text-lg font-semibold tracking-tight">
                {blendedValueDisplay}
              </p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("blendedVal")}
              </p>
            </div>
          </div>

          {/* Vertical separator */}
          <Separator orientation="vertical" className="h-8" />

          {/* Right: total volume */}
          <div className="flex-1 flex justify-start">
            <div className="text-center ml-3">
              <p className="sm:text-2xl text-lg font-semibold tracking-tight">
                {totalVolumeDisplay}
              </p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("totalVol")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Blending;
