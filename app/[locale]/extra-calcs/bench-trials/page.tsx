"use client";

import Tooltip from "@/components/Tooltips";
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
import { ChangeEvent, useState } from "react";
import Trials from "@/components/extraCalcs/Trials";
import { isValidNumber } from "@/lib/utils/validateInput";
import InputWithUnits from "@/components/nutrientCalc/InputWithUnits";

function BenchTrials() {
  const { t } = useTranslation();
  const { batchDetails, changeUnits, setInput } = useBenchTrials();

  const benchTrialLinks = [
    [
      "https://www.youtube.com/watch?v=AaibXsslBlE&ab_channel=Doin%27theMostBrewing",
      t("tipText.benchTrials.linkTexts.0")
    ],
    [
      "https://scottlab.com/bench-trial-protocol",
      t("tipText.benchTrials.linkTexts.1")
    ],
    [
      "https://wiki.meadtools.com/en/process/bench_trials",
      t("tipText.benchTrials.linkTexts.2")
    ]
  ];

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-3xl mx-auto">
      {/* Heading */}
      <div className="flex items-center justify-center gap-2">
        <h1 className="sm:text-3xl text-xl text-center text-foreground">
          {t("benchTrialsHeading")}
        </h1>
        <Tooltip body={t("tipText.benchTrials.body")} links={benchTrialLinks} />
      </div>

      {/* Inputs (mirrors Priming Sugar layout) */}
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
              value={batchDetails.batchSize}
              onFocus={(e) => e.target.select()}
              onChange={setInput}
              className="h-full text-lg"
            />

            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              <Separator orientation="vertical" className="h-12" />
              <Select
                name="trialBatchUnits"
                value={batchDetails.units}
                onValueChange={changeUnits}
              >
                <SelectTrigger className="p-2 border-none mr-2 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gallon">{t("GAL")}</SelectItem>
                  <SelectItem value="liter">{t("LIT")}</SelectItem>
                </SelectContent>
              </Select>
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* Sample size */}
        <div className="space-y-2">
          <label htmlFor="sampleSize" className="text-sm font-medium">
            {t("sampleSize")}
          </label>

          <InputWithUnits
            value={batchDetails.sampleSize}
            handleChange={setInput}
            text={t("ML")}
          />
        </div>

        {/* Stock solution concentration */}
        <div className="space-y-2">
          <label
            htmlFor="stockSolutionConcentration"
            className="text-sm font-medium"
          >
            {t("stockSolutionConcentration")}
          </label>

          <InputWithUnits
            value={batchDetails.stockSolutionConcentration}
            handleChange={setInput}
            text={t("%")}
          />
        </div>
      </div>

      {/* Divider like Priming Sugar */}
      <Separator className="my-2" />

      {/* Trials table */}

      <Trials batchDetails={batchDetails} />
    </div>
  );
}

export default BenchTrials;

const useBenchTrials = () => {
  const [batchDetails, setBatchDetails] = useState({
    batchSize: "1",
    sampleSize: "50",
    stockSolutionConcentration: "10",
    units: "gallon"
  });

  const changeUnits = (unit: string) => {
    setBatchDetails((prev) => ({ ...prev, units: unit }));
  };

  const setInput = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (isValidNumber(val)) {
      const key = e.target.id;
      setBatchDetails((prev) => ({ ...prev, [key]: val }));
    }
  };

  return { batchDetails, changeUnits, setInput };
};
