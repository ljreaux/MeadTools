import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  L_PER_GAL,
  PRIMING_CO2_RANGE,
  PRIMING_TEMPERATURE_RANGE,
  primingBottleSizes,
  primingSugarOptions,
  primingSugarTable
} from "@meadtools/core/extra-calculators";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useCatalog } from "@/catalogs/use-catalog";
import { BatchVolumeField, type BatchVolumeUnit } from "@/components/batch-volume-field";
import {
  CalculatorField,
  CalculatorNote,
  CalculatorScreen,
  DecimalInput,
  InputRow,
  Grow,
  Segmented
} from "@/components/calculator-ui";
import { useThemeColors } from "@/hooks/useThemeColors";
import {
  calculatorInputText,
  catalogLabelKey,
  convertTemperatureText,
  convertVolumeText,
  formatCalculatorResult,
  readCalculatorNumber,
  readCalculatorNumbers
} from "@/tools/calculator-input";
import { useUnitSwitch } from "@/tools/use-unit-switch";

const TEMPERATURE_SCALES = ["F", "C"] as const;
const BOTTLES = primingBottleSizes.map((bottle) => bottle.label);

export default function PrimingSugarScreen() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const ingredients = useCatalog("ingredients");
  const [volume, setVolume] = useState(() => calculatorInputText(locale, 1));
  const [unit, setUnit] = useState<BatchVolumeUnit>("gal");
  const [temperature, setTemperature] = useState(() => calculatorInputText(locale, 68));
  const [scale, setScale] = useState<(typeof TEMPERATURE_SCALES)[number]>("F");
  const switchTemperature = useUnitSwitch<(typeof TEMPERATURE_SCALES)[number]>();
  const [co2, setCo2] = useState(() => calculatorInputText(locale, 2.4));
  const [bottle, setBottle] = useState<string>(BOTTLES[0]);

  const sugars = useMemo(
    () => (ingredients.data ? primingSugarOptions(ingredients.data.data) : null),
    [ingredients.data]
  );
  const values = readCalculatorNumbers([volume, temperature, co2] as const);
  const rows =
    values && sugars
      ? primingSugarTable({
          volume: values[0],
          volumeUnit: unit,
          temperature: values[1],
          temperatureScale: scale,
          co2Volumes: values[2],
          sugars
        })
      : null;

  const temperatureValue = readCalculatorNumber(temperature);
  const temperatureRange = PRIMING_TEMPERATURE_RANGE[scale];
  const temperatureWarning =
    temperatureValue !== null && (temperatureValue < temperatureRange.min || temperatureValue > temperatureRange.max)
      ? t("mobileTools.priming.temperatureRange", { ...temperatureRange, unit: t(`units.${scale}`) })
      : null;
  const co2Value = readCalculatorNumber(co2);
  const co2Warning =
    co2Value !== null && (co2Value < PRIMING_CO2_RANGE.min || co2Value > PRIMING_CO2_RANGE.max)
      ? t("mobileTools.priming.co2Range", PRIMING_CO2_RANGE)
      : null;
  const belowResidual = rows !== null && rows.length > 0 && rows[0].totalGrams < 0;
  const grams = (value: number) => `${formatCalculatorResult(locale, value, 3)} ${t("units.g")}`;

  return (
    <CalculatorScreen>
      <BatchVolumeField
        convertText={(text, from, to) => convertVolumeText(locale, text, from, to, L_PER_GAL)}
        label={t("mobileTools.inputs.batchSize")}
        onUnitChange={setUnit}
        onVolumeChange={setVolume}
        unit={unit}
        volume={volume}
      />
      <CalculatorField label={t("mobileTools.inputs.meadTemperature")} warning={temperatureWarning}>
        <InputRow>
          <Grow>
            <DecimalInput
              invalid={temperatureWarning !== null}
              label={`${t("mobileTools.inputs.meadTemperature")}, ${t(`units.${scale}`)}`}
              onChangeText={setTemperature}
              value={temperature}
            />
          </Grow>
          <Segmented
            label={t("mobileTools.inputs.temperatureUnit")}
            onChange={(next) => {
              setTemperature(
                switchTemperature(temperature, scale, next, (text) => convertTemperatureText(locale, text, scale, next))
              );
              setScale(next);
            }}
            optionLabel={(option) => t(`units.${option}`)}
            options={TEMPERATURE_SCALES}
            value={scale}
          />
        </InputRow>
      </CalculatorField>
      <CalculatorField label={t("mobileTools.inputs.co2Volumes")} warning={co2Warning}>
        <DecimalInput
          invalid={co2Warning !== null}
          label={t("mobileTools.inputs.co2Volumes")}
          onChangeText={setCo2}
          value={co2}
        />
      </CalculatorField>
      <CalculatorField label={t("mobileTools.inputs.bottleSize")}>
        <Segmented label={t("mobileTools.inputs.bottleSize")} onChange={setBottle} optionLabel={(option) => option} options={BOTTLES} value={bottle} />
      </CalculatorField>

      {ingredients.isPending ? (
        <CalculatorNote>{t("mobileTools.offline.loading")}</CalculatorNote>
      ) : !sugars ? (
        <CalculatorNote>{t("mobileTools.offline.missing")}</CalculatorNote>
      ) : belowResidual ? (
        <CalculatorNote>{t("mobileTools.priming.belowResidual")}</CalculatorNote>
      ) : (
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.header, styles.name]}>{t("primingTable.sugarHeading")}</Text>
            <Text style={styles.header}>{t("primingTable.perBatchShort")}</Text>
            <Text style={styles.header}>{`${t("primingTable.perBottleShort")} (${bottle})`}</Text>
          </View>
          {sugars.map((sugar, index) => {
            const row = rows?.[index];
            const perBottle = row?.perBottle.find((item) => item.label === bottle);
            const name = t(catalogLabelKey(sugar.label), { defaultValue: sugar.label });
            return (
              <View
                accessible
                accessibilityLabel={`${name}: ${row ? grams(row.totalGrams) : "—"} ${t("primingTable.perBatchShort")}, ${perBottle ? grams(perBottle.grams) : "—"} ${t("primingTable.perBottleShort")}`}
                key={sugar.label}
                style={[styles.row, index > 0 && styles.divider]}
              >
                <Text style={[styles.cell, styles.name]}>{name}</Text>
                <Text style={styles.value}>{row ? grams(row.totalGrams) : "—"}</Text>
                <Text style={styles.value}>{perBottle ? grams(perBottle.grams) : "—"}</Text>
              </View>
            );
          })}
        </View>
      )}
    </CalculatorScreen>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    table: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      overflow: "hidden"
    },
    row: { alignItems: "center", flexDirection: "row", gap: spacing.sm, minHeight: 48, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    headerRow: { borderBottomColor: colors.border, borderBottomWidth: 1 },
    divider: { borderTopColor: colors.border, borderTopWidth: 1 },
    header: { color: colors.textMuted, flex: 1, fontSize: typography.size.caption, fontWeight: typography.weight.bold, textAlign: "right" },
    name: { flex: 1.4, textAlign: "left" },
    cell: { color: colors.text, fontSize: typography.size.body },
    value: { color: colors.text, flex: 1, fontSize: typography.size.body, fontVariant: ["tabular-nums"], textAlign: "right" }
  });
}
