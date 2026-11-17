import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { L_PER_GAL } from "@meadtools/core/extra-calculators";
import { calcSb } from "@meadtools/core/gravity";
import { parseNumber } from "@meadtools/core/numeric";
import type { GoFermType, NitrogenRequirement } from "@meadtools/core/nutrients";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import {
  CalculatorField,
  CalculatorNote,
  CalculatorSwitch,
  Chips,
  DecimalInput,
  Grow,
  InputRow,
  ResultCard,
  Segmented
} from "@/components/calculator-ui";
import { useThemeColors } from "@/hooks/useThemeColors";
import { calculatorInputText, convertVolumeText, formatCalculatorResult, localizeDecimalText } from "@/tools/calculator-input";
import { NUTRIENT_KEYS, type NutrientCalculator } from "@/tools/use-nutrient-calculator";
import { useUnitSwitch } from "@/tools/use-unit-switch";

const NITROGEN = ["Very Low", "Low", "Medium", "High", "Very High"] as const satisfies readonly NitrogenRequirement[];
export const NITROGEN_KEYS: Record<NitrogenRequirement, string> = {
  "Very Low": "veryLow",
  Low: "low",
  Medium: "medium",
  High: "high",
  "Very High": "veryHigh"
};
const GO_FERM = ["Go-Ferm", "protect", "sterol-flash", "none"] as const satisfies readonly GoFermType[];
export const GO_FERM_KEYS: Record<GoFermType, string> = {
  "Go-Ferm": "nuteResults.gfTypes.gf",
  protect: "nuteResults.gfTypes.gfProtect",
  "sterol-flash": "nuteResults.gfTypes.gfSterol",
  none: "nuteResults.gfTypes.none"
};
const VOLUME_UNITS = ["gal", "liter"] as const;
const MAX_STRAIN_MATCHES = 8;

type Props = { calc: NutrientCalculator };

function useStyles() {
  const { colors } = useThemeColors();
  return { colors, styles: createStyles(colors) };
}

function useFormat() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  return {
    t,
    locale,
    grams: (value: number, digits = 3) => `${formatCalculatorResult(locale, value, digits)} ${t("units.g")}`,
    ppm: (value: number) => `${formatCalculatorResult(locale, value, 0)} ${t("PPM")}`
  };
}

/** Target and remaining YAN only. */
export function YanResult({ calc }: Props) {
  const { t, ppm } = useFormat();
  const { derived } = calc;
  return (
    <ResultCard
      note={derived.remainingYanPpm > 0 ? t("tipText.remainingYan") : null}
      tone={derived.remainingYanPpm > 0 ? "error" : "normal"}
      values={[
        { label: t("targetYan"), value: ppm(derived.targetYanPpm) },
        { label: t("nuteResults.sideLabels.remainingYan"), value: ppm(derived.remainingYanPpm) }
      ]}
    />
  );
}

/** Grams of each selected nutrient, with a note when one needs none. */
export function NutrientAmounts({ calc }: Props) {
  const { t, grams } = useFormat();
  const { derived, selectedKeys, nutrientName } = calc;
  const showPerAddition = derived.numberOfAdditions > 1;
  const anyZero = selectedKeys.some((key) => derived.nutrientAdditions.totalGrams[key] <= 0);
  return (
    <>
      {selectedKeys.map((key) => (
        <ResultCard
          key={key}
          title={nutrientName(key)}
          values={[
            { label: t("nuteResults.sideLabels.totalGrams"), value: grams(derived.nutrientAdditions.totalGrams[key]) },
            ...(showPerAddition
              ? [{ label: t("nuteResults.sideLabels.perAddition"), value: grams(derived.nutrientAdditions.perAddition[key]) }]
              : [])
          ]}
        />
      ))}
      {anyZero ? <CalculatorNote>{t("nutrientWarning")}</CalculatorNote> : null}
    </>
  );
}

