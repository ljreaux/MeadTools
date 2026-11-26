import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CalculatorScreen } from "@/components/calculator-ui";
import { StockButton, StockCard, StockInput, StockText, useStockStyles } from "@/inventory/stock-ui";
import { useStockOverview } from "@/inventory/use-stock";

export default function InventoryScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const styles = useStockStyles();
  const { data, error, isPending, refetch } = useStockOverview();
  const [search, setSearch] = useState("");

  useFocusEffect(useCallback(() => {
    void refetch({ cancelRefetch: false });
  }, [refetch]));

  const filter = search.trim().toLocaleLowerCase(i18n.language);
  const stock = data?.stock.filter((item) =>
    [item.name, t(`inventory.categories.${item.category}`)]
      .some((value) => value.toLocaleLowerCase(i18n.language).includes(filter))
  );
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 });

  return (
    <CalculatorScreen>
      {isPending ? <ActivityIndicator accessibilityLabel={t("inventory.loading")} /> : null}
      {error ? (
        <StockCard>
          <StockText kind="error">{t("inventory.loadError")}</StockText>
          <StockButton label={t("equipment.retry")} onPress={() => void refetch()} />
        </StockCard>
      ) : !isPending && !data?.can_manage ? (
        <StockCard>
          <StockText kind="heading">{t("inventory.access.title")}</StockText>
          <StockText>{t("mobileInventory.premium")}</StockText>
        </StockCard>
      ) : data?.can_manage ? (
        <>
          <View style={styles.row}>
            <StockButton label={t("inventory.meads.title")} onPress={() => router.push("/inventory/meads")} />
            <StockButton label={t("equipment.title")} onPress={() => router.push("/inventory/equipment")} />
            <StockButton label={t("inventory.organization.manage")} onPress={() => router.push("/inventory/organization")} />
          </View>
          <StockButton
            label={t("inventory.add")}
            onPress={() => router.push({ pathname: "/inventory/[stockId]", params: { stockId: "new" } })}
            primary
          />
          {data.stock.length ? (
            <StockInput
              accessibilityLabel={t("inventory.search")}
              autoCorrect={false}
              onChangeText={setSearch}
              placeholder={t("inventory.search")}
              value={search}
            />
          ) : (
            <StockCard>
              <StockText kind="heading">{t("inventory.emptyTitle")}</StockText>
              <StockText>{t("inventory.emptyDescription")}</StockText>
            </StockCard>
          )}
          {stock?.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              onPress={() => router.push({ pathname: "/inventory/[stockId]", params: { stockId: item.id } })}
              style={({ pressed }) => [styles.card, pressed && styles.dim]}
            >
              <StockText kind="heading">{item.name}</StockText>
              <StockText>
                {number.format(item.quantity.value)} {t(`inventory.units.${item.quantity.unit}`)}
              </StockText>
              <StockText kind="muted">{t(`inventory.categories.${item.category}`)}</StockText>
              {item.reconciliation_required ? (
                <StockText kind="error">{t("inventory.reconcile.title")}</StockText>
              ) : null}
            </Pressable>
          ))}
          {filter && stock?.length === 0 && data.stock.length > 0 ? (
            <StockText kind="muted">{t("inventory.noMatches")}</StockText>
          ) : null}
        </>
      ) : null}
    </CalculatorScreen>
  );
}
