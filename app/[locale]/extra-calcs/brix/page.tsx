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
import useBrix from "@/hooks/useBrix";
import {
  isValidNumber,
  normalizeNumberString,
  parseNumber
} from "@/lib/utils/validateInput";
import { useTranslation } from "react-i18next";

export default function Brix() {
  const { t, i18n } = useTranslation();
  const currentLocale = i18n.resolvedLanguage;

  const { gravity, sg, brix, units, setGravity, setUnits } = useBrix();

  const sgNumeric = parseNumber(sg);
  const brixNumeric = parseNumber(brix);

  const showingBrix = units === "SG";
  const displayValue = showingBrix ? brixNumeric : sgNumeric;
  const displayDigits = showingBrix ? 2 : 3;
  const displayUnit = showingBrix ? t("BRIX") : t("SG");

  return (
    <div className="flex flex-col gap-8 h-full w-full max-w-2xl mx-auto">
      <h1 className="sm:text-3xl text-xl text-center">{t("brixHeading")}</h1>

      {/* Input + units */}
      <div className="space-y-2">
        <label htmlFor="gravity" className="text-sm font-medium">
          {t("gravityLabel")}
        </label>

        <InputGroup className="h-12">
          <InputGroupInput
            id="gravity"
            inputMode="decimal"
            value={gravity}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              if (!isValidNumber(e.target.value)) return;
              setGravity(e.target.value);
            }}
            className="h-full text-lg"
          />

          <InputGroupAddon
            align="inline-end"
            className="px-1 text-xs sm:text-sm whitespace-nowrap"
          >
            <Select value={units} onValueChange={setUnits}>
              <SelectTrigger className="p-2 border-none mr-2">
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

      {/* Result display – matches ABV line vibes */}
      <div className="mt-auto flex justify-center">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-3xl font-semibold tracking-tight">
              {normalizeNumberString(
                displayValue,
                displayDigits,
                currentLocale,
                displayDigits === 3
              )}
            </p>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {displayUnit}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
