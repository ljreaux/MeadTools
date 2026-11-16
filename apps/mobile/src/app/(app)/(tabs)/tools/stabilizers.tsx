import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  DEFAULT_STABILIZER_PH,
  SORBATE_MAX_ABV,
  stabilizerAdditions,
  type MetabisulfiteType,
  type StabilizerVolumeUnit
} from "@meadtools/core/extra-calculators";

import {
  CalculatorField,
  CalculatorNote,
  CalculatorScreen,
  CalculatorSwitch,
  DecimalInput,
  ResultCard
} from "@/components/calculator-ui";
import { MetabisulfiteField, StabilizerVolumeField } from "@/components/stabilizer-fields";
import { calculatorInputText, formatCalculatorResult, readCalculatorNumbers } from "@/tools/calculator-input";

export default function StabilizersScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [volume, setVolume] = useState(() => calculatorInputText(locale, 1));
  const [unit, setUnit] = useState<StabilizerVolumeUnit>("gal");
  const [abv, setAbv] = useState(() => calculatorInputText(locale, 12));
  const [takingReading, setTakingReading] = useState(false);
  const [ph, setPh] = useState(() => calculatorInputText(locale, DEFAULT_STABILIZER_PH));
  const [type, setType] = useState<MetabisulfiteType>("kMeta");

  const values = readCalculatorNumbers([volume, abv, takingReading ? ph : "0"] as const);
  const result = values
    ? stabilizerAdditions({
        volume: values[0],
        unit,
        abv: values[1],
        ph: takingReading ? values[2] : null,
        type
      })
    : null;
  const sorbateOutOfRange = values !== null && values[1] > SORBATE_MAX_ABV;
  const grams = (value: number) => `${formatCalculatorResult(locale, value, 3)} ${t("units.g")}`;

  return (
    <CalculatorScreen>
      <ResultCard
        note={sorbateOutOfRange ? t("mobileTools.sorbate.highAbv", { abv: SORBATE_MAX_ABV }) : null}
        values={[
          {
            label: t("mobileTools.result.sorbate"),
            value: result && !sorbateOutOfRange ? grams(result.sorbateGrams) : null
          }
        ]}
      />
      <ResultCard
        note={t("mobileTools.result.sulfiteEither")}
        title={result ? t("mobileTools.result.sulfiteTarget", { ppm: result.sulfitePpm }) : undefined}
        values={[
          { label: t(type), value: result ? grams(result.sulfiteGrams) : null },
          {
            label: t("mobileTools.result.campden"),
            value: result ? formatCalculatorResult(locale, Math.round(result.campdenTablets * 10) / 10, 1) : null
          }
        ]}
      />
      <StabilizerVolumeField onUnitChange={setUnit} onVolumeChange={setVolume} unit={unit} volume={volume} />
      <CalculatorField label={`${t("ABV")} (%)`}>
        <DecimalInput label={t("ABV")} onChangeText={setAbv} value={abv} />
      </CalculatorField>
      <CalculatorSwitch
        label={t("mobileTools.inputs.takingPhReading")}
        onValueChange={(next) => {
          if (!next) setPh(calculatorInputText(locale, DEFAULT_STABILIZER_PH));
          setTakingReading(next);
        }}
        value={takingReading}
      />
      {takingReading ? (
        <CalculatorField label={t("mobileTools.inputs.ph")}>
          <DecimalInput label={t("mobileTools.inputs.ph")} onChangeText={setPh} value={ph} />
        </CalculatorField>
      ) : (
        <CalculatorNote>
          {t("mobileTools.stabilizers.defaultPh", { ph: formatCalculatorResult(locale, DEFAULT_STABILIZER_PH, 1) })}
        </CalculatorNote>
      )}
      <MetabisulfiteField onChange={setType} value={type} />
    </CalculatorScreen>
  );
}
