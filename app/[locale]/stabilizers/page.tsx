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
import Tooltip from "@/components/Tooltips";

import useStabilizers from "@/hooks/useStabilizers";
import {
  isValidNumber,
  normalizeNumberString
} from "@/lib/utils/validateInput";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import InputWithUnits from "@/components/nutrientCalc/InputWithUnits";

function Stabilizers() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const {
    setVolume,
    volume,
    volumeUnits,
    setVolumeUnits,
    sorbate,
    sulfite,
    campden,
    phReading,
    setPhReading,
    abv,
    setAbv,
    takingReading,
    setTakingReading,
    stabilizerType,
    setStabilizerType
  } = useStabilizers();

  // Displays
  const sorbateDisplay = normalizeNumberString(sorbate, 3, currentLocale);
  const sulfiteDisplay = normalizeNumberString(sulfite, 3, currentLocale);
  const campdenDisplay = normalizeNumberString(
    Math.round(campden * 10) / 10,
    1,
    currentLocale
  );

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-3xl mx-auto">
      {/* Heading */}
      <h1 className="sm:text-3xl text-xl text-center text-foreground">
        {t("calculators.extraCalcs.stabilizers")}
      </h1>

      {/* Inputs */}
      <div className="flex flex-col gap-6">
        {/* Batch size + units */}
        <div className="space-y-2">
          <label htmlFor="volume" className="text-sm font-medium">
            {t("batchSize")}
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              id="volume"
              inputMode="decimal"
              type="text"
              onFocus={(e) => e.target.select()}
              value={volume.toString()}
              onChange={(e) => {
                if (!isValidNumber(e.target.value)) return;
                const num = Number(e.target.value || "0");
                setVolume(num);
              }}
              className="h-full text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              <Separator orientation="vertical" className="h-12" />
              <Select
                value={volumeUnits}
                onValueChange={(val) => setVolumeUnits(val as "gal" | "lit")}
              >
                <SelectTrigger className="p-2 border-none mr-2 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gal">{t("GAL")}</SelectItem>
                  <SelectItem value="lit">{t("LIT")}</SelectItem>
                </SelectContent>
              </Select>
            </InputGroupAddon>
          </InputGroup>
        </div>

        {/* ABV */}
        <div className="space-y-2">
          <label htmlFor="abv" className="text-sm font-medium">
            {t("ABV")}
          </label>

          <InputWithUnits
            value={abv}
            handleChange={(e) => {
              if (!isValidNumber(e.target.value)) return;
              const num = Number(e.target.value || "0");
              setAbv(num);
            }}
            text="%"
          />
        </div>

        {/* pH + "taking reading" toggle */}
        <div className="space-y-2">
          <div className="flex items-center  gap-4">
            <label htmlFor="phReading" className="text-sm font-medium">
              {t("pH")}
            </label>

            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <Select
                value={takingReading ? "yes" : "no"}
                onValueChange={(val) => setTakingReading(val === "yes")}
              >
                <SelectTrigger className="h-8 w-[88px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <InputWithUnits
            value={phReading}
            handleChange={(e) => {
              if (!isValidNumber(e.target.value)) return;
              const num = Number(e.target.value || "0");
              setPhReading(num);
            }}
            text="pH"
            disabled={!takingReading}
          />
        </div>
      </div>

      {/* Results */}
      <div className="mt-2 w-full flex flex-col gap-6">
        {/* Sorbate line */}
        <div className="flex justify-center">
          <div className="text-center">
            <p className="sm:text-2xl text-lg font-semibold tracking-tight">
              {sorbateDisplay}
              <span className="ml-1">g</span>
            </p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("kSorb")}
            </p>
          </div>
        </div>

        {/* --- NEW: AND label between sorbate and sulfite --- */}
        <p className="text-xs uppercase tracking-wide text-muted-foreground text-center">
          {t("AND")}
        </p>

        {/* Sulfite section – styled like the Sulfite calculator */}
        <div className="w-full max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center w-full p-2 gap-2 sm:gap-6">
            {/* Left: grams of stabilizer */}
            <div className="flex-1 flex justify-center sm:justify-end">
              <div className="text-center sm:mr-3">
                <p className="sm:text-2xl text-lg font-semibold tracking-tight">
                  {sulfiteDisplay} g
                </p>

                <div className="mt-1 flex items-center justify-center gap-2 text-xs sm:text-sm">
                  <Select
                    value={stabilizerType}
                    onValueChange={setStabilizerType}
                  >
                    <SelectTrigger>
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

            {/* Center "or" */}
            <p className="text-xs uppercase tracking-wide text-muted-foreground text-center">
              {t("accountPage.or")}
            </p>

            {/* Right: campden tablets */}
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
    </div>
  );
}

export default Stabilizers;
