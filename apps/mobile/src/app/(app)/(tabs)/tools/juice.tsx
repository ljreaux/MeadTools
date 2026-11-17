import { useState } from "react";
import { useTranslation } from "react-i18next";

import { convertJuiceServing, convertJuiceSugar, juiceLabelEstimate } from "@meadtools/core/extra-calculators";

import {
  CalculatorField,
  CalculatorNote,
  CalculatorScreen,
  DecimalInput,
  Grow,
  InputRow,
  ResultCard,
  Segmented
} from "@/components/calculator-ui";
import { calculatorInputText, formatCalculatorResult, readCalculatorNumber, readCalculatorNumbers } from "@/tools/calculator-input";
import { useUnitSwitch } from "@/tools/use-unit-switch";

const SUGAR_UNITS = ["g", "mg"] as const;
const SERVING_UNITS = ["ml", "floz"] as const;
type SugarUnit = (typeof SUGAR_UNITS)[number];
type ServingUnit = (typeof SERVING_UNITS)[number];

/** Converts typed text with a core conversion, leaving text that is not a number. */
function convertText(locale: string, text: string, convert: (value: number) => number) {
  const value = readCalculatorNumber(text);
  return value === null ? text : calculatorInputText(locale, convert(value), 4);
}

export default function JuiceScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [sugar, setSugar] = useState("");
  const [sugarUnit, setSugarUnit] = useState<SugarUnit>("g");
  const [serving, setServing] = useState("");
  const [servingUnit, setServingUnit] = useState<ServingUnit>("ml");
  const [servings, setServings] = useState("");
  const switchSugar = useUnitSwitch<SugarUnit>();
  const switchServing = useUnitSwitch<ServingUnit>();

  const values = readCalculatorNumbers([sugar, serving, servings] as const);
  const result = values ? juiceLabelEstimate(values[0], sugarUnit, values[1], servingUnit, values[2]) : null;
  const sugarLabel = (unit: SugarUnit) => t(`units.${unit}`);
  const servingLabel = (unit: ServingUnit) => t(unit === "ml" ? "units.mL" : "units.fl_oz");

  return (
    <CalculatorScreen>
      <ResultCard
        values={[
          { label: t("BRIX"), value: result ? formatCalculatorResult(locale, result.brix, 3) : null },
          { label: t("SG"), value: result ? formatCalculatorResult(locale, result.specificGravity, 3, true) : null }
        ]}
      />
      <ResultCard
        values={[
          {
            label: t("mobileTools.result.sugarPerContainer"),
            value: result ? `${formatCalculatorResult(locale, result.totalSugar, 3)} ${sugarLabel(sugarUnit)}` : null
          }
        ]}
      />
      <CalculatorField label={t("mobileTools.inputs.sugarPerServing")}>
        <InputRow>
          <Grow>
            <DecimalInput label={`${t("mobileTools.inputs.sugarPerServing")}, ${sugarLabel(sugarUnit)}`} onChangeText={setSugar} value={sugar} />
          </Grow>
          <Segmented
            label={t("mobileTools.inputs.sugarUnit")}
            onChange={(next) => {
              setSugar(
                switchSugar(sugar, sugarUnit, next, (text) =>
                  convertText(locale, text, (value) => convertJuiceSugar(value, sugarUnit, next))
                )
              );
              setSugarUnit(next);
            }}
            optionLabel={sugarLabel}
            options={SUGAR_UNITS}
            value={sugarUnit}
          />
        </InputRow>
      </CalculatorField>
      <CalculatorField label={t("mobileTools.inputs.servingSize")}>
        <InputRow>
          <Grow>
            <DecimalInput label={`${t("mobileTools.inputs.servingSize")}, ${servingLabel(servingUnit)}`} onChangeText={setServing} value={serving} />
          </Grow>
          <Segmented
            label={t("mobileTools.inputs.servingUnit")}
            onChange={(next) => {
              setServing(
                switchServing(serving, servingUnit, next, (text) =>
                  convertText(locale, text, (value) => convertJuiceServing(value, servingUnit, next))
                )
              );
              setServingUnit(next);
            }}
            optionLabel={servingLabel}
            options={SERVING_UNITS}
            value={servingUnit}
          />
        </InputRow>
      </CalculatorField>
      <CalculatorField label={t("mobileTools.inputs.servingsPerContainer")}>
        <DecimalInput label={t("mobileTools.inputs.servingsPerContainer")} onChangeText={setServings} value={servings} />
      </CalculatorField>
      <CalculatorNote>{t("mobileTools.juice.note")}</CalculatorNote>
    </CalculatorScreen>
  );
}
