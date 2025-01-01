"use client";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import useAbv from "@/hooks/useAbv";
import AbvLine from "@/components/extraCalcs/AbvLine";
import { toBrix } from "@/lib/utils/unitConverter";

export default function AbvCalculator() {
  const { t } = useTranslation();

  const [inputValues, setInputValues] = useState([1.105, 1]);
  const [OG, FG] = inputValues;
  const abv = useAbv(OG, FG);
  const inputArr = [t("OG"), t("FG")];

  return (
    <div className="flex flex-col gap-6 sm:gap-8 h-full w-full">
      {/* Header */}
      <h1 className="sm:text-3xl text-xl text-center">{t("abvHeading")}</h1>

      {/* Inputs */}
      <div className="flex flex-col gap-6">
        {inputArr.map((label, index) => {
          const brix = toBrix(inputValues[index]);
          return (
            <span
              key={index}
              className="flex sm:grid sm:grid-cols-6 flex-col gap-2 sm:items-center justify-center"
            >
              <label htmlFor={label}>{t(`${label.toLowerCase()}Label`)}</label>
              <Input
                type="number"
                id={label}
                step="0.001"
                value={inputValues[index]}
                onChange={(e) => {
                  setInputValues(
                    inputValues.map((value, i) =>
                      index === i ? Number(e.target.value) : value
                    )
                  );
                }}
                onFocus={(e) => e.target.select()}
                className="sm:col-span-4"
              />
              <p className="self-end sm:self-auto">
                {Math.round(brix * 100) / 100} {t("BRIX")}
              </p>
            </span>
          );
        })}
      </div>

      {/* ABV Display */}
      <div className="grid items-center justify-center mt-auto">
        <AbvLine {...abv} textSize="sm:text-2xl text-lg" />
      </div>
    </div>
  );
}
