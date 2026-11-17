import { useState } from "react";
import { useTranslation } from "react-i18next";

import { temperatureCorrectedGravity } from "@meadtools/core/extra-calculators";
import { toBrix } from "@meadtools/core/gravity";

import {
  CalculatorField,
  CalculatorScreen,
  DecimalInput,
  ResultCard,
  Segmented
} from "@/components/calculator-ui";
import {
  calculatorInputText,
  convertTemperatureText,
  formatCalculatorResult,
  readCalculatorNumber,
  readCalculatorNumbers
} from "@/tools/calculator-input";
import { useUnitSwitch } from "@/tools/use-unit-switch";

const SCALES = ["F", "C"] as const;
type Scale = (typeof SCALES)[number];

export default function TemperatureCorrectionScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [measured, setMeasured] = useState(() => calculatorInputText(locale, 1.1));
  const [scale, setScale] = useState<Scale>("F");
  const [current, setCurrent] = useState(() => calculatorInputText(locale, 90));
  const [calibration, setCalibration] = useState(() => calculatorInputText(locale, 68));
  const switchCurrent = useUnitSwitch<Scale>();
  const switchCalibration = useUnitSwitch<Scale>();

  const values = readCalculatorNumbers([measured, current, calibration] as const);
  const result = values
    ? temperatureCorrectedGravity({
        measuredSg: values[0],
        currentTemp: values[1],
        calibrationTemp: values[2],
        scale
      })
    : null;
  const measuredValue = readCalculatorNumber(measured);
  const unit = t(`units.${scale}`);

  return (
    <CalculatorScreen>
      <ResultCard
        title={t("mobileTools.result.correctedGravity")}
        values={[
          { label: t("SG"), value: result ? formatCalculatorResult(locale, result.sg, 3, true) : null },
          { label: t("BRIX"), value: result ? formatCalculatorResult(locale, result.brix, 2) : null }
        ]}
      />
      <CalculatorField
        hint={measuredValue === null ? null : `${formatCalculatorResult(locale, toBrix(measuredValue), 2)} ${t("BRIX")}`}
        label={t("mobileTools.inputs.measuredSg")}
      >
        <DecimalInput label={t("mobileTools.inputs.measuredSg")} onChangeText={setMeasured} value={measured} />
      </CalculatorField>
      <CalculatorField label={t("mobileTools.inputs.temperatureUnit")}>
        <Segmented
          label={t("mobileTools.inputs.temperatureUnit")}
          onChange={(next) => {
            const convert = (text: string) => convertTemperatureText(locale, text, scale, next);
            setCurrent(switchCurrent(current, scale, next, convert));
            setCalibration(switchCalibration(calibration, scale, next, convert));
            setScale(next);
          }}
          optionLabel={(option) => t(`units.${option}`)}
          options={SCALES}
          value={scale}
        />
      </CalculatorField>
      <CalculatorField label={`${t("mobileTools.inputs.currentTemp")} (${unit})`}>
        <DecimalInput label={`${t("mobileTools.inputs.currentTemp")}, ${unit}`} onChangeText={setCurrent} value={current} />
      </CalculatorField>
      <CalculatorField label={`${t("mobileTools.inputs.calibrationTemp")} (${unit})`}>
        <DecimalInput
          label={`${t("mobileTools.inputs.calibrationTemp")}, ${unit}`}
          onChangeText={setCalibration}
          value={calibration}
        />
      </CalculatorField>
    </CalculatorScreen>
  );
}
