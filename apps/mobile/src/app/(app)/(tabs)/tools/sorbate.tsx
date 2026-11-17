import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  SORBATE_MAX_ABV,
  sorbateAddition,
  type StabilizerVolumeUnit
} from "@meadtools/core/extra-calculators";

import { CalculatorField, CalculatorScreen, DecimalInput, ResultCard } from "@/components/calculator-ui";
import { StabilizerVolumeField } from "@/components/stabilizer-fields";
import { calculatorInputText, formatCalculatorResult, readCalculatorNumbers } from "@/tools/calculator-input";

export default function SorbateScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [volume, setVolume] = useState(() => calculatorInputText(locale, 1));
  const [unit, setUnit] = useState<StabilizerVolumeUnit>("gal");
  const [abv, setAbv] = useState(() => calculatorInputText(locale, 12));

  const values = readCalculatorNumbers([volume, abv] as const);
  // At 16% ABV and above the dose is zero: no sorbate is needed (as on the web).
  const noSorbate = values !== null && values[1] >= SORBATE_MAX_ABV;
  const grams = values ? (noSorbate ? 0 : sorbateAddition(values[0], unit, values[1])) : null;

  return (
    <CalculatorScreen>
      <ResultCard
        note={noSorbate ? t("noSorb") : null}
        values={[
          {
            label: t("mobileTools.result.sorbate"),
            value: grams === null ? null : `${formatCalculatorResult(locale, grams, 3)} ${t("units.g")}`
          }
        ]}
      />
      <StabilizerVolumeField onUnitChange={setUnit} onVolumeChange={setVolume} unit={unit} volume={volume} />
      {/* "ABV" is "% vol." in German, so the field uses the word form ("Alkoholgehalt"). */}
      <CalculatorField label={`${t("brews.complete.abv")} (%)`}>
        <DecimalInput label={t("brews.complete.abv")} onChangeText={setAbv} value={abv} />
      </CalculatorField>
    </CalculatorScreen>
  );
}
