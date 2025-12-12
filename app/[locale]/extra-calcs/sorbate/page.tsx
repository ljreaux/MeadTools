"use client";

import InputWithUnits from "@/components/nutrientCalc/InputWithUnits";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  isValidNumber,
  parseNumber,
  normalizeNumberString
} from "@/lib/utils/validateInput";
import { useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";

function Sorbate() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const [sorbate, setSorbate] = useState({
    batchSize: (1).toLocaleString(currentLocale),
    units: "gallons",
    abv: (12).toLocaleString(currentLocale)
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!isValidNumber(e.target.value)) return;

    setSorbate((prev) => ({
      ...prev,
      [e.target.id]: e.target.value
    }));
  };

  const batchSizeNum = parseNumber(sorbate.batchSize);
  const abvNum = parseNumber(sorbate.abv);

  const sorbateAmount =
    sorbate.units === "gallons"
      ? ((-abvNum * 25 + 400) / 0.75) * batchSizeNum * 0.003785411784
      : (((-abvNum * 25 + 400) / 0.75) * batchSizeNum) / 1000;

  const sorbateAmountDisplay = normalizeNumberString(
    sorbateAmount,
    3,
    currentLocale
  );

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-3xl mx-auto">
      {/* Heading */}
      <h1 className="sm:text-3xl text-xl text-center text-foreground">
        {t("sorbateHeading")}
      </h1>

      {/* Inputs */}
      <div className="flex flex-col gap-6">
        {/* Batch size + units (mirrors Brix/Sulfite) */}
        <div className="space-y-2">
          <label htmlFor="batchSize" className="text-sm font-medium">
            {t("batchSize")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="batchSize"
              inputMode="decimal"
              value={sorbate.batchSize}
              onFocus={(e) => e.target.select()}
              onChange={handleChange}
              className="h-full text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              <Separator orientation="vertical" className="h-12" />
              <Select
                value={sorbate.units}
                onValueChange={(val) =>
                  setSorbate((prev) => ({ ...prev, units: val }))
                }
              >
                <SelectTrigger className="p-2 border-none mr-2 w-20">
                  <SelectValue placeholder={t("GAL")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gallons">{t("GAL")}</SelectItem>
                  <SelectItem value="liter">{t("LIT")}</SelectItem>
                </SelectContent>
              </Select>
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* ABV */}
        <div className="space-y-2">
          <label htmlFor="abv" className="text-sm font-medium">
            {t("ABV")}
          </label>

          <InputWithUnits
            value={sorbate.abv}
            handleChange={handleChange}
            text="%"
          />
        </div>
      </div>

      {/* Result – centered, like Brix/ABV */}
      <div className="mt-auto flex justify-center">
        <div className="text-center">
          <p className="sm:text-2xl text-lg font-semibold tracking-tight">
            {sorbateAmountDisplay} g
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("kSorb")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Sorbate;
