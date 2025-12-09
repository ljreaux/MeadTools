"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";

import AbvLine from "@/components/extraCalcs/AbvLine";
import Tooltip from "@/components/Tooltips";

import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";

import { toBrix } from "@/lib/utils/unitConverter";
import {
  isValidNumber,
  normalizeNumberString,
  parseNumber
} from "@/lib/utils/validateInput";
import useAbv from "@/hooks/useAbv";

function EstimatedOG() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const [gravity, setGravity] = useState({
    fgh: "1.0", // hydrometer FG (SG)
    fgr: "5" // refractometer FG (Brix)
  });

  const estOG =
    Math.round(
      (-1.728 * parseNumber(gravity.fgh) +
        0.01085 * parseNumber(gravity.fgr) +
        2.728) *
        1000
    ) / 1000;

  const abv = useAbv(estOG.toString(), gravity.fgh.toString());

  const estOgDisplay = normalizeNumberString(estOG, 3, currentLocale, true);
  const estBrixDisplay = normalizeNumberString(toBrix(estOG), 2, currentLocale);

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-3xl mx-auto">
      {/* Heading with Tooltip */}
      <h1 className="sm:text-3xl text-xl text-center flex items-center justify-center gap-2">
        {t("ogHeading")}{" "}
        <Tooltip
          body={t("tipText.estOG")}
          link="/woodlandbrew-abv-without-og"
        />
      </h1>

      {/* Inputs */}
      <div className="flex flex-col gap-6">
        {/* Hydrometer FG (SG) */}
        <div className="space-y-2">
          <label htmlFor="hydrometerFG" className="text-sm font-medium">
            {t("hydrometerFG")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="hydrometerFG"
              inputMode="decimal"
              value={gravity.fgh}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                if (!isValidNumber(e.target.value)) return;
                setGravity((prev) => ({ ...prev, fgh: e.target.value }));
              }}
              className="h-full text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              {t("SG")}
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* Refractometer FG (Brix) */}
        <div className="space-y-2">
          <label htmlFor="refractometerFG" className="text-sm font-medium">
            {t("refractometerFG")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="refractometerFG"
              inputMode="decimal"
              value={gravity.fgr}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                if (!isValidNumber(e.target.value)) return;
                setGravity((prev) => ({ ...prev, fgr: e.target.value }));
              }}
              className="h-full text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              {t("BRIX")}
            </InputGroupAddon>
          </InputGroup>
        </div>
      </div>

      {/* Result display (SG + Brix) */}
      <div className="mt-4 w-full max-w-3xl mx-auto flex flex-col gap-3">
        <h2 className="sm:text-2xl text-xl font-semibold text-center">
          {t("estimatedOG")}
        </h2>

        <div className="flex items-center w-full p-2">
          {/* Left (SG) */}
          <div className="flex-1 flex justify-end">
            <div className="text-center mr-3">
              <p className="sm:text-2xl text-lg font-semibold tracking-tight">
                {estOgDisplay}
              </p>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {t("SG")}
              </p>
            </div>
          </div>

          {/* Center separator */}
          <Separator orientation="vertical" className="h-8" />

          {/* Right (Brix) */}
          <div className="flex-1 flex justify-start">
            <div className="text-center ml-3">
              <p className="sm:text-2xl text-lg font-medium tracking-tight">
                {estBrixDisplay}
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

export default EstimatedOG;
