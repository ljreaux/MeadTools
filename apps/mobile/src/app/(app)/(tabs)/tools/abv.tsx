import { useState } from "react";
import { useTranslation } from "react-i18next";

import { standaloneAlcohol } from "@meadtools/core/extra-calculators";
import { toBrix } from "@meadtools/core/gravity";

import { AbvResult, CalculatorField, CalculatorScreen, DecimalInput } from "@/components/calculator-ui";
import {
  calculatorInputText,
  formatCalculatorResult,
  readCalculatorNumber,
  readCalculatorNumbers
} from "@/tools/calculator-input";

export default function AbvCalculatorScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [og, setOg] = useState(() => calculatorInputText(locale, 1.105));
  const [fg, setFg] = useState(() => calculatorInputText(locale, 1));

  const values = readCalculatorNumbers([og, fg] as const);
  const abv = values ? standaloneAlcohol(values[0], values[1]) : null;

  const brixHint = (text: string) => {
    const value = readCalculatorNumber(text);
    return value === null ? null : `${formatCalculatorResult(locale, toBrix(value), 2)} ${t("BRIX")}`;
  };

  return (
    <CalculatorScreen>
      <AbvResult abv={abv} />
      <CalculatorField hint={brixHint(og)} label={t("mobileTools.inputs.og")}>
        <DecimalInput label={t("mobileTools.inputs.og")} onChangeText={setOg} value={og} />
      </CalculatorField>
      <CalculatorField hint={brixHint(fg)} label={t("mobileTools.inputs.fg")}>
        <DecimalInput label={t("mobileTools.inputs.fg")} onChangeText={setFg} value={fg} />
      </CalculatorField>
    </CalculatorScreen>
  );
}
