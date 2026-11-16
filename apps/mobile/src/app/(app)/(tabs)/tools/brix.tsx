import { useState } from "react";
import { useTranslation } from "react-i18next";

import { toBrix, toSG } from "@meadtools/core/gravity";

import {
  CalculatorField,
  CalculatorScreen,
  DecimalInput,
  Grow,
  InputRow,
  ResultCard,
  Segmented
} from "@/components/calculator-ui";
import { convertGravityText } from "@/outbox/gravity-entry-form";
import { calculatorInputText, formatCalculatorResult, readCalculatorNumber } from "@/tools/calculator-input";

const SCALES = ["SG", "BRIX"] as const;
type Scale = (typeof SCALES)[number];

export default function BrixCalculatorScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [scale, setScale] = useState<Scale>("SG");
  const [gravity, setGravity] = useState(() => calculatorInputText(locale, 1.1));

  const value = readCalculatorNumber(gravity);
  const result =
    value === null
      ? null
      : scale === "SG"
        ? formatCalculatorResult(locale, toBrix(value), 2)
        : formatCalculatorResult(locale, toSG(value), 3, true);

  return (
    <CalculatorScreen>
      <ResultCard values={[{ label: scale === "SG" ? t("BRIX") : t("SG"), value: result }]} />
      <CalculatorField label={t("mobileTools.inputs.gravity")}>
        <InputRow>
          <Grow>
            <DecimalInput label={t("mobileTools.inputs.gravity")} onChangeText={setGravity} value={gravity} />
          </Grow>
          <Segmented
            label={t("mobileTools.inputs.scale")}
            onChange={(next) => {
              setGravity((current) => convertGravityText(current, scale, next));
              setScale(next);
            }}
            optionLabel={(option) => t(option)}
            options={SCALES}
            value={scale}
          />
        </InputRow>
      </CalculatorField>
    </CalculatorScreen>
  );
}
