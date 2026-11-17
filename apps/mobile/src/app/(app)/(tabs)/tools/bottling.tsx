import * as Crypto from "expo-crypto";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  BOTTLE_SIZES_L,
  BOTTLING_TOLERANCE,
  FL_OZ_PER_L,
  L_PER_GAL,
  bottleTotals,
  bottleVolumeLiters,
  bottlesToFinish,
  bottlingStatus
} from "@meadtools/core/extra-calculators";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { BatchVolumeField, type BatchVolumeUnit } from "@/components/batch-volume-field";
import { CalculatorScreen, ResultCard, Segmented } from "@/components/calculator-ui";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
  calculatorInputText,
  convertVolumeText,
  formatCalculatorResult,
  readCalculatorNumber
} from "@/tools/calculator-input";

type CustomUnit = "ml" | "fl_oz" | "liter" | "gallon";
const CUSTOM_UNITS = ["ml", "fl_oz", "liter", "gallon"] as const satisfies readonly CustomUnit[];
const CUSTOM_UNIT_LABELS: Record<CustomUnit, string> = {
  ml: "bottlingCalculator.custom.units.ml",
  fl_oz: "bottlingCalculator.custom.units.flOz",
  liter: "bottlingCalculator.custom.units.liter",
  gallon: "units.gal"
};

type Row = { id: string; size: string | null; quantity: string; customSize: string; customUnit: CustomUnit };

const presetRows = (): Row[] =>
  Object.keys(BOTTLE_SIZES_L).map((size) => ({ id: size, size, quantity: "", customSize: "", customUnit: "liter" }));

/** Liters one bottle in the row holds (0 when a custom size is not a number yet). */
function bottleLiters(row: Row) {
  if (row.size !== null) return BOTTLE_SIZES_L[row.size];
  const value = readCalculatorNumber(row.customSize);
  return value === null ? 0 : bottleVolumeLiters(value, row.customUnit);
}

/** Whole bottles typed in a row; anything else counts as none, as on the web. */
const quantityOf = (row: Row) => readCalculatorNumber(row.quantity) ?? 0;

