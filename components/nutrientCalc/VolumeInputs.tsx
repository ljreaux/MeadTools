"use client";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
import { calcSb, toBrix } from "@/lib/utils/unitConverter";
import { useTranslation } from "react-i18next";
import Tooltip from "../Tooltips";
import { NutrientType } from "@/types/nutrientTypes";
import { parseNumber, normalizeNumberString } from "@/lib/utils/validateInput";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from "../ui/input-group";
import { Separator } from "../ui/separator";

function VolumeInputs({
  useNutrients,
  disabled
}: {
  useNutrients: () => NutrientType;
  disabled?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;
  const { inputs } = useNutrients();

  // SG → Brix & Sugar Break
  const sgNumeric = parseNumber(inputs.sg.value);
  const safeSg = isNaN(sgNumeric) ? 1 : sgNumeric;

  const brix = toBrix(safeSg);
  const brixString = normalizeNumberString(brix, 2, currentLocale);

  const sugarBreakValue = calcSb(sgNumeric);
  const sugarBreak = `${t("nuteResults.sb")}: ${sugarBreakValue.toLocaleString(
    currentLocale,
    { minimumFractionDigits: 3, maximumFractionDigits: 3 }
  )}`;

  return (
    <div className="joyride-nutrientInputs flex flex-col gap-4">
      <h3 className="text-base font-semibold">{t("batchDetails")}</h3>
      {/* Volume */}
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="nuteVol">
          {t("nuteVolume")}
        </label>

        <InputGroup className="h-12">
          <InputGroupInput
            id="nuteVol"
            {...inputs.volume}
            disabled={disabled}
            inputMode="decimal"
            onFocus={(e) => e.target.select()}
            className="h-full text-lg relative"
          />

          <InputGroupAddon
            align="inline-end"
            className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
          >
            <Separator orientation="vertical" className="h-12" />
            <Select
              value={inputs.volumeUnits.value}
              onValueChange={inputs.volumeUnits.onChange}
              disabled={disabled}
            >
              <SelectTrigger className="p-2 border-none mr-2">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="gal">Gallons</SelectItem>
                <SelectItem value="liter">Liters</SelectItem>
              </SelectContent>
            </Select>
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* SG + Offset on one line (stack on small) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* SG column */}
        <div className="col-span-1 grid gap-1 relative">
          <label className="text-sm font-medium">
            <span className="flex items-center sm:gap-1">
              {t("nuteSgLabel")} <Tooltip body={t("tipText.nutrientSg")} />
            </span>
          </label>

          <InputGroup className="h-12">
            <InputGroupInput
              {...inputs.sg}
              disabled={disabled}
              inputMode="decimal"
              onFocus={(e) => e.target.select()}
              className="h-full text-lg relative"
            />

            <InputGroupAddon
              align="inline-end"
              className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
            >
              {brixString} {t("BRIX")}
            </InputGroupAddon>
          </InputGroup>

          {/* Sugar break directly under SG input, tight */}
          <span className="text-[0.7rem] text-muted-foreground absolute top-full left-0 mt-0.5">
            {sugarBreak}
          </span>
        </div>

        {/* Offset column */}
        <div className="joyride-offset col-span-1 grid gap-1">
          <label className="text-sm font-medium flex items-center sm:gap-1">
            {t("offset")}
            <Tooltip body={t("tipText.offsetPpm")} />
          </label>

          <Input
            className="h-12 text-lg"
            {...inputs.offset}
            inputMode="decimal"
            onFocus={(e) => e.target.select()}
          />
        </div>
      </div>

      <Separator className="my-4" />
    </div>
  );
}

export default VolumeInputs;