/** Go-Ferm and rehydration water, when a Go-Ferm product is chosen. */
export function GoFermResult({ calc }: Props) {
  const { t, locale, grams } = useFormat();
  const { data, derived } = calc;
  if (data.inputs.goFermType === "none") return null;
  return (
    <ResultCard
      title={t(GO_FERM_KEYS[data.inputs.goFermType])}
      values={[
        { label: t("nutrients.goFerm"), value: grams(derived.goFerm.amount, 2) },
        { label: t("nuteResults.gfWater"), value: `${formatCalculatorResult(locale, derived.goFerm.water, 2)} ${t("units.mL")}` }
      ]}
    />
  );
}

export function BatchFields({ calc }: Props) {
  const { t, locale } = useFormat();
  const { data, dispatch } = calc;
  const switchVolume = useUnitSwitch<"gal" | "lit">();
  const sg = parseNumber(data.inputs.sg);
  return (
    <>
      <CalculatorField label={t("nuteVolume")}>
        <InputRow>
          <Grow>
            <DecimalInput
              label={`${t("nuteVolume")}, ${t(data.inputs.volumeUnits === "gal" ? "units.gal" : "units.L")}`}
              onChangeText={(value) => dispatch({ type: "setVolume", value })}
              value={localizeDecimalText(locale, data.inputs.volume)}
            />
          </Grow>
          <Segmented
            label={t("mobileTools.inputs.volumeUnit")}
            onChange={(next) => {
              const from = data.inputs.volumeUnits === "gal" ? "gal" : "lit";
              const to = next === "gal" ? "gal" : "lit";
              const value = switchVolume(data.inputs.volume, from, to, (text) =>
                convertVolumeText(locale, text, from, to, L_PER_GAL)
              );
              dispatch({ type: "setVolume", value });
              dispatch({ type: "setVolumeUnits", value: next });
            }}
            optionLabel={(option) => t(option === "gal" ? "units.gal" : "units.L")}
            options={VOLUME_UNITS}
            value={data.inputs.volumeUnits}
          />
        </InputRow>
      </CalculatorField>
      <CalculatorField
        hint={Number.isFinite(sg) && sg > 0 ? `${t("nuteResults.sb")}: ${formatCalculatorResult(locale, calcSb(sg), 3, true)}` : null}
        label={t("nuteSgLabel")}
      >
        <DecimalInput label={t("nuteSgLabel")} onChangeText={(value) => dispatch({ type: "setSg", value })} value={localizeDecimalText(locale, data.inputs.sg)} />
      </CalculatorField>
      <CalculatorField label={t("offset")}>
        <DecimalInput label={t("offset")} onChangeText={(value) => dispatch({ type: "setOffsetPpm", value })} value={localizeDecimalText(locale, data.inputs.offsetPpm)} />
      </CalculatorField>
    </>
  );
}