export default function BottlingScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const [volume, setVolume] = useState(() => calculatorInputText(locale, 5));
  const [unit, setUnit] = useState<BatchVolumeUnit>("gal");
  const [rows, setRows] = useState<Row[]>(presetRows);

  const target = readCalculatorNumber(volume) ?? 0;
  const targetLiters = unit === "gal" ? target * L_PER_GAL : target;
  const rowLiters = rows.map((row) => bottleLiters(row) * quantityOf(row));
  const { totalBottledLiters, remainingLiters } = bottleTotals(targetLiters, rowLiters);
  const toUnit = (liters: number) => (unit === "gal" ? liters / L_PER_GAL : liters);
  const remaining = toUnit(remainingLiters);
  const status = bottlingStatus(remaining);
  const unitShort = t(unit === "gal" ? "bottlingCalculator.units.galShort" : "bottlingCalculator.units.lShort");

  const update = (id: string, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const fill = (row: Row, index: number) => {
    const count = bottlesToFinish({
      targetLiters,
      bottledLiters: totalBottledLiters,
      rowLiters: rowLiters[index],
      perBottleLiters: bottleLiters(row)
    });
    update(row.id, { quantity: String(count) });
  };

  return (
    <CalculatorScreen>
      <ResultCard
        note={
          status === "ok"
            ? `${t("bottlingCalculator.status.ok.body")} (${t("bottlingCalculator.status.withinPrefix")} ${formatCalculatorResult(locale, BOTTLING_TOLERANCE, 1)} ${unitShort})`
            : t(`bottlingCalculator.status.${status}.body`)
        }
        title={t(`bottlingCalculator.status.${status}.title`)}
        tone={status === "error" ? "error" : "normal"}
        values={[
          {
            label: t("bottlingCalculator.results.totalVolumeBottled"),
            value: `${formatCalculatorResult(locale, toUnit(totalBottledLiters), 2)} ${unitShort}`
          },
          {
            label: t(remaining < 0 ? "bottlingCalculator.results.overBy" : "bottlingCalculator.results.unbottledVolume"),
            value: `${formatCalculatorResult(locale, Math.abs(remaining), 2)} ${unitShort}`
          }
        ]}
      />
      <BatchVolumeField
        convertText={(text, from, to) => convertVolumeText(locale, text, from, to, L_PER_GAL)}
        label={t("bottlingCalculator.totalVolumeLabel")}
        onUnitChange={setUnit}
        onVolumeChange={setVolume}
        unit={unit}
        volume={volume}
      />
      {rows.map((row, index) => {
        const perBottle = bottleLiters(row);
        const liters = rowLiters[index];
        // Bottles of this size that reach the target with the other rows (the web's "Bottles to reach target").
        const toFinish = bottlesToFinish({ targetLiters, bottledLiters: totalBottledLiters, rowLiters: liters, perBottleLiters: perBottle });
        const canFill = toFinish > 0 && toFinish !== quantityOf(row);
        const total =
          unit === "gal"
            ? `${formatCalculatorResult(locale, liters * FL_OZ_PER_L, 1)} ${t("bottlingCalculator.units.flOzShort")}`
            : `${formatCalculatorResult(locale, liters, 1)} ${t("bottlingCalculator.units.lShort")}`;
        const percent = targetLiters > 0 ? (liters / targetLiters) * 100 : 0;
        const name = row.size ?? t("bottlingCalculator.custom.sizePlaceholder");
        return (
          <View key={row.id} style={styles.row}>
            <View style={styles.rowTop}>
              {row.size !== null ? (
                <Text style={styles.size}>{row.size}</Text>
              ) : (
                <TextInput
                  accessibilityLabel={t("bottlingCalculator.custom.sizePlaceholder")}
                  inputMode="decimal"
                  keyboardType="decimal-pad"
                  onChangeText={(customSize) => update(row.id, { customSize })}
                  placeholder={t("bottlingCalculator.custom.sizePlaceholder")}
                  placeholderTextColor={colors.placeholder}
                  selectTextOnFocus
                  style={[styles.input, styles.customInput]}
                  value={row.customSize}
                />
              )}
              <TextInput
                accessibilityLabel={`${name}, ${t("bottlingCalculator.table.qty")}`}
                inputMode="numeric"
                keyboardType="number-pad"
                onChangeText={(quantity) => update(row.id, { quantity })}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                selectTextOnFocus
                style={[styles.input, styles.quantity]}
                value={row.quantity}
              />
            </View>
            {row.size === null ? (
              <Segmented
                label={t("mobileTools.inputs.bottleUnit")}
                onChange={(customUnit) => update(row.id, { customUnit })}
                optionLabel={(option) => t(CUSTOM_UNIT_LABELS[option])}
                options={CUSTOM_UNITS}
                value={row.customUnit}
              />
            ) : null}
            <View style={styles.rowBottom}>
              <Text style={styles.detail}>
                {`${total} · ${formatCalculatorResult(locale, percent, 1)}% ${t("mobileTools.bottling.ofBatch")}`}
              </Text>
              <View style={styles.actions}>
                {row.size === null ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setRows((current) => current.filter((item) => item.id !== row.id))}
                    style={({ pressed }) => [styles.action, pressed && styles.pressed]}
                  >
                    <Text style={styles.actionText}>{t("bottlingCalculator.custom.remove")}</Text>
                  </Pressable>
                ) : null}
                {toFinish > 0 ? (
                  <Pressable
                    accessibilityHint={t("bottlingCalculator.table.remainingBottles")}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canFill }}
                    disabled={!canFill}
                    onPress={() => fill(row, index)}
                    style={({ pressed }) => [styles.action, !canFill && styles.disabled, pressed && styles.pressed]}
                  >
                    <Text style={styles.actionText}>{t("mobileTools.bottling.fill", { count: toFinish })}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          setRows((current) => [
            ...current,
            { id: Crypto.randomUUID(), size: null, quantity: "", customSize: "", customUnit: "liter" }
          ])
        }
        style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
      >
        <Text style={styles.actionText}>{t("bottlingCalculator.custom.add")}</Text>
      </Pressable>
    </CalculatorScreen>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    row: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md
    },
    rowTop: { alignItems: "center", flexDirection: "row", gap: spacing.md },
    rowBottom: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
    size: { color: colors.text, flex: 1, fontSize: typography.size.action, fontWeight: typography.weight.bold },
    input: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.action,
      fontVariant: ["tabular-nums"],
      minHeight: 44,
      paddingHorizontal: spacing.md
    },
    customInput: { flex: 1 },
    quantity: { textAlign: "right", width: 88 },
    detail: { color: colors.textMuted, flexShrink: 1, fontSize: typography.size.caption },
    actions: { flexDirection: "row", gap: spacing.sm },
    action: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: spacing.md
    },
    actionText: { color: colors.text, fontSize: typography.size.caption, fontWeight: typography.weight.bold },
    disabled: { opacity: 0.4 },
    addButton: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderStyle: "dashed",
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 52
    },
    pressed: { opacity: 0.7 }
  });
}
