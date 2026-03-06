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
import { ChangeEvent, useEffect, useState } from "react";
import Trials from "@/components/extraCalcs/Trials";
import { isValidNumber } from "@/lib/utils/validateInput";
import InputWithUnits from "@/components/nutrientCalc/InputWithUnits";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";

const BENCH_TRIALS_HOWTO_SEEN_KEY = "meadtools:benchTrialsHowToSeen";

function BenchTrials() {
  const { t } = useTranslation();
  const { batchDetails, changeUnits, setInput } = useBenchTrials();

  // Closed by default to avoid flicker
  const [howToValue, setHowToValue] = useState<string>("");

  useEffect(() => {
    try {
      const seen = localStorage.getItem(BENCH_TRIALS_HOWTO_SEEN_KEY);

      if (seen === "true") {
        setHowToValue("");
        return;
      }

      // First visit → open accordion
      setHowToValue("howto");
      localStorage.setItem(BENCH_TRIALS_HOWTO_SEEN_KEY, "true");
    } catch {
      // If localStorage fails, default to open
      setHowToValue("howto");
    }
  }, []);

  const benchTrialLinks = [
    [
      "https://youtu.be/T-xGG3AKaiM?si=TPB_-DtgE0a5Esti",
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

      {/* How to use */}
      <Accordion
        type="single"
        collapsible
        className="w-full"
        value={howToValue}
        onValueChange={setHowToValue}
      >
        <AccordionItem value="howto">
          <AccordionTrigger>{t("benchTrials.howToUseTitle")}</AccordionTrigger>

          <AccordionContent>
            <div className="space-y-4">
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>
                  {t("benchTrials.howToUse.steps.0", {
                    sampleSize: batchDetails.sampleSize
                  })}
                </li>

                <li>
                  {t("benchTrials.howToUse.steps.1", {
                    solutionVolumeLabel: t("solutionVolume")
                  })}
                </li>

                <li>{t("benchTrials.howToUse.steps.2")}</li>

                <li>
                  {t("benchTrials.howToUse.steps.3", {
                    scaledAdjunctLabel: t(`${batchDetails.units}ScaledAdjunct`)
                  })}
                </li>
              </ol>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                <p className="text-sm font-semibold">
                  {t("benchTrials.howToUse.exampleTitle")}
                </p>

                <p className="text-sm text-muted-foreground">
                  {t("benchTrials.howToUse.exampleBody")}
                </p>

                <div className="pt-3 border-t border-border">
                  <p className="text-sm text-muted-foreground/90">
                    {t("benchTrials.howToUse.addendum")}
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold">
                  {t("benchTrials.howToUse.videoTitle")}
                </h3>

                <p className="text-sm text-muted-foreground">
                  {t("benchTrials.howToUse.videoDescription")}
                </p>

                <div className="relative w-full aspect-video rounded-md overflow-hidden border border-border">
                  {howToValue === "howto" && (
                    <iframe
                      src="https://www.youtube.com/embed/T-xGG3AKaiM?si=ce93XwDUwvDHCZA3"
                      title="Bench Trials Walkthrough"
                      className="absolute inset-0 w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )}
                </div>

                <a
                  href="https://youtu.be/T-xGG3AKaiM?si=TPB_-DtgE0a5Esti"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline text-primary"
                >
                  {t("benchTrials.howToUse.videoLinkText")}
                </a>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Inputs */}
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
            id="sampleSize"
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
            id="stockSolutionConcentration"
            value={batchDetails.stockSolutionConcentration}
            handleChange={setInput}
            text={t("%")}
          />
        </div>
      </div>

      <Separator className="my-2" />

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
