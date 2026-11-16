import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { isImplausibleAbv } from "@meadtools/core/extra-calculators";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useThemeColors } from "@/hooks/useThemeColors";
import { formatCalculatorResult } from "@/tools/calculator-input";

type Colors = typeof colorThemes.light;

function useStyles() {
  const { colors } = useThemeColors();
  return { colors, styles: createStyles(colors) };
}

/**
 * Room for the Android keyboard. Android draws edge to edge, so the window no
 * longer shrinks when the keyboard opens. This measures where the screen really
 * sits in the window (below the header, above the tabs) and returns how much of
 * it the keyboard covers. KeyboardAvoidingView measures from its parent instead
 * and leaves fields near the bottom hidden.
 */
function useAndroidKeyboardInset() {
  const containerRef = useRef<View>(null);
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (process.env.EXPO_OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", (event) => {
      // The container keeps its height while padded, so this stays correct
      // when the keyboard changes size while open.
      containerRef.current?.measureInWindow((_x, y, _width, height) => {
        setInset(Math.max(0, y + height - event.endCoordinates.screenY));
      });
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { containerRef, inset };
}

/**
 * Scrolling screen for a calculator; the keyboard never hides a focused field.
 * `stickyHeaderIndices` keeps those children pinned to the top while scrolling.
 */
export function CalculatorScreen({
  children,
  scrollRef,
  stickyHeaderIndices
}: {
  children: ReactNode;
  scrollRef?: Ref<ScrollView>;
  stickyHeaderIndices?: number[];
}) {
  const { styles } = useStyles();
  const { containerRef, inset } = useAndroidKeyboardInset();
  // iOS insets the scroll view itself. On Android the padding shrinks the
  // scroll view, which scrolls the focused field back into view.
  return (
    <View ref={containerRef} style={[styles.screen, { paddingBottom: inset }]}>
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
        stickyHeaderIndices={stickyHeaderIndices}
        style={styles.screen}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function CalculatorField({
  label,
  children,
  hint,
  warning
}: {
  label: string;
  children: ReactNode;
  hint?: string | null;
  warning?: string | null;
}) {
  const { styles } = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {warning ? (
        <Text accessibilityLiveRegion="polite" style={styles.warning}>
          {warning}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function DecimalInput({
  label,
  value,
  onChangeText,
  invalid = false
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  invalid?: boolean;
}) {
  const { colors, styles } = useStyles();
  return (
    <TextInput
      accessibilityLabel={label}
      inputMode="decimal"
      keyboardType="decimal-pad"
      onChangeText={onChangeText}
      placeholderTextColor={colors.placeholder}
      selectTextOnFocus
      style={[styles.input, invalid && styles.inputInvalid]}
      value={value}
    />
  );
}

/** A decimal input with a unit toggle beside it. */
export function InputRow({ children }: { children: ReactNode }) {
  const { styles } = useStyles();
  return <View style={styles.row}>{children}</View>;
}

export function Grow({ children }: { children: ReactNode }) {
  const { styles } = useStyles();
  return <View style={styles.grow}>{children}</View>;
}

export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  optionLabel
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  optionLabel: (option: T) => string;
}) {
  const { styles } = useStyles();
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup" style={styles.segments}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option}
            onPress={() => onChange(option)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            {/* Segment labels need short translations; long ones shrink first. */}
            <Text
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              numberOfLines={1}
              style={[styles.segmentText, selected && styles.segmentTextSelected]}
            >
              {optionLabel(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type ResultValue = { label: string; value: string | null };

/**
 * The calculator's answer, shown above the inputs so the keyboard never covers
 * it. A `null` value is shown as a dash until every input is a number.
 */
export function ResultCard({
  title,
  values,
  tone = "normal",
  note
}: {
  title?: string;
  values: readonly ResultValue[];
  tone?: "normal" | "error";
  note?: string | null;
}) {
  const { styles } = useStyles();
  const { t } = useTranslation();
  const shown = values.map((item) => ({ ...item, text: item.value ?? "—" }));
  const summary = [
    title,
    ...shown.map((item) =>
      item.value === null ? `${item.label}: ${t("mobileTools.result.unavailable")}` : `${item.label}: ${item.text}`
    ),
    note
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View
      accessibilityLabel={summary}
      accessible
      style={[styles.result, tone === "error" && styles.resultError]}
    >
      {title ? <Text style={styles.resultTitle}>{title}</Text> : null}
      <View style={styles.resultValues}>
        {shown.map((item, index) => (
          <View key={item.label} style={[styles.resultItem, index > 0 && styles.resultDivider]}>
            <Text adjustsFontSizeToFit numberOfLines={1} style={styles.resultValue}>
              {item.text}
            </Text>
            <Text style={styles.resultLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
      {note ? <Text style={[styles.resultNote, tone === "error" && styles.resultNoteError]}>{note}</Text> : null}
    </View>
  );
}

/** ABV and Delle units, flagged like the web when fermentation cannot reach it. */
export function AbvResult({ abv }: { abv: { abvPercent: number; delle: number } | null }) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const implausible = abv !== null && isImplausibleAbv(abv.abvPercent);
  const tooHigh = abv !== null && implausible && abv.abvPercent > 0;

  return (
    <ResultCard
      note={tooHigh ? t("tipText.abvSeriousWarning") : null}
      tone={implausible ? "error" : "normal"}
      values={[
        {
          label: t("ABV"),
          value: abv ? `${formatCalculatorResult(locale, abv.abvPercent, 2)}%` : null
        },
        {
          label: t("DU"),
          value: abv ? formatCalculatorResult(locale, abv.delle, 0) : null
        }
      ]}
    />
  );
}

/** A labelled switch; the whole row toggles it for touch and screen readers. */
export function CalculatorSwitch({
  label,
  value,
  onValueChange
}: {
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  const { styles } = useStyles();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => onValueChange(!value)}
      style={styles.switchRow}
    >
      <Text style={[styles.label, styles.grow]}>{label}</Text>
      <Switch
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        onValueChange={onValueChange}
        value={value}
      />
    </Pressable>
  );
}

export function CalculatorLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { styles } = useStyles();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <Text style={styles.linkText}>{label}</Text>
    </Pressable>
  );
}

export function CalculatorNote({ children }: { children: string }) {
  const { styles } = useStyles();
  return <Text style={styles.hint}>{children}</Text>;
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { gap: spacing.lg, padding: spacing.xl },
    field: { gap: spacing.sm },
    label: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    hint: { color: colors.textMuted, fontSize: typography.size.caption },
    warning: { color: colors.error, fontSize: typography.size.caption, fontWeight: typography.weight.bold },
    row: { alignItems: "stretch", flexDirection: "row", gap: spacing.md },
    switchRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, minHeight: 44 },
    grow: { flex: 1 },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.title,
      fontVariant: ["tabular-nums"],
      fontWeight: typography.weight.bold,
      minHeight: 52,
      paddingHorizontal: spacing.lg
    },
    inputInvalid: { borderColor: colors.error, borderWidth: 2 },
    segments: {
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flexDirection: "row",
      minHeight: 52,
      overflow: "hidden"
    },
    segment: {
      alignItems: "center",
      backgroundColor: colors.surface,
      flex: 1,
      justifyContent: "center",
      minWidth: 56,
      paddingHorizontal: spacing.md
    },
    segmentSelected: { backgroundColor: colors.accent },
    segmentText: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    segmentTextSelected: { color: colors.onAccent },
    result: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.lg
    },
    resultError: { borderColor: colors.error, borderWidth: 2 },
    resultTitle: {
      color: colors.text,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
      textAlign: "center"
    },
    resultValues: { flexDirection: "row" },
    resultItem: { alignItems: "center", flex: 1, gap: spacing.xs, paddingHorizontal: spacing.sm },
    resultDivider: { borderLeftColor: colors.border, borderLeftWidth: 1 },
    resultValue: {
      color: colors.text,
      fontSize: typography.size.title,
      fontVariant: ["tabular-nums"],
      fontWeight: typography.weight.bold
    },
    resultLabel: { color: colors.textMuted, fontSize: typography.size.caption, textAlign: "center" },
    resultNote: { color: colors.textMuted, fontSize: typography.size.caption, textAlign: "center" },
    resultNoteError: { color: colors.error, fontWeight: typography.weight.bold },
    link: { justifyContent: "center", minHeight: 44 },
    linkText: {
      color: colors.text,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold,
      textDecorationLine: "underline"
    },
    pressed: { opacity: 0.7 }
  });
}
