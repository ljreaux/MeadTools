import { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { YeastResponse } from "@meadtools/api-contract";
import { filterAndSortYeasts, yeastTemperature, type YeastSortKey } from "@meadtools/core/yeasts";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useCatalog } from "@/catalogs/use-catalog";
import { Segmented } from "@/components/calculator-ui";
import { useThemeColors } from "@/hooks/useThemeColors";

const BRANDS = [
  { value: null, label: "mobileTools.yeasts.allBrands" },
  { value: "Lalvin", label: "YeastTable:brands.lalvin" },
  { value: "Fermentis", label: "YeastTable:brands.fermentis" },
  { value: "Mangrove Jack", label: "YeastTable:brands.mangrove" },
  { value: "Red Star", label: "YeastTable:brands.redstar" },
  { value: "Other", label: "YeastTable:brands.other" }
] as const;
const SORT_KEYS = ["name", "brand", "nitrogen_requirement", "tolerance", "low_temp", "high_temp"] as const satisfies readonly YeastSortKey[];
const NITROGEN_KEYS: Record<string, string> = {
  "Very Low": "veryLow",
  Low: "low",
  Medium: "medium",
  High: "high",
  "Very High": "veryHigh"
};
const SCALES = ["F", "C"] as const;
/** Rows shown at first and added by each "Show more", like the web table's pages. */
const PAGE_SIZE = 20;

export default function YeastTableScreen() {
  const { t } = useTranslation();
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const catalog = useCatalog("yeasts");
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: YeastSortKey; descending: boolean }>({ key: "name", descending: false });
  const [scale, setScale] = useState<(typeof SCALES)[number]>("F");
  // A new search, filter or sort starts again from the first page.
  const listKey = `${query}|${brand}|${sort.key}|${sort.descending}`;
  const [page, setPage] = useState({ key: listKey, count: PAGE_SIZE });
  const shownCount = page.key === listKey ? page.count : PAGE_SIZE;

  const yeasts = useMemo(
    () => (catalog.data ? filterAndSortYeasts(catalog.data.data, { query, brand, sort }) : []),
    [catalog.data, query, brand, sort]
  );
  const shown = yeasts.slice(0, shownCount);
  const remaining = yeasts.length - shown.length;
  const nitrogen = (value: string) =>
    NITROGEN_KEYS[value] ? t(`n2Requirement.${NITROGEN_KEYS[value]}`) : value;
  const unit = t(`units.${scale}`);

  const chip = (key: string, label: string, selected: boolean, onPress: () => void) => (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      key={key}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );

  const header = (
    <View style={styles.header}>
      <TextInput
        accessibilityLabel={t("YeastTable:searchAll")}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={setQuery}
        placeholder={t("YeastTable:searchAll")}
        placeholderTextColor={colors.placeholder}
        returnKeyType="search"
        style={styles.search}
        value={query}
      />
      <ScrollView
        accessibilityLabel={t("YeastTable:brandPlaceholder")}
        accessibilityRole="radiogroup"
        contentContainerStyle={styles.chips}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {BRANDS.map((option) => chip(option.label, t(option.label), brand === option.value, () => setBrand(option.value)))}
      </ScrollView>
      <ScrollView
        accessibilityLabel={t("mobileTools.yeasts.sortBy")}
        accessibilityRole="radiogroup"
        contentContainerStyle={styles.chips}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {SORT_KEYS.map((key) => {
          const selected = sort.key === key;
          const arrow = selected ? (sort.descending ? " ↓" : " ↑") : "";
          return chip(key, `${t(`YeastTable:tableHeadings.${key}`)}${arrow}`, selected, () =>
            setSort((current) => ({ key, descending: current.key === key ? !current.descending : false }))
          );
        })}
      </ScrollView>
      <Segmented label={t("YeastTable:units.title")} onChange={setScale} optionLabel={(option) => t(`units.${option}`)} options={SCALES} value={scale} />
      {catalog.data ? (
        <Text accessibilityLiveRegion="polite" style={styles.count}>
          {t("mobileTools.yeasts.count", { count: yeasts.length })}
        </Text>
      ) : null}
    </View>
  );

  const empty = catalog.isPending
    ? t("mobileTools.offline.loading")
    : !catalog.data
      ? t("mobileTools.offline.missing")
      : t("mobileTools.yeasts.noMatches");

  return (
    <FlatList<YeastResponse>
      ListEmptyComponent={<Text style={styles.empty}>{empty}</Text>}
      ListFooterComponent={
        remaining > 0 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setPage({ key: listKey, count: shownCount + PAGE_SIZE })}
            style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          >
            <Text style={styles.moreText}>{t("mobileTools.yeasts.showMore", { count: Math.min(PAGE_SIZE, remaining) })}</Text>
          </Pressable>
        ) : null
      }
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      data={shown}
      initialNumToRender={PAGE_SIZE}
      keyExtractor={(yeast) => String(yeast.id)}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => {
        const range = `${yeastTemperature(item.low_temp, scale)}–${yeastTemperature(item.high_temp, scale)} ${unit}`;
        const tolerance = t("mobileTools.yeasts.tolerance", { value: item.tolerance });
        const nitrogenText = `${t("n2Requirement.label")}: ${nitrogen(item.nitrogen_requirement)}`;
        return (
          <View accessible accessibilityLabel={[item.name, item.brand, nitrogenText, tolerance, range].join(", ")} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.brand}>{item.brand}</Text>
            </View>
            <Text style={styles.detail}>{nitrogenText}</Text>
            <Text style={styles.detail}>{`${tolerance} · ${range}`}</Text>
          </View>
        );
      }}
      style={styles.screen}
    />
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { gap: spacing.sm, padding: spacing.xl },
    header: { gap: spacing.md, paddingBottom: spacing.sm },
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
    chips: { gap: spacing.sm },
    chip: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.round,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: spacing.lg
    },
    chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.text, fontSize: typography.size.caption, fontWeight: typography.weight.bold },
    chipTextSelected: { color: colors.onAccent },
    count: { color: colors.textMuted, fontSize: typography.size.caption },
    empty: { color: colors.textMuted, fontSize: typography.size.body, paddingVertical: spacing.xl, textAlign: "center" },
    row: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.md
    },
    more: {
      alignItems: "center",
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      justifyContent: "center",
      marginTop: spacing.sm,
      minHeight: 48
    },
    moreText: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    pressed: { opacity: 0.7 },
    rowTop: { alignItems: "baseline", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
    name: { color: colors.text, flexShrink: 1, fontSize: typography.size.action, fontWeight: typography.weight.bold },
    brand: { color: colors.textMuted, fontSize: typography.size.caption },
    detail: { color: colors.textMuted, fontSize: typography.size.caption }
  });
}
