import { useFocusEffect, useRouter } from "expo-router";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { InventoryStockItem } from "@meadtools/api-contract";
import { radii, spacing, typography } from "@meadtools/design-tokens";
import { stockInputSchema } from "@meadtools/inventory-domain";

import { Chips } from "@/components/calculator-ui";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useStockCostLabel } from "@/inventory/stock-costs";
import { queryStockList, stockFilterOptions, type StockFilter } from "@/inventory/stock-list";
import { StockButton, StockCard, StockInput, StockText, useStockStyles } from "@/inventory/stock-ui";
import { useStockOverview } from "@/inventory/use-stock";

const categories = stockInputSchema.shape.category.options;
/** The pinned search and filter bar, kept in the list so it can stick. */
const CONTROLS = "controls" as const;
type Row = typeof CONTROLS | InventoryStockItem;

export default function InventoryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const styles = useStockStyles();
  const { data, error, isPending, refetch } = useStockOverview();
  // Only a pull shows the spinner; the refetch on focus stays in the background.
  const [pulling, setPulling] = useState(false);
  const pullToRefresh = () => {
    setPulling(true);
    void refetch().finally(() => setPulling(false));
  };
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StockFilter>("all");
  const listRef = useRef<FlatList<Row>>(null);

  useFocusEffect(useCallback(() => {
    void refetch({ cancelRefetch: false });
  }, [refetch]));

  const stock = data?.stock;
  const categoryLabel = useCallback(
    (category: InventoryStockItem["category"]) => t(`inventory.categories.${category}`),
    [t]
  );
  const filters = useMemo(() => stockFilterOptions(stock ?? [], categories), [stock]);
  // A filter can disappear when its last item is archived or reviewed.
  const activeFilter = filters.includes(filter) ? filter : "all";
  const matches = useMemo(
    () => queryStockList(stock ?? [], { search, filter: activeFilter, locale: i18n.language, categoryLabel }),
    [stock, search, activeFilter, i18n.language, categoryLabel]
  );
  const rows = useMemo<Row[]>(() => (stock?.length ? [CONTROLS, ...matches] : []), [stock, matches]);
  const total = stock?.length ?? 0;
  const narrowed = search.trim() !== "" || activeFilter !== "all";

  // New results start at the top instead of wherever a long list was scrolled.
  const changeQuery = (update: () => void) => {
    update();
    listRef.current?.scrollToIndex({ index: 0, animated: false, viewPosition: 0 });
  };
  const openStock = useCallback(
    (stockId: string) => router.push({ pathname: "/inventory/[stockId]", params: { stockId } }),
    [router]
  );
  const renderItem = useCallback(({ item }: { item: Row }) => item === CONTROLS ? (
    <View style={[listStyles.controls, { backgroundColor: colors.background }]}>
      <StockInput
        accessibilityLabel={t("inventory.search")}
        autoCorrect={false}
        clearButtonMode="while-editing"
        onChangeText={setSearch}
        placeholder={t("inventory.search")}
        returnKeyType="search"
        value={search}
      />
      <Chips<StockFilter>
        label={t("mobileInventory.filter")}
        onChange={(value) => changeQuery(() => setFilter(value))}
        optionLabel={(option) => option === "all"
          ? t("mobileInventory.filterAll")
          : option === "review" ? t("inventory.reconcile.title") : categoryLabel(option)}
        options={filters}
        value={activeFilter}
      />
      <Text accessibilityLiveRegion="polite" style={[styles.body, styles.muted, listStyles.count]}>
        {narrowed
          ? t("mobileInventory.stockShown", { shown: matches.length, total })
          : t("mobileInventory.stockCount", { count: total })}
      </Text>
    </View>
  ) : (
    <StockRow item={item} onPress={openStock} />
  ), [colors.background, t, search, filters, activeFilter, categoryLabel, styles, narrowed, matches.length, total, openStock]);

  if (error || isPending || !data?.can_manage) {
    return (
      <ScrollView contentContainerStyle={listStyles.content} contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}>
        {isPending ? <ActivityIndicator accessibilityLabel={t("inventory.loading")} /> : error ? (
          <StockCard>
            <StockText kind="error">{t("inventory.loadError")}</StockText>
            <StockButton label={t("equipment.retry")} onPress={() => void refetch()} />
          </StockCard>
        ) : (
          <StockCard>
            <StockText kind="heading">{t("inventory.access.title")}</StockText>
            <StockText>{t("mobileInventory.premium")}</StockText>
          </StockCard>
        )}
      </ScrollView>
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={rows}
      keyExtractor={(row) => row === CONTROLS ? CONTROLS : row.id}
      renderItem={renderItem}
      // Index 0 is the header, so the search and filter bar at index 1 stays pinned.
      stickyHeaderIndices={rows.length ? [1] : undefined}
      contentContainerStyle={listStyles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={{ backgroundColor: colors.background }}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      refreshing={pulling}
      onRefresh={pullToRefresh}
      onScrollToIndexFailed={() => listRef.current?.scrollToOffset({ offset: 0, animated: false })}
      initialNumToRender={14}
      windowSize={9}
      ListHeaderComponent={
        <View style={listStyles.header}>
          <View style={listStyles.links}>
            {([
              ["inventory.meads.title", "/inventory/meads"],
              ["equipment.title", "/inventory/equipment"],
              ["inventory.organization.manage", "/inventory/organization"],
              ["mobileInventory.costs", "/inventory/costs"]
            ] as const).map(([label, href]) => (
              <View key={href} style={listStyles.link}>
                <StockButton label={t(label)} onPress={() => router.push(href)} />
              </View>
            ))}
          </View>
          <StockText kind="muted">{data.currency
            ? t("inventoryCosts.currencyCurrent", { currency: data.currency })
            : t("inventoryCosts.currencyUnset")}</StockText>
          <StockButton
            label={t("inventory.add")}
            onPress={() => router.push({ pathname: "/inventory/[stockId]", params: { stockId: "new" } })}
            primary
          />
          {total === 0 ? (
            <StockCard>
              <StockText kind="heading">{t("inventory.emptyTitle")}</StockText>
              <StockText>{t("inventory.emptyDescription")}</StockText>
            </StockCard>
          ) : null}
        </View>
      }
      ListFooterComponent={total > 0 && matches.length === 0 ? (
        <StockCard>
          <StockText>{t("inventory.noMatches")}</StockText>
          <StockButton label={t("mobileInventory.clearFilters")}
            onPress={() => changeQuery(() => { setSearch(""); setFilter("all"); })} />
        </StockCard>
      ) : null}
    />
  );
}

