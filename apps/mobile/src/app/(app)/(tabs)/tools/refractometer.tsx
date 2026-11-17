import { useState } from "react";
import { useTranslation } from "react-i18next";

import { refractometerCorrection } from "@meadtools/core/extra-calculators";

import {
  AbvResult,
  CalculatorField,
  CalculatorScreen,
  DecimalInput,
  Grow,
  InputRow,
  ResultCard,
  Segmented
} from "@/components/calculator-ui";
import { convertGravityText } from "@/outbox/gravity-entry-form";
import {
  calculatorInputText,
  formatCalculatorResult,
  readCalculatorNumber,
  readCalculatorNumbers
} from "@/tools/calculator-input";

const SCALES = ["SG", "BRIX"] as const;
type Scale = (typeof SCALES)[number];
const coreScale = (scale: Scale) => (scale === "BRIX" ? "Brix" : "SG");

export default function RefractometerCalculatorScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [factor, setFactor] = useState(() => calculatorInputText(locale, 1));
  const [og, setOg] = useState(() => calculatorInputText(locale, 1.1));
  const [ogScale, setOgScale] = useState<Scale>("SG");
  const [fg, setFg] = useState(() => calculatorInputText(locale, 8.5));
  const [fgScale, setFgScale] = useState<Scale>("BRIX");

  const values = readCalculatorNumbers([factor, og, fg] as const);
  const result =
    values && values[0] > 0
      ? refractometerCorrection({
          correctionFactor: values[0],
          originalGravity: values[1],
          originalGravityScale: coreScale(ogScale),
          finalGravity: values[2],
          finalGravityScale: coreScale(fgScale)
        })
      : null;
  const factorValue = readCalculatorNumber(factor);

  const scaleToggle = (
    value: Scale,
    setValue: (next: Scale) => void,
    setText: (update: (current: string) => string) => void
  ) => (
    <Segmented
      label={t("mobileTools.inputs.scale")}
      onChange={(next) => {
        setText((current) => convertGravityText(current, value, next));
        setValue(next);
      }}
      optionLabel={(option) => t(option)}
      options={SCALES}
      value={value}
    />
  );

  return (
    <CalculatorScreen>
      <ResultCard
        title={t("mobileTools.result.correctedFg")}
        values={[
          { label: t("SG"), value: result ? formatCalculatorResult(locale, result.correctedSg, 3, true) : null },
          { label: t("BRIX"), value: result ? formatCalculatorResult(locale, result.correctedBrix, 2) : null }
        ]}
      />
      <AbvResult abv={result} />
      <CalculatorField
        label={t("mobileTools.inputs.correctionFactor")}
        warning={factorValue !== null && factorValue <= 0 ? t("mobileTools.refractometer.factorInvalid") : null}
        hint={factorValue !== null && factorValue !== 1 ? t("mobileTools.refractometer.factorWarning") : null}
      >
        <DecimalInput
          invalid={factorValue !== null && factorValue <= 0}
          label={t("mobileTools.inputs.correctionFactor")}
          onChangeText={setFactor}
          value={factor}
        />
      </CalculatorField>
      <CalculatorField label={t("mobileTools.inputs.og")}>
        <InputRow>
          <Grow>
            <DecimalInput label={t("mobileTools.inputs.og")} onChangeText={setOg} value={og} />
          </Grow>
          {scaleToggle(ogScale, setOgScale, setOg)}
        </InputRow>
      </CalculatorField>
      <CalculatorField
        label={t("mobileTools.inputs.fg")}
        warning={fgScale === "SG" ? t("fgWarning") : null}
      >
        <InputRow>
          <Grow>
            <DecimalInput label={t("mobileTools.inputs.fg")} onChangeText={setFg} value={fg} />
          </Grow>
          {scaleToggle(fgScale, setFgScale, setFg)}
        </InputRow>
      </CalculatorField>
    </CalculatorScreen>
  );
}
