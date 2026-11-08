import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import type { GravityEntryUnit } from "@meadtools/brew-domain/entry-payload";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useThemeColors } from "@/hooks/useThemeColors";
import {
  buildGravityEnqueueInput,
  convertGravityText,
  GRAVITY_INPUT_RANGES,
  validateGravityInput
} from "@/outbox/gravity-entry-form";
import { useGravityOutbox } from "@/outbox/gravity-outbox-provider";

const UNITS: GravityEntryUnit[] = ["SG", "BRIX"];

export default function RecordGravityScreen() {
  const params = useLocalSearchParams<{ brewId: string; name?: string; unit?: string }>();
  const brewId = params.brewId ?? "";
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const outbox = useGravityOutbox();

  const [unit, setUnit] = useState<GravityEntryUnit>(params.unit === "BRIX" ? "BRIX" : "SG");
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const result = useMemo(() => validateGravityInput(text, unit), [text, unit]);
  const sgFormat = new Intl.NumberFormat(i18n.language, {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3
  });
  const unitLabel = t(unit === "SG" ? "mobileBrews.recordGravity.unitSg" : "mobileBrews.recordGravity.unitBrix");

  // Show "empty" only after a save attempt; show other problems as typed.
  const visibleError = !result.ok && (submitted || result.error !== "empty") ? result.error : null;
  const errorMessage = visibleError === "range"
    ? t("mobileBrews.recordGravity.errors.range", {
        min: new Intl.NumberFormat(i18n.language, {
          minimumFractionDigits: unit === "SG" ? 3 : 0
        }).format(GRAVITY_INPUT_RANGES[unit].min),
        max: new Intl.NumberFormat(i18n.language, {
          minimumFractionDigits: unit === "SG" ? 3 : 0
        }).format(GRAVITY_INPUT_RANGES[unit].max),
        unit: unitLabel
      })
    : visibleError
      ? t(`mobileBrews.recordGravity.errors.${visibleError}`)
      : saveFailed
        ? t("mobileBrews.recordGravity.errors.saveFailed")
        : null;

  async function save() {
    setSubmitted(true);
    setSaveFailed(false);
    if (!result.ok || !outbox || saving) return;
    setSaving(true);
    try {
      await outbox.enqueue(
        buildGravityEnqueueInput({ brewId, reading: result, note, measuredAt: new Date() })
      );
      router.back();
    } catch {
      setSaveFailed(true);
      setSaving(false);
    }
  }

  if (!outbox || !brewId) {
    return (
      <View style={styles.unavailable}>
        <Text accessibilityRole="alert" style={styles.body}>
          {t("mobileBrews.recordGravity.unavailable")}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {params.name ? <Text style={styles.brewName}>{params.name}</Text> : null}

        <View style={styles.field}>
          <Text style={styles.label}>{t("mobileBrews.recordGravity.readingLabel")}</Text>
          <View style={styles.readingRow}>
            <TextInput
              accessibilityLabel={`${t("mobileBrews.recordGravity.readingLabel")}, ${unitLabel}`}
              autoFocus
              inputMode="decimal"
              keyboardType="decimal-pad"
              onChangeText={(value) => {
                setText(value);
                setSaveFailed(false);
              }}
              onSubmitEditing={() => void save()}
              placeholder={unit === "SG" ? sgFormat.format(1.05) : new Intl.NumberFormat(i18n.language).format(12.5)}
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              style={[styles.input, styles.readingInput, visibleError && styles.inputInvalid]}
              value={text}
            />
            <View accessibilityRole="radiogroup" accessibilityLabel={t("mobileBrews.recordGravity.unitLabel")} style={styles.segments}>
              {UNITS.map((option) => {
                const selected = option === unit;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={option}
                    onPress={() => {
                      if (selected) return;
                      setText((current) => convertGravityText(current, unit, option));
                      setUnit(option);
                    }}
                    style={[styles.segment, selected && styles.segmentSelected]}
                  >
                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                      {t(option === "SG" ? "mobileBrews.recordGravity.unitSg" : "mobileBrews.recordGravity.unitBrix")}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {errorMessage ? (
            <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>
              {errorMessage}
            </Text>
          ) : result.ok && unit === "BRIX" ? (
            <Text accessibilityLiveRegion="polite" style={styles.hint}>
              {t("mobileBrews.recordGravity.brixNote", { sg: sgFormat.format(result.sg) })}
            </Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t("mobileBrews.recordGravity.noteLabel")}</Text>
          <TextInput
            accessibilityLabel={t("mobileBrews.recordGravity.noteLabel")}
            multiline
            onChangeText={setNote}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.noteInput]}
            textAlignVertical="top"
            value={note}
          />
        </View>

        <Text style={styles.hint}>{t("mobileBrews.recordGravity.measuredNow")}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: saving, disabled: saving }}
          disabled={saving}
          onPress={() => void save()}
          style={({ pressed }) => [styles.button, saving && styles.buttonDisabled, pressed && !saving && styles.buttonPressed]}
        >
          {saving ? (
            <ActivityIndicator accessibilityLabel={t("mobileBrews.recordGravity.saving")} color={colors.onAccent} />
          ) : (
            <Text style={styles.buttonText}>{t("mobileBrews.recordGravity.save")}</Text>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}
        >
          <Text style={styles.secondaryButtonText}>{t("mobileBrews.recordGravity.cancel")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { gap: spacing.lg, padding: spacing.xl },
    unavailable: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      padding: spacing.xl,
      backgroundColor: colors.background
    },
    brewName: { color: colors.text, fontSize: typography.size.action, fontWeight: typography.weight.bold },
    body: { color: colors.text, fontSize: typography.size.body, textAlign: "center" },
    field: { gap: spacing.sm },
    label: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    readingRow: { flexDirection: "row", gap: spacing.md, alignItems: "stretch" },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: typography.size.body,
      paddingHorizontal: spacing.lg
    },
    inputInvalid: { borderColor: colors.error, borderWidth: 2 },
    readingInput: {
      flex: 1,
      fontSize: typography.size.title,
      fontVariant: ["tabular-nums"],
      fontWeight: typography.weight.bold
    },
    noteInput: { minHeight: 96, paddingTop: spacing.md },
    segments: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      overflow: "hidden"
    },
    segment: {
      minWidth: 56,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.md,
      backgroundColor: colors.surface
    },
    segmentSelected: { backgroundColor: colors.accent },
    segmentText: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    segmentTextSelected: { color: colors.onAccent },
    error: { color: colors.error, fontSize: typography.size.caption, fontWeight: typography.weight.bold },
    hint: { color: colors.textMuted, fontSize: typography.size.caption },
    button: {
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.lg,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl
    },
    buttonDisabled: { opacity: 0.45 },
    buttonPressed: { opacity: 0.8 },
    buttonText: { color: colors.onAccent, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    secondaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
    secondaryButtonText: { color: colors.text, fontSize: typography.size.body }
  });
}
