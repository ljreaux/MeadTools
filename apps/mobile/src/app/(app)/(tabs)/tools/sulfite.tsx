import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  sulfiteAddition,
  type MetabisulfiteType,
  type StabilizerVolumeUnit
} from "@meadtools/core/extra-calculators";

import { CalculatorField, CalculatorScreen, DecimalInput, ResultCard } from "@/components/calculator-ui";
import { MetabisulfiteField, StabilizerVolumeField } from "@/components/stabilizer-fields";
import { calculatorInputText, formatCalculatorResult, readCalculatorNumbers } from "@/tools/calculator-input";

export default function SulfiteScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [volume, setVolume] = useState(() => calculatorInputText(locale, 1));
  const [unit, setUnit] = useState<StabilizerVolumeUnit>("gal");
  const [ppm, setPpm] = useState(() => calculatorInputText(locale, 50));
  const [type, setType] = useState<MetabisulfiteType>("kMeta");

  const values = readCalculatorNumbers([volume, ppm] as const);
  const result = values ? sulfiteAddition(values[0], unit, values[1], type) : null;

  return (
    <CalculatorScreen>
      <ResultCard
        note={t("mobileTools.result.sulfiteEither")}
        values={[
          {
            label: t(type),
            value: result ? `${formatCalculatorResult(locale, result.sulfiteGrams, 3)} ${t("units.g")}` : null
          },
          {
            label: t("mobileTools.result.campden"),
            value: result ? formatCalculatorResult(locale, result.campdenTablets, 2) : null
          }
        ]}
      />
      <StabilizerVolumeField onUnitChange={setUnit} onVolumeChange={setVolume} unit={unit} volume={volume} />
      <CalculatorField label={t("mobileTools.inputs.ppm")}>
        <DecimalInput label={t("mobileTools.inputs.ppm")} onChangeText={setPpm} value={ppm} />
      </CalculatorField>
      <MetabisulfiteField onChange={setType} value={type} />
    </CalculatorScreen>
  );
}
