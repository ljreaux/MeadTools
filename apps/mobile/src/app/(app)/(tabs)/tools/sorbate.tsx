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
  const outOfRange = values !== null && values[1] > SORBATE_MAX_ABV;
  const grams = values && !outOfRange ? sorbateAddition(values[0], unit, values[1]) : null;

  return (
    <CalculatorScreen>
      <ResultCard
        note={outOfRange ? t("mobileTools.sorbate.highAbv", { abv: SORBATE_MAX_ABV }) : null}
        values={[
          {
            label: t("mobileTools.result.sorbate"),
            value: grams === null ? null : `${formatCalculatorResult(locale, grams, 3)} ${t("units.g")}`
          }
        ]}
      />
      <StabilizerVolumeField onUnitChange={setUnit} onVolumeChange={setVolume} unit={unit} volume={volume} />
      <CalculatorField label={`${t("ABV")} (%)`}>
        <DecimalInput label={t("ABV")} onChangeText={setAbv} value={abv} />
      </CalculatorField>
    </CalculatorScreen>
  );
}
