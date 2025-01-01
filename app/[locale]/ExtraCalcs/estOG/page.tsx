"use client";
import AbvLine from "@/components/extraCalcs/AbvLine";
import Tooltip from "@/components/Tooltips";
import { Input } from "@/components/ui/input";
import useAbv from "@/hooks/useAbv";
import { toBrix } from "@/lib/utils/unitConverter";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

function EstimatedOG() {
  const { t } = useTranslation();
  const [gravity, setGravity] = useState({
    fgh: 1.0,
    fgr: 5,
  });
  const estOG =
    Math.round((-1.728 * gravity.fgh + 0.01085 * gravity.fgr + 2.728) * 1000) /
    1000;

  const abv = useAbv(estOG, gravity.fgh);

  return (
    <div className="flex flex-col gap-6 sm:gap-8 h-full w-full">
      {/* Heading with Tooltip */}
      <h1 className="sm:text-3xl text-xl text-center flex items-center justify-center gap-2">
        {t("ogHeading")}{" "}
        <Tooltip
          body={t("tipText.estOG")}
          link="http://www.woodlandbrew.com/2013/02/abv-without-og.html"
        />
      </h1>

      {/* Inputs Section */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col">
          <label htmlFor="hydrometerFG" className="mb-1">
            {t("hydrometerFG")}
          </label>
          <Input
            value={gravity.fgh}
            onChange={(e) =>
              setGravity((prev) => ({ ...prev, fgh: Number(e.target.value) }))
            }
            type="number"
            id="hydrometerFG"
            onFocus={(e) => e.target.select()}
          />
        </div>

        <div className="flex flex-col">
          <label htmlFor="refractometerFG" className="mb-1">
            {t("refractometerFG")}
          </label>
          <Input
            value={gravity.fgr}
            onChange={(e) =>
              setGravity((prev) => ({ ...prev, fgr: Number(e.target.value) }))
            }
            type="number"
            id="refractometerFG"
            onFocus={(e) => e.target.select()}
          />
        </div>
      </div>

      {/* Results Section */}
      <div className="grid grid-cols-2 sm:grid-cols-1 text-center gap-4 text-lg">
        <h2 className="sm:text-2xl text-xl">{t("estimatedOG")}</h2>
        <div className="flex gap-2 justify-center items-center">
          <p>{estOG}</p>
          <p>
            {Math.round(toBrix(estOG) * 100) / 100} {t("BRIX")}
          </p>
        </div>
      </div>

      {/* ABV Line */}
      <AbvLine {...abv} textSize="text-lg" />
    </div>
  );
}

export default EstimatedOG;