/**
 * One stock item as a compact row: name and amount on top, category and price
 * below, so a long list shows many items per screen.
 */
const StockRow = memo(function StockRow({ item, onPress }: {
  item: InventoryStockItem;
  onPress: (stockId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useThemeColors();
  const styles = useStockStyles();
  const costLabel = useStockCostLabel();
  const amount = `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 }).format(item.quantity.value)} ${
    t(`inventory.units.${item.quantity.unit}`)}`;
  const detail = [
    t(`inventory.categories.${item.category}`),
    item.cost.unit_cost !== null ? costLabel(item) : null
  ].filter(Boolean).join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[item.name, amount, detail, item.reconciliation_required ? t("inventory.reconcile.title") : ""]
        .filter(Boolean).join(", ")}
      onPress={() => onPress(item.id)}
      style={({ pressed }) => [styles.card, listStyles.row, pressed && styles.dim]}
    >
      <View style={listStyles.rowTop}>
        <Text numberOfLines={2} style={[styles.body, styles.heading, listStyles.name]}>{item.name}</Text>
        <Text style={[styles.body, listStyles.amount]}>{amount}</Text>
      </View>
      <View style={listStyles.rowTop}>
        <Text numberOfLines={1} style={[styles.body, styles.muted, listStyles.detail]}>{detail}</Text>
        {item.reconciliation_required ? (
          <Text style={[listStyles.pill, { borderColor: colors.error, color: colors.error }]}>
            {t("inventory.reconcile.title")}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

const listStyles = StyleSheet.create({
  content: { gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.lg },
  header: { gap: spacing.md, marginBottom: spacing.xs },
  links: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  link: { flexBasis: "45%", flexGrow: 1 },
  controls: { gap: spacing.xs, paddingBottom: spacing.xs, paddingTop: spacing.xs },
  count: { fontSize: typography.size.caption },
  row: { gap: spacing.xs, paddingVertical: spacing.md },
  rowTop: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  name: { flex: 1 },
  amount: { fontVariant: ["tabular-nums"], fontWeight: typography.weight.bold },
  detail: { flex: 1, fontSize: typography.size.caption },
  pill: {
    borderRadius: radii.round,
    borderWidth: 1,
    fontSize: typography.size.caption,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2
  }
});
