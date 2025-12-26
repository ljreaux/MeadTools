"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import useAbv from "@/hooks/useAbv";
import AbvLine from "@/components/extraCalcs/AbvLine";
import { toBrix } from "@/lib/utils/unitConverter";
import {
  isValidNumber,
  normalizeNumberString,
  parseNumber
} from "@/lib/utils/validateInput";
import InputWithUnits from "@/components/nutrientCalc/InputWithUnits";

export default function AbvCalculator() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const [inputValues, setInputValues] = useState([
    (1.105).toLocaleString(currentLocale, { maximumFractionDigits: 3 }),
    (1).toLocaleString(currentLocale)
  ]);

  const [OG, FG] = inputValues;
  const abv = useAbv(OG, FG);
  const inputArr = [t("OG"), t("FG")];
  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-3xl mx-auto">
      <h1 className="sm:text-3xl text-xl text-center">{t("abvHeading")}</h1>

      {/* Inputs */}
      <div className="grid gap-4">
        {inputArr.map((label, index) => {
          const numeric = parseNumber(inputValues[index]);
          const brix = toBrix(numeric);

          return (
            <div key={index} className="space-y-2">
              <label htmlFor={label} className="text-sm font-medium">
                {t(`${label.toLowerCase()}Label`)}
              </label>

              <InputWithUnits
                value={inputValues[index]}
                handleChange={(e) => {
                  if (!isValidNumber(e.target.value)) return;

                  setInputValues((prev) =>
                    prev.map((val, i) => (i === index ? e.target.value : val))
                  );
                }}
                text={`${normalizeNumberString(brix, 2, currentLocale)} ${t("BRIX")}`}
              />
            </div>
          );
        })}
      </div>

      {/* ABV / DU display */}
      <div className="mt-auto flex justify-center">
        <AbvLine {...abv} textSize="sm:text-2xl text-lg" />
      </div>
    </div>
  );
}
