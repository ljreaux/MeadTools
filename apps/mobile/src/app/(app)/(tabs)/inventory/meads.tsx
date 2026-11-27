import { Stack, useFocusEffect, useRouter } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { FinishedMeadOverviewResponse } from "@meadtools/api-contract";
import { spacing, typography } from "@meadtools/design-tokens";
import { finishedMeadTotals } from "@meadtools/inventory-domain";

import { CalculatorScreen } from "@/components/calculator-ui";
import { useThemeColors } from "@/hooks/useThemeColors";
import { CollectionGate, useBottleLabel } from "@/inventory/collection-ui";
import { StockButton, StockCard, StockInput, StockText, useStockStyles } from "@/inventory/stock-ui";
import { useFinishedMeads } from "@/inventory/use-collections";

type Mead = FinishedMeadOverviewResponse["meads"][number];

export default function FinishedMeadsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { data, isError, isPending, refetch } = useFinishedMeads();
  // Only a pull shows the spinner; the refetch on focus stays in the background.
  const [pulling, setPulling] = useState(false);
  const pullToRefresh = () => {
    setPulling(true);
    void refetch().finally(() => setPulling(false));
  };
  const [search, setSearch] = useState("");
  useFocusEffect(useCallback(() => { void refetch({ cancelRefetch: false }); }, [refetch]));
  const filter = search.trim().toLocaleLowerCase(i18n.language);
  const meads = data?.meads;
  const matches = useMemo(
    () => meads?.filter(({ name }) => name.toLocaleLowerCase(i18n.language).includes(filter)) ?? [],
    [meads, filter, i18n.language]
  );
  const open = useCallback(
    (meadId: string) => router.push({ pathname: "/inventory/mead/[meadId]", params: { meadId } }),
    [router]
  );
  const renderItem = useCallback(({ item }: { item: Mead }) => <MeadRow mead={item} onPress={open} />, [open]);
  const title = <Stack.Screen options={{ title: t("inventory.meads.title") }} />;

  if (isError || isPending || data?.can_manage !== true) {
    return (
      <CalculatorScreen>
        {title}
        <CollectionGate error={isError} pending={isPending} allowed={data?.can_manage === true} retry={() => void refetch()}>
          {null}
        </CollectionGate>
      </CalculatorScreen>
    );
  }

  return (
    <>
      {title}
      <FlatList
        data={matches}
        keyExtractor={(mead) => mead.id}
        renderItem={renderItem}
        contentContainerStyle={listStyles.content}
        contentInsetAdjustmentBehavior="automatic"
        style={{ backgroundColor: colors.background }}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        refreshing={pulling}
        onRefresh={pullToRefresh}
        initialNumToRender={14}
        windowSize={9}
        ListHeaderComponent={
          <View style={listStyles.header}>
            <StockButton label={t("inventory.meads.add")} onPress={() => open("new")} primary />
            {meads?.length ? (
              <StockInput accessibilityLabel={t("inventory.meads.search")} placeholder={t("inventory.meads.search")}
                value={search} onChangeText={setSearch} autoCorrect={false} clearButtonMode="while-editing" />
            ) : (
              <StockCard>
                <StockText kind="heading">{t("inventory.meads.emptyTitle")}</StockText>
                <StockText>{t("inventory.meads.emptyDescription")}</StockText>
              </StockCard>
            )}
          </View>
        }
        ListEmptyComponent={filter && meads?.length ? <StockText kind="muted">{t("inventory.noMatches")}</StockText> : null}
      />
    </>
  );
}

/** A finished mead as a compact row: name and bottle count, then volume and sizes. */
const MeadRow = memo(function MeadRow({ mead, onPress }: { mead: Mead; onPress: (meadId: string) => void }) {
  const { t, i18n } = useTranslation();
  const styles = useStockStyles();
  const label = useBottleLabel();
  const total = finishedMeadTotals(mead.bottles);
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 });
  const detail = [
    t("inventory.meads.totalVolume", { volume: number.format(total.liters) }),
    ...mead.bottles.map((bottle) => `${label(bottle)} × ${number.format(bottle.quantity)}`)
  ].join(" · ");

  return (
    <Pressable accessibilityRole="button" onPress={() => onPress(mead.id)}
      style={({ pressed }) => [styles.card, listStyles.row, pressed && styles.dim]}>
      <View style={listStyles.top}>
        <Text numberOfLines={2} style={[styles.body, styles.heading, listStyles.name]}>{mead.name}</Text>
        <Text style={[styles.body, listStyles.count]}>{t("inventory.meads.bottleCount", { count: total.bottles })}</Text>
      </View>
      <Text numberOfLines={2} style={[styles.body, styles.muted, listStyles.detail]}>{detail}</Text>
    </Pressable>
  );
});

const listStyles = StyleSheet.create({
  content: { gap: spacing.sm, padding: spacing.lg },
  header: { gap: spacing.md, marginBottom: spacing.xs },
  row: { gap: spacing.xs, paddingVertical: spacing.md },
  top: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  name: { flex: 1 },
  count: { fontVariant: ["tabular-nums"], fontWeight: typography.weight.bold },
  detail: { fontSize: typography.size.caption }
});
