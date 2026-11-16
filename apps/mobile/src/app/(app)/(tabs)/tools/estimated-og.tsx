import { useState } from "react";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";

import { estimatedOriginalGravityResult } from "@meadtools/core/extra-calculators";

import {
  AbvResult,
  CalculatorField,
  CalculatorLink,
  CalculatorNote,
  CalculatorScreen,
  DecimalInput,
  ResultCard
} from "@/components/calculator-ui";
import { webPageUrl } from "@/config/api";
import { calculatorInputText, formatCalculatorResult, readCalculatorNumbers } from "@/tools/calculator-input";

export default function EstimatedOgScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const [hydrometer, setHydrometer] = useState(() => calculatorInputText(locale, 1));
  const [refractometer, setRefractometer] = useState(() => calculatorInputText(locale, 5));

  const values = readCalculatorNumbers([hydrometer, refractometer] as const);
  const result = values ? estimatedOriginalGravityResult(values[0], values[1]) : null;

  return (
    <CalculatorScreen>
      <ResultCard
        title={t("mobileTools.result.estimatedOg")}
        values={[
          { label: t("SG"), value: result ? formatCalculatorResult(locale, result.sg, 3, true) : null },
          { label: t("BRIX"), value: result ? formatCalculatorResult(locale, result.brix, 2) : null }
        ]}
      />
      <AbvResult abv={result} />
      <CalculatorField label={`${t("mobileTools.inputs.hydrometerFg")} (${t("SG")})`}>
        <DecimalInput
          label={`${t("mobileTools.inputs.hydrometerFg")}, ${t("SG")}`}
          onChangeText={setHydrometer}
          value={hydrometer}
        />
      </CalculatorField>
      <CalculatorField label={`${t("mobileTools.inputs.refractometerFg")} (${t("BRIX")})`}>
        <DecimalInput
          label={`${t("mobileTools.inputs.refractometerFg")}, ${t("BRIX")}`}
          onChangeText={setRefractometer}
          value={refractometer}
        />
      </CalculatorField>
      <CalculatorNote>{t("mobileTools.estimatedOg.about")}</CalculatorNote>
      <CalculatorLink
        label={t("mobileTools.estimatedOg.article")}
        onPress={() => void Linking.openURL(webPageUrl("/woodlandbrew-abv-without-og"))}
      />
    </CalculatorScreen>
  );
}
