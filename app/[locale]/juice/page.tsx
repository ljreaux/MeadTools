"use client";

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
import { useTranslation } from "react-i18next";
import useJuice from "@/hooks/useJuice";
import {
  isValidNumber,
  normalizeNumberString
} from "@/lib/utils/validateInput";

function Juice() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const {
    sugar,
    setSugar,
    sugarUnits,
    setSugarUnits,
    servingSize,
    setServingSize,
    servingSizeUnits,
    setServingSizeUnits,
    servings,
    setServings,
    brix,
    sg,
    totalSugar
  } = useJuice();

  const brixDisplay = normalizeNumberString(brix, 3, currentLocale);
  const sgDisplay = normalizeNumberString(sg, 3, currentLocale, true);
  const totalSugarDisplay = normalizeNumberString(totalSugar, 3, currentLocale);

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-3xl mx-auto">
      {/* Heading */}
      <h1 className="sm:text-3xl text-xl text-center text-foreground">
        {t("juiceHeading")}
      </h1>

      {/* Inputs */}
      <div className="flex flex-col gap-6">
        {/* Sugar per serving + units */}
        <div className="space-y-2">
          <label htmlFor="sugar" className="text-sm font-medium">
            {t("sugPerServe")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="sugar"
              inputMode="decimal"
              onFocus={(e) => e.target.select()}
              value={sugar}
              onChange={(e) => {
                if (isValidNumber(e.target.value)) {
                  setSugar(e.target.value);
                }
              }}
              className="h-full text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              <Separator orientation="vertical" className="h-12" />
              <Select value={sugarUnits} onValueChange={setSugarUnits}>
                <SelectTrigger className="p-2 border-none mr-2 w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="g">{t("G")}</SelectItem>
                  <SelectItem value="mg">{t("MG")}</SelectItem>
                </SelectContent>
              </Select>
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* Serving size + units */}
        <div className="space-y-2">
          <label htmlFor="servingSize" className="text-sm font-medium">
            {t("servingSize")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="servingSize"
              inputMode="decimal"
              onFocus={(e) => e.target.select()}
              value={servingSize}
              onChange={(e) => {
                if (isValidNumber(e.target.value)) {
                  setServingSize(e.target.value);
                }
              }}
              className="h-full text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              <Separator orientation="vertical" className="h-12" />
              <Select
                value={servingSizeUnits}
                onValueChange={setServingSizeUnits}
              >
                <SelectTrigger className="p-2 border-none mr-2 w-16">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ml">{t("ML")}</SelectItem>
                  <SelectItem value="floz">{t("FLOZ")}</SelectItem>
                </SelectContent>
              </Select>
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* Servings per container */}
        <div className="space-y-2">
          <label htmlFor="servings" className="text-sm font-medium">
            {t("perContainer")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="servings"
              inputMode="decimal"
              onFocus={(e) => e.target.select()}
              value={servings}
              onChange={(e) => {
                if (isValidNumber(e.target.value)) {
                  setServings(e.target.value);
                }
              }}
              className="h-full text-lg"
            />
          </InputGroup>
        </div>
      </div>

      {/* Results */}
      <div className="mt-2 w-full flex flex-col gap-4">
        {/* Brix + SG row */}
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="sm:text-2xl text-lg font-semibold tracking-tight">
              {brixDisplay}
            </p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("BRIX")}
            </p>
          </div>

          <Separator orientation="vertical" className="h-10" />

          <div className="text-center">
            <p className="sm:text-2xl text-lg font-semibold tracking-tight">
              {sgDisplay}
            </p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("SG")}
            </p>
          </div>
        </div>

        {/* Total sugar */}
        <div className="flex justify-center">
          <div className="text-center">
            <p className="sm:text-2xl text-lg font-semibold tracking-tight">
              {totalSugarDisplay}
              {sugarUnits}
            </p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("juiceUnits")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Juice;
