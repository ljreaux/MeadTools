"use client";

import InputWithUnits from "@/components/nutrientCalc/InputWithUnits";
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
  normalizeNumberString
} from "@/lib/utils/validateInput";
import { useTranslation } from "react-i18next";
import useStabilizers from "@/hooks/useStabilizers";

function Sorbate() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const {
    // inputs (strings)
    volume,
    setVolume,
    volumeUnits,
    setVolumeUnits,
    abv,
    setAbv,

    // derived result (number)
    sorbate
  } = useStabilizers();

  const sorbateAmountDisplay = normalizeNumberString(sorbate, 3, currentLocale);

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-3xl mx-auto">
      {/* Heading */}
      <h1 className="sm:text-3xl text-xl text-center text-foreground">
        {t("sorbateHeading")}
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
              value={volume}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                if (!isValidNumber(e.target.value)) return;
                setVolume(e.target.value);
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
                  <SelectValue placeholder={t("GAL")} />
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
              setAbv(e.target.value);
            }}
            text="%"
          />
        </div>
      </div>

      {/* Result */}
      <div className="mt-auto flex justify-center">
        <div className="text-center">
          <p className="sm:text-2xl text-lg font-semibold tracking-tight">
            {sorbateAmountDisplay} g
          </p>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("kSorb")}
          </p>
        </div>
      </div>
    </div>
  );
}

export default Sorbate;
