import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { CalculatorNote, CalculatorScreen, CalculatorSection } from "@/components/calculator-ui";
import {
  BatchFields,
  GoFermFields,
  GoFermResult,
  NutrientAmounts,
  NutrientSelectionFields,
  NutrientSettingsFields,
  YanResult,
  YeastFields
} from "@/components/nutrient-sections";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useNutrientCalculator } from "@/tools/use-nutrient-calculator";

const STEPS = ["batch", "nutrients", "goFerm", "results"] as const;

/**
 * The nutrient calculator in the web calculator's steps, with the results on a
 * screen of their own so nothing needs a scroll back up. The same steps can
 * later sit inside the recipe builder.
 */
export default function NutrientCalculatorScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const calc = useNutrientCalculator();
  const [step, setStep] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const current = STEPS[step];
  const last = STEPS.length - 1;
  const scrollRef = useRef<ScrollView>(null);

  // Each step starts at its top, whether reached from the pinned bar or the buttons.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  return (
    // The step header (child 0) stays pinned while the step scrolls under it.
    <CalculatorScreen scrollRef={scrollRef} stickyHeaderIndices={[0]}>
      <View style={styles.progress}>
        <Text style={styles.stepCount}>{t("mobileTools.nutrients.stepOf", { step: step + 1, total: STEPS.length })}</Text>
        <Text accessibilityRole="header" style={styles.stepTitle}>
          {t(`mobileTools.nutrients.steps.${current}`)}
        </Text>
        <View accessibilityRole="tablist" style={styles.track}>
          {STEPS.map((key, index) => (
            <Pressable
              accessibilityLabel={`${t("mobileTools.nutrients.stepOf", { step: index + 1, total: STEPS.length })}, ${t(`mobileTools.nutrients.steps.${key}`)}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: index === step }}
              key={key}
              onPress={() => setStep(index)}
              style={styles.segmentTouch}
            >
              <View style={[styles.segment, index <= step && styles.segmentReached]} />
            </Pressable>
          ))}
        </View>
      </View>

      {current === "batch" ? (
        <>
          <CalculatorSection title={t("batchDetails")} />
          <BatchFields calc={calc} />
          <CalculatorSection title={t("yeastDetails")} />
          <YeastFields calc={calc} />
        </>
      ) : current === "nutrients" ? (
        <>
          <CalculatorSection title={t("selectNutes")} />
          <NutrientSelectionFields calc={calc} />
          {/* Rarely needed and discouraged, so it sits at the bottom behind a link. */}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showSettings }}
            onPress={() => setShowSettings((value) => !value)}
            style={styles.settingsLink}
          >
            <Text style={styles.settingsLinkText}>{t("other.settingsTitle")}</Text>
          </Pressable>
          {showSettings ? (
            <View style={styles.settings}>
              <CalculatorNote>{t("tipText.adjustYanValue")}</CalculatorNote>
              <NutrientSettingsFields calc={calc} />
            </View>
          ) : null}
        </>
      ) : current === "goFerm" ? (
        <>
          <CalculatorSection title={t("gfDetails")} />
          <GoFermFields calc={calc} />
        </>
      ) : (
        <>
          <YanResult calc={calc} />
          <NutrientAmounts calc={calc} />
          <GoFermResult calc={calc} />
        </>
      )}

      <View style={styles.nav}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: step === 0 }}
          disabled={step === 0}
          onPress={() => setStep((value) => value - 1)}
          style={({ pressed }) => [styles.navButton, step === 0 && styles.disabled, pressed && styles.pressed]}
        >
          <Text style={styles.navText}>{t("buttonLabels.back")}</Text>
        </Pressable>
        {step < last ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setStep((value) => value + 1)}
            style={({ pressed }) => [styles.navButton, styles.navPrimary, pressed && styles.pressed]}
          >
            <Text style={[styles.navText, styles.navPrimaryText]}>
              {step === last - 1 ? t("mobileTools.nutrients.showResults") : t("buttonLabels.next")}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </CalculatorScreen>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    // Spans the screen's side padding so the pinned bar covers content edge to edge.
    progress: {
      backgroundColor: colors.background,
      borderBottomColor: colors.border,
      borderBottomWidth: StyleSheet.hairlineWidth,
      gap: spacing.xs,
      marginHorizontal: -spacing.xl,
      marginTop: -spacing.xl,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.xl
    },
    stepCount: {
      color: colors.textMuted,
      fontSize: typography.size.caption,
      fontWeight: typography.weight.bold,
      textTransform: "uppercase"
    },
    stepTitle: { color: colors.text, fontSize: typography.size.title, fontWeight: typography.weight.bold },
    track: { flexDirection: "row", gap: spacing.xs },
    // Thin bars with a 44 pt tall touch area each.
    segmentTouch: { flex: 1, justifyContent: "center", minHeight: 44 },
    segment: { backgroundColor: colors.border, borderRadius: radii.round, height: 6 },
    segmentReached: { backgroundColor: colors.accent },
    settingsLink: { alignSelf: "flex-start", justifyContent: "center", minHeight: 44 },
    settingsLinkText: {
      color: colors.textMuted,
      fontSize: typography.size.caption,
      fontWeight: typography.weight.bold,
      textDecorationLine: "underline"
    },
    settings: { borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
    nav: { flexDirection: "row", gap: spacing.md, paddingTop: spacing.md },
    navButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flex: 1,
      justifyContent: "center",
      minHeight: 52
    },
    navPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
    navText: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    navPrimaryText: { color: colors.onAccent },
    disabled: { opacity: 0.4 },
    pressed: { opacity: 0.7 }
  });
}
