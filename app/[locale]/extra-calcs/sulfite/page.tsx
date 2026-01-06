"use client";

import InputWithUnits from "@/components/nutrientCalc/InputWithUnits";
import Tooltip from "@/components/Tooltips";
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
import { useMemo, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";

type StabilizerType = "kMeta" | "naMeta";
type Units = "gallons" | "liter";

function Sulfite() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const [stabilizerType, setStabilizerType] = useState<StabilizerType>("kMeta");

  // keep INPUTS as strings
  const [batchSize, setBatchSize] = useState((1).toLocaleString(currentLocale));
  const [units, setUnits] = useState<Units>("gallons");
  const [ppm, setPpm] = useState((50).toLocaleString(currentLocale));

  const handleBatchSizeChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!isValidNumber(e.target.value)) return;
    setBatchSize(e.target.value);
  };

  const handlePpmChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (!isValidNumber(e.target.value)) return;
    setPpm(e.target.value);
  };

  const multiplier = stabilizerType === "kMeta" ? 570 : 674;

  // parse only for math (allows "12." to exist in state)
  const batchSizeNum = useMemo(
    () => parseNumber(batchSize || "0"),
    [batchSize]
  );
  const ppmNum = useMemo(() => parseNumber(ppm || "0"), [ppm]);

  const sulfiteAmount = useMemo(() => {
    return units === "gallons"
      ? (batchSizeNum * 3.785 * ppmNum) / multiplier
      : (batchSizeNum * ppmNum) / multiplier;
  }, [units, batchSizeNum, ppmNum, multiplier]);

  const campden = useMemo(() => {
    return units !== "gallons"
      ? (ppmNum / 75) * (batchSizeNum / 3.785)
      : (ppmNum / 75) * batchSizeNum;
  }, [units, ppmNum, batchSizeNum]);

  const sulfiteAmountDisplay = normalizeNumberString(
    sulfiteAmount,
    3,
    currentLocale
  );

  const campdenDisplay = normalizeNumberString(campden, 2, currentLocale);

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-3xl mx-auto">
      <h1 className="sm:text-3xl text-xl text-center text-foreground">
        {t("sulfiteHeading")}
      </h1>

      <div className="flex flex-col gap-6">
        {/* Batch size + units */}
        <div className="space-y-2">
          <label htmlFor="batchSize" className="text-sm font-medium">
            {t("batchSize")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="batchSize"
              inputMode="decimal"
              value={batchSize}
              onFocus={(e) => e.target.select()}
              onChange={handleBatchSizeChange}
              className="h-full text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              <Separator orientation="vertical" className="h-12" />
              <Select
                value={units}
                onValueChange={(val) => setUnits(val as Units)}
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

        {/* Desired ppm */}
        <div className="space-y-2">
          <label htmlFor="ppm" className="text-sm font-medium">
            {t("desiredPpm")}
          </label>

          <InputWithUnits
            value={ppm}
            handleChange={handlePpmChange}
            text={t("PPM")}
          />
        </div>
      </div>

      {/* Results */}
      <div className="mt-auto w-full max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row items-center w-full p-2 gap-2 sm:gap-6">
          <div className="flex-1 flex justify-center sm:justify-end">
            <div className="text-center sm:mr-3">
              <p className="sm:text-2xl text-lg font-semibold tracking-tight">
                {sulfiteAmountDisplay}
                {t("G")}
              </p>

              <div className="mt-1 flex items-center justify-center gap-2 text-xs sm:text-sm">
                <Select
                  value={stabilizerType}
                  onValueChange={(val) =>
                    setStabilizerType(val as StabilizerType)
                  }
                >
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kMeta">{t("kMeta")}</SelectItem>
                    <SelectItem value="naMeta">{t("naMeta")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <p className="text-xs uppercase tracking-wide text-muted-foreground text-center">
            {t("accountPage.or")}
          </p>

          <div className="flex-1 flex justify-center sm:justify-start">
            <div className="text-center sm:ml-3">
              <p className="sm:text-2xl text-lg font-semibold tracking-tight">
                {campdenDisplay}
              </p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center justify-center gap-1">
                {t("campden")}
                <Tooltip body={t("tipText.campden")} />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sulfite;