export function YeastFields({ calc }: Props) {
  const { t } = useFormat();
  const { colors, styles } = useStyles();
  const { data, dispatch, yeasts, brands, yeastCatalog } = calc;
  const [strainQuery, setStrainQuery] = useState("");
  const strainMatches = useMemo(() => {
    const query = strainQuery.trim().toLowerCase();
    if (!query) return [];
    return yeasts
      .filter((yeast) => yeast.name.toLowerCase().includes(query))
      .sort((a, b) => Number(b.brand === data.selected.yeastBrand) - Number(a.brand === data.selected.yeastBrand))
      .slice(0, MAX_STRAIN_MATCHES);
  }, [yeasts, strainQuery, data.selected.yeastBrand]);

  return (
    <>
      {yeastCatalog.isPending ? (
        <CalculatorNote>{t("mobileTools.offline.loading")}</CalculatorNote>
      ) : !yeastCatalog.data ? (
        <CalculatorNote>{t("mobileTools.offline.missing")}</CalculatorNote>
      ) : (
        <>
          <CalculatorField label={t("yeastBrand")}>
            <Chips
              label={t("yeastBrand")}
              onChange={(brand) => dispatch({ type: "setYeastBrand", brand, yeasts })}
              optionLabel={(brand) => brand}
              options={brands}
              value={data.selected.yeastBrand}
            />
          </CalculatorField>
          <CalculatorField
            hint={t("mobileTools.nutrients.selectedYeast", { strain: data.selected.yeastStrain, brand: data.selected.yeastBrand })}
            label={t("yeastStrain")}
          >
            <TextInput
              accessibilityLabel={t("mobileTools.nutrients.strainSearch")}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setStrainQuery}
              placeholder={t("mobileTools.nutrients.strainSearch")}
              placeholderTextColor={colors.placeholder}
              returnKeyType="search"
              style={styles.search}
              value={strainQuery}
            />
            {strainMatches.length > 0 ? (
              <View style={styles.matches}>
                {strainMatches.map((yeast, index) => (
                  <Pressable
                    accessibilityRole="button"
                    key={yeast.id}
                    onPress={() => {
                      dispatch({ type: "selectYeast", yeast });
                      setStrainQuery("");
                    }}
                    style={({ pressed }) => [styles.match, index > 0 && styles.matchDivider, pressed && styles.pressed]}
                  >
                    <Text style={styles.matchName}>{yeast.name}</Text>
                    <Text style={styles.matchBrand}>{yeast.brand}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </CalculatorField>
        </>
      )}
      <CalculatorField label={t("n2Requirement.label")}>
        <Chips
          label={t("n2Requirement.label")}
          onChange={(value) => dispatch({ type: "setNitrogenRequirement", value })}
          optionLabel={(option) => t(`n2Requirement.${NITROGEN_KEYS[option]}`)}
          options={NITROGEN}
          value={data.selected.nitrogenRequirement}
        />
      </CalculatorField>
    </>
  );
}

export function NutrientSelectionFields({ calc }: Props) {
  const { t, locale } = useFormat();
  const { colors, styles } = useStyles();
  const { data, dispatch, presetCatalog } = calc;
  return (
    <>
      {NUTRIENT_KEYS.map((key) => (
        <CalculatorSwitch
          key={key}
          label={key === "other" ? t("other.label") : t(`nutrients.${key}`)}
          onValueChange={() => dispatch({ type: "toggleNutrient", key })}
          value={data.selected.selectedNutrients[key]}
        />
      ))}
      {data.selected.selectedNutrients.other ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>{t("other.detailsHeading")}</Text>
          {presetCatalog.data && presetCatalog.data.data.length > 0 ? (
            <CalculatorField hint={t("other.nutrientPresetHelp")} label={t("mobileTools.nutrients.presets")}>
              <Chips
                label={t("mobileTools.nutrients.presets")}
                onChange={(name) => {
                  const preset = presetCatalog.data!.data.find((item) => item.name === name);
                  if (preset) dispatch({ type: "selectOtherNutrientPreset", preset });
                }}
                optionLabel={(name) => name}
                options={presetCatalog.data.data.map((preset) => preset.name)}
                value={data.settings.other.name || null}
              />
            </CalculatorField>
          ) : null}
          <CalculatorField label={t("mobileTools.nutrients.otherName")}>
            <TextInput
              accessibilityLabel={t("mobileTools.nutrients.otherName")}
              onChangeText={(value) => dispatch({ type: "setOtherNutrientName", value })}
              placeholder={t("other.label")}
              placeholderTextColor={colors.placeholder}
              style={styles.search}
              value={data.settings.other.name}
            />
          </CalculatorField>
          <CalculatorField label={`${t("other.yanContribution")} (${t("PPM")} / ${t("units.gpl")})`}>
            <DecimalInput
              label={t("other.yanContribution")}
              onChangeText={(value) => dispatch({ type: "setOtherYanContribution", value })}
              value={localizeDecimalText(locale, data.settings.yanContribution.other)}
            />
          </CalculatorField>
          <CalculatorSwitch
            label={t("other.organicMultiplier")}
            onValueChange={(value) => dispatch({ type: "setOtherUsesOrganicMultiplier", value })}
            value={data.settings.other.usesOrganicMultiplier}
          />
          <CalculatorNote>{t("other.organicMultiplierHelp")}</CalculatorNote>
        </View>
      ) : null}
      <CalculatorField label={t("numberOfAdditions")}>
        <DecimalInput
          label={t("numberOfAdditions")}
          onChangeText={(value) => dispatch({ type: "setNumberOfAdditions", value })}
          value={data.inputs.numberOfAdditions}
        />
      </CalculatorField>
    </>
  );
}

export function NutrientSettingsFields({ calc }: Props) {
  const { t, locale } = useFormat();
  const { styles } = useStyles();
  const { data, dispatch, derived, selectedKeys, nutrientName } = calc;
  return (
    <>
      {selectedKeys.map((key) => (
        <View key={key} style={styles.settingRow}>
          <Text style={styles.panelTitle}>{nutrientName(key)}</Text>
          <InputRow>
            <Grow>
              <CalculatorNote>{t("nuteResults.sideLabels.maxGpl")}</CalculatorNote>
              <DecimalInput
                label={`${nutrientName(key)}, ${t("nuteResults.sideLabels.maxGpl")}`}
                onChangeText={(value) => dispatch({ type: "setMaxGpl", key, value })}
                value={localizeDecimalText(locale, data.settings.maxGpl[key])}
              />
            </Grow>
            <Grow>
              <CalculatorNote>{t("other.yanContribution")}</CalculatorNote>
              <DecimalInput
                label={`${nutrientName(key)}, ${t("other.yanContribution")}`}
                onChangeText={(value) => dispatch({ type: "setYanContribution", key, value })}
                value={localizeDecimalText(locale, data.settings.yanContribution[key])}
              />
            </Grow>
          </InputRow>
          {data.adjustments.adjustAllowed ? (
            <CalculatorField label={`${t("other.settingsProvidedYan")} (${t("PPM")})`}>
              <DecimalInput
                label={`${nutrientName(key)}, ${t("other.settingsProvidedYan")}`}
                onChangeText={(value) => dispatch({ type: "setProvidedYanPpm", key, value })}
                value={localizeDecimalText(locale, data.adjustments.providedYanPpm[key])}
              />
            </CalculatorField>
          ) : (
            <CalculatorNote>
              {`${t("other.settingsProvidedYan")}: ${formatCalculatorResult(locale, derived.providedYanPpm[key], 0)} ${t("PPM")}`}
            </CalculatorNote>
          )}
        </View>
      ))}
      <CalculatorSwitch
        label={t("mobileTools.nutrients.adjustYan")}
        onValueChange={(value) => dispatch({ type: "setAdjustAllowed", value })}
        value={data.adjustments.adjustAllowed}
      />
      <CalculatorNote>{t("tipText.adjustYanValue")}</CalculatorNote>
    </>
  );
}

export function GoFermFields({ calc }: Props) {
  const { t, locale } = useFormat();
  const { styles } = useStyles();
  const { data, dispatch } = calc;
  return (
    <>
      <CalculatorField label={t("goFermType")}>
        <Chips
          label={t("goFermType")}
          onChange={(value) => dispatch({ type: "setGoFermType", value })}
          optionLabel={(option) => t(GO_FERM_KEYS[option])}
          options={GO_FERM}
          value={data.inputs.goFermType}
        />
      </CalculatorField>
      <CalculatorField label={`${t("yeastAmount")} (${t("units.g")})`}>
        <DecimalInput
          label={t("yeastAmount")}
          onChangeText={(value) => dispatch({ type: "setYeastAmountG", value })}
          value={localizeDecimalText(locale, data.inputs.yeastAmountG)}
        />
      </CalculatorField>
      {data.inputs.yeastAmountTouched ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => dispatch({ type: "resetYeastAmountAuto" })}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.panelTitle}>{t("tipText.yeastAmountAuto")}</Text>
        </Pressable>
      ) : (
        <CalculatorNote>
          {t("mobileTools.nutrients.yeastAuto", { amount: calculatorInputText(locale, parseNumber(data.inputs.yeastAmountG) || 0, 2) })}
        </CalculatorNote>
      )}
    </>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    search: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.body,
      minHeight: 48,
      paddingHorizontal: spacing.lg
    },
    matches: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, overflow: "hidden" },
    match: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", minHeight: 48, paddingHorizontal: spacing.lg },
    matchDivider: { borderTopColor: colors.border, borderTopWidth: 1 },
    matchName: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    matchBrand: { color: colors.textMuted, fontSize: typography.size.caption },
    panel: { borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
    panelTitle: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    settingRow: { gap: spacing.sm },
    button: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 52,
      paddingHorizontal: spacing.lg
    },
    pressed: { opacity: 0.7 }
  });
}
