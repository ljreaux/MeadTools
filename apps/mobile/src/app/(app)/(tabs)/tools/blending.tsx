import { useState } from "react";
import { useTranslation } from "react-i18next";

import { blendValues } from "@meadtools/core/blend";

import {
  CalculatorField,
  CalculatorNote,
  CalculatorScreen,
  DecimalInput,
  Grow,
  InputRow,
  ResultCard
} from "@/components/calculator-ui";
import { calculatorInputText, formatCalculatorResult, readCalculatorNumbers } from "@/tools/calculator-input";

type Part = { value: string; volume: string };

export default function BlendingScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [parts, setParts] = useState<Part[]>(() => [
    { value: calculatorInputText(locale, 0), volume: calculatorInputText(locale, 0) },
    { value: calculatorInputText(locale, 0), volume: calculatorInputText(locale, 0) }
  ]);

  const numbers = readCalculatorNumbers(parts.flatMap((part) => [part.value, part.volume]));
  const result = numbers
    ? blendValues(parts.map((_, index) => [numbers[index * 2], numbers[index * 2 + 1]] as [number, number]))
    : null;

  const update = (index: number, patch: Partial<Part>) =>
    setParts((current) => current.map((part, i) => (i === index ? { ...part, ...patch } : part)));

  return (
    <CalculatorScreen>
      <ResultCard
        values={[
          { label: t("mobileTools.result.blendedValue"), value: result ? formatCalculatorResult(locale, result.blendedValue, 3) : null },
          { label: t("mobileTools.result.totalVolume"), value: result ? formatCalculatorResult(locale, result.totalVolume, 3) : null }
        ]}
      />
      {parts.map((part, index) => {
        const name = t("mobileTools.blending.part", { number: index + 1 });
        return (
          <CalculatorField key={index} label={name}>
            <InputRow>
              <Grow>
                <CalculatorNote>{t("mobileTools.inputs.value")}</CalculatorNote>
                <DecimalInput
                  label={`${name}, ${t("mobileTools.inputs.value")}`}
                  onChangeText={(value) => update(index, { value })}
                  value={part.value}
                />
              </Grow>
              <Grow>
                <CalculatorNote>{t("mobileTools.inputs.volume")}</CalculatorNote>
                <DecimalInput
                  label={`${name}, ${t("mobileTools.inputs.volume")}`}
                  onChangeText={(volume) => update(index, { volume })}
                  value={part.volume}
                />
              </Grow>
            </InputRow>
          </CalculatorField>
        );
      })}
      <CalculatorNote>{t("mobileTools.blending.hint")}</CalculatorNote>
    </CalculatorScreen>
  );
}
