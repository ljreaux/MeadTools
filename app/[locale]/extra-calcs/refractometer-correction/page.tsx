"use client";

import AbvLine from "@/components/extraCalcs/AbvLine";
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
import useAbv from "@/hooks/useAbv";
import useRefrac from "@/hooks/useRefrac";
import { cn } from "@/lib/utils";
import { normalizeNumberString } from "@/lib/utils/validateInput";
import { useTranslation } from "react-i18next";
import TooltipHelper from "@/components/Tooltips";

function RefractometerCorrection() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const {
    correctionFactorProps,
    ogProps,
    ogUnitProps,
    fgProps,
    fgUnitProps,
    correctedFg,
    correctedBrix
  } = useRefrac();

  const abv = useAbv(ogProps.value, correctedFg.toString());
  const warn = correctionFactorProps.value !== "1";
  const fgInvalid = fgUnitProps.value === "SG";

  const correctedFgDisplay = normalizeNumberString(
    correctedFg,
    3,
    currentLocale,
    true
  );
  const correctedBrixDisplay = normalizeNumberString(
    correctedBrix,
    2,
    currentLocale
  );

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-3xl mx-auto">
      {/* Heading */}
      <h1 className="sm:text-3xl text-xl text-center text-foreground">
        {t("refractometerHeading")}
      </h1>

      {/* Correction factor */}
      <div className="relative space-y-2">
        {/* label + mobile tooltip row */}
        <div className="flex items-center gap-1 pb-0.5">
          <label htmlFor="cf" className="text-sm font-medium">
            {t("correctionFactor")}
          </label>

          <div
            className={cn(
              "block md:hidden",
              !warn && "invisible pointer-events-none"
            )}
          >
            <TooltipHelper
              body={t("tiptext.refractometerWarning")}
              link="https://www.brewersfriend.com/how-to-determine-your-refractometers-wort-correction-factor/"
              variant="warning"
            />
          </div>
        </div>

        <InputGroup className="h-12">
          <InputGroupInput
            inputMode="decimal"
            id="cf"
            name="cf"
            {...correctionFactorProps}
            onFocus={(e) => e.target.select()}
            className="h-full text-lg"
            data-warning={warn ? "true" : undefined}
          />
        </InputGroup>

        {/* Desktop-only inline warning text, absolutely positioned like before */}
        <span
          className={cn(
            "absolute top-full left-0 mt-1 text-xs text-warning hidden sm:inline",
            !warn && "invisible"
          )}
        >
          {t("tiptext.refractometerWarning")}{" "}
          <a
            href="https://www.brewersfriend.com/how-to-determine-your-refractometers-wort-correction-factor/"
            className="underline"
            target="_blank"
          >
            here.
          </a>
        </span>
      </div>

      {/* OG input + units */}
      <div className="space-y-2">
        <label htmlFor="og" className="text-sm font-medium">
          {t("ogLabel")}
        </label>

        <InputGroup className="h-12">
          <InputGroupInput
            id="og"
            name="og"
            inputMode="decimal"
            {...ogProps}
            onFocus={(e) => e.target.select()}
            className="h-full text-lg"
          />
          <InputGroupAddon
            align="inline-end"
            className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
          >
            <Separator orientation="vertical" className="h-12" />
            <Select {...ogUnitProps} name="ogUnits">
              <SelectTrigger className="p-2 border-none mr-2 w-16">
                <SelectValue placeholder={t("SG")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SG">{t("SG")}</SelectItem>
                <SelectItem value="Brix">{t("BRIX")}</SelectItem>
              </SelectContent>
            </Select>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* FG input + units */}
      <div className="space-y-2 relative">
        {/* label + mobile tooltip row */}
        <div className="flex items-center gap-1 pb-0.5">
          <label htmlFor="fg" className="text-sm font-medium">
            <span className="flex items-center gap-2">{t("fgInBrix")}</span>
          </label>

          <div
            className={cn(
              "block md:hidden", // only show on mobile
              !fgInvalid && "invisible pointer-events-none"
            )}
          >
            <span className="sm:hidden">
              <TooltipHelper body={t("fgWarning")} variant="destructive" />
            </span>
          </div>
        </div>

        <InputGroup className="h-12">
          <InputGroupInput
            id="fg"
            name="fgInBrix"
            inputMode="decimal"
            {...fgProps}
            onFocus={(e) => e.target.select()}
            className="h-full text-lg"
            aria-invalid={fgInvalid}
          />
          <InputGroupAddon
            align="inline-end"
            className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
          >
            <Separator orientation="vertical" className="h-12" />
            <Select {...fgUnitProps} name="fgUnits">
              <SelectTrigger className="p-2 border-none mr-2 w-16">
                <SelectValue placeholder={t("BRIX")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SG">{t("SG")}</SelectItem>
                <SelectItem value="Brix">{t("BRIX")}</SelectItem>
              </SelectContent>
            </Select>
          </InputGroupAddon>
        </InputGroup>

        {/* Desktop-only inline error text, absolutely positioned */}
        <p
          className={cn(
            "absolute top-full left-0 mt-1 text-xs text-destructive hidden sm:block",
            !fgInvalid && "invisible"
          )}
        >
          {t("fgWarning")}
        </p>
      </div>

      {/* Corrected values display */}
      <div className="mt-4 w-full max-w-3xl mx-auto flex flex-col gap-3">
        <h2 className="sm:text-2xl text-xl font-semibold text-center">
          {t("correctedValues")}
        </h2>

        <div className="flex items-center w-full p-2">
          {/* Left: corrected FG */}
          <div className="flex-1 flex justify-end">
            <div className="text-center mr-3">
              <p className="sm:text-2xl text-lg font-semibold tracking-tight">
                {correctedFgDisplay}
              </p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("FG")}
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
                {t("BRIX")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ABV / DU line */}
      <div className="mt-auto flex justify-center">
        <AbvLine {...abv} textSize="sm:text-2xl text-lg" />
      </div>
    </div>
  );
}

export default RefractometerCorrection;
