import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { benchTrial } from "@meadtools/core/extra-calculators";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { BatchVolumeField, type BatchVolumeUnit } from "@/components/batch-volume-field";
import {
  CalculatorField,
  CalculatorLink,
  CalculatorScreen,
  DecimalInput,
  ResultCard
} from "@/components/calculator-ui";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
  calculatorInputText,
  convertVolumeText,
  formatCalculatorResult,
  readCalculatorNumber,
  readCalculatorNumbers
} from "@/tools/calculator-input";

const VIDEO_URL = "https://youtu.be/T-xGG3AKaiM?si=TPB_-DtgE0a5Esti";
const DEFAULT_TRIALS = [0.5, 1, 1.5, 2];

export default function BenchTrialsScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const [batchSize, setBatchSize] = useState(() => calculatorInputText(locale, 1));
  const [unit, setUnit] = useState<BatchVolumeUnit>("gal");
  const [sampleSize, setSampleSize] = useState(() => calculatorInputText(locale, 50));
  const [concentration, setConcentration] = useState(() => calculatorInputText(locale, 10));
  const [trials, setTrials] = useState(() => DEFAULT_TRIALS.map((ml) => calculatorInputText(locale, ml)));
  const [showHowTo, setShowHowTo] = useState(false);

  const batch = readCalculatorNumbers([batchSize, sampleSize, concentration] as const);
  const format = (value: number) => formatCalculatorResult(locale, value, 3);
  const scaledLabel = unit === "gal" ? t("mobileTools.result.perGallon") : t("mobileTools.result.perLiter");

  return (
    <CalculatorScreen>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showHowTo }}
        onPress={() => setShowHowTo((current) => !current)}
        style={styles.howToHeader}
      >
        <Text style={styles.howToTitle}>{t("benchTrials.howToUseTitle")}</Text>
        <Text style={styles.howToTitle}>{showHowTo ? "−" : "+"}</Text>
      </Pressable>
      {showHowTo ? (
        <View style={styles.howTo}>
          {[
            t("benchTrials.howToUse.steps.0", { sampleSize }),
            t("benchTrials.howToUse.steps.1", { solutionVolumeLabel: t("mobileTools.inputs.stockVolume") }),
            t("benchTrials.howToUse.steps.2"),
            t("benchTrials.howToUse.steps.3", { scaledAdjunctLabel: scaledLabel })
          ].map((step, index) => (
            <Text key={index} style={styles.howToText}>{`${index + 1}. ${step}`}</Text>
          ))}
          <Text style={styles.howToBold}>{t("benchTrials.howToUse.exampleTitle")}</Text>
          <Text style={styles.howToText}>{t("benchTrials.howToUse.exampleBody")}</Text>
          <Text style={styles.howToText}>{t("benchTrials.howToUse.addendum")}</Text>
          <CalculatorLink label={t("benchTrials.howToUse.videoLinkText")} onPress={() => void Linking.openURL(VIDEO_URL)} />
        </View>
      ) : null}
      <BatchVolumeField
        convertText={(text, from, to) => convertVolumeText(locale, text, from, to, 3.785)}
        label={t("mobileTools.inputs.batchSize")}
        onUnitChange={setUnit}
        onVolumeChange={setBatchSize}
        unit={unit}
        volume={batchSize}
      />
      <CalculatorField label={t("mobileTools.inputs.sampleSize")}>
        <DecimalInput label={t("mobileTools.inputs.sampleSize")} onChangeText={setSampleSize} value={sampleSize} />
      </CalculatorField>
      <CalculatorField label={t("mobileTools.inputs.stockConcentration")}>
        <DecimalInput
          label={t("mobileTools.inputs.stockConcentration")}
          onChangeText={setConcentration}
          value={concentration}
        />
      </CalculatorField>
      {trials.map((text, index) => {
        const stock = readCalculatorNumber(text);
        const result =
          batch && stock !== null
            ? benchTrial(stock, batch[2], batch[1], batch[0], unit === "gal" ? "gallon" : "liter")
            : null;
        const name = t("mobileTools.benchTrials.trial", { number: index + 1 });
        return (
          <View key={index} style={styles.trial}>
            <CalculatorField label={`${name}: ${t("mobileTools.inputs.stockVolume")}`}>
              <DecimalInput
                label={`${name}, ${t("mobileTools.inputs.stockVolume")}`}
                onChangeText={(next) => setTrials((current) => current.map((value, i) => (i === index ? next : value)))}
                value={text}
              />
            </CalculatorField>
            <ResultCard
              values={[
                { label: t("mobileTools.result.adjunctInSample"), value: result ? `${format(result.adjunctAmount)} ${t("units.g")}` : null },
                { label: t("mobileTools.result.ppm"), value: result ? format(result.adjunctConcentration) : null }
              ]}
            />
            <ResultCard
              values={[
                { label: scaledLabel, value: result ? `${format(result.scaledAdjunct)} ${t("units.g")}` : null },
                { label: t("mobileTools.result.wholeBatch"), value: result ? `${format(result.scaledBatch)} ${t("units.g")}` : null }
              ]}
            />
          </View>
        );
      })}
    </CalculatorScreen>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    howToHeader: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: "row",
      justifyContent: "space-between",
      minHeight: 52,
      paddingHorizontal: spacing.lg
    },
    howToTitle: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    howTo: { gap: spacing.sm },
    howToText: { color: colors.text, fontSize: typography.size.body },
    howToBold: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    trial: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: spacing.md,
      paddingTop: spacing.lg
    }
  });
}
