"use client";

import { useTranslation } from "react-i18next";
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
import { temperatureCorrection, toFahrenheit } from "@/lib/utils/temperature";
import { useState } from "react";
import { toBrix } from "@/lib/utils/unitConverter";
import {
  isValidNumber,
  parseNumber,
  normalizeNumberString
} from "@/lib/utils/validateInput";

function TempCorrection() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const { tempObj, handleChange, setTempUnits, result, resultBrix } =
    useTempCorrection();

  const measuredBrixDisplay = normalizeNumberString(
    toBrix(parseNumber(tempObj.measured)),
    2,
    currentLocale
  );

  const correctedSgDisplay = normalizeNumberString(
    result,
    3,
    currentLocale,
    true
  );
  const correctedBrixDisplay = normalizeNumberString(
    resultBrix,
    2,
    currentLocale
  );

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-3xl mx-auto">
      {/* Heading */}
      <h1 className="sm:text-3xl text-xl text-center text-foreground">
        {t("tempCorrectionHeading")}
      </h1>

      {/* Inputs */}
      <div className="flex flex-col gap-6">
        {/* Measured SG + Brix display */}
        <div className="space-y-2">
          <label htmlFor="measured" className="text-sm font-medium">
            {t("measuredSG")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="measured"
              inputMode="decimal"
              value={tempObj.measured}
              onFocus={(e) => e.target.select()}
              onChange={handleChange}
              className="h-full text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              {measuredBrixDisplay} {t("Brix")}
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* Current temperature + units select */}
        <div className="space-y-2">
          <label htmlFor="curTemp" className="text-sm font-medium">
            {t("curTemp")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="curTemp"
              inputMode="decimal"
              value={tempObj.curTemp}
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
                name="deg"
                value={tempObj.tempUnits}
                onValueChange={setTempUnits}
              >
                <SelectTrigger className="p-2 border-none mr-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="F">{t("FAR")}</SelectItem>
                  <SelectItem value="C">{t("CEL")}</SelectItem>
                </SelectContent>
              </Select>
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* Calibration temperature */}
        <div className="space-y-2">
          <label htmlFor="calTemp" className="text-sm font-medium">
            {t("calTemp")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="calTemp"
              inputMode="decimal"
              value={tempObj.calTemp}
              onFocus={(e) => e.target.select()}
              onChange={handleChange}
              className="h-full text-lg"
            />

            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              {tempObj.tempUnits === "F" ? t("FAR") : t("CEL")}
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>

      {/* Corrected SG + Brix display */}
      <div className="mt-4 w-full max-w-3xl mx-auto flex flex-col gap-3">
        <div className="flex items-center w-full p-2">
          {/* Left: corrected SG */}
          <div className="flex-1 flex justify-end">
            <div className="text-center mr-3">
              <p className="sm:text-2xl text-lg font-semibold tracking-tight">
                {correctedSgDisplay}
              </p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("SG")}
              </p>
            </div>
          </div>

          <Separator orientation="vertical" className="h-8" />

          {/* Right: corrected Brix */}
          <div className="flex-1 flex justify-start">
            <div className="text-center ml-3">
              <p className="sm:text-2xl text-lg font-semibold tracking-tight">
                {correctedBrixDisplay}
              </p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("Brix")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TempCorrection;

const useTempCorrection = () => {
  const [tempObj, setTempObj] = useState({
    measured: "1.1",
    tempUnits: "F",
    curTemp: "90",
    calTemp: "68"
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isValidNumber(e.target.value)) return;

    setTempObj((prev) => ({
      ...prev,
      [e.target.id]: e.target.value
    }));
  };

  const result =
    tempObj.tempUnits === "F"
      ? temperatureCorrection(
          parseNumber(tempObj.measured),
          parseNumber(tempObj.curTemp),
          parseNumber(tempObj.calTemp)
        )
      : temperatureCorrection(
          parseNumber(tempObj.measured),
          toFahrenheit(parseNumber(tempObj.curTemp)),
          toFahrenheit(parseNumber(tempObj.calTemp))
        );

  const resultBrix = toBrix(result);

  const setTempUnits = (str: string) => {
    setTempObj((prev) => ({ ...prev, tempUnits: str }));
  };

  return { tempObj, handleChange, result, resultBrix, setTempUnits };
};
