import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable } from "react-native";
import { useTranslation } from "react-i18next";

import { finishedMeadTotals } from "@meadtools/inventory-domain";

import { CalculatorScreen } from "@/components/calculator-ui";
import { CollectionGate, useBottleLabel } from "@/inventory/collection-ui";
import { StockButton, StockCard, StockInput, StockText, useStockStyles } from "@/inventory/stock-ui";
import { useFinishedMeads } from "@/inventory/use-collections";

export default function FinishedMeadsScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const styles = useStockStyles();
  const label = useBottleLabel();
  const { data, isError, isPending, refetch } = useFinishedMeads();
  const [search, setSearch] = useState("");
  useFocusEffect(useCallback(() => { void refetch({ cancelRefetch: false }); }, [refetch]));
  const filter = search.trim().toLocaleLowerCase(i18n.language);
  const matches = data?.meads.filter(({ name }) => name.toLocaleLowerCase(i18n.language).includes(filter));
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 });
  const open = (meadId: string) => router.push({ pathname: "/inventory/mead/[meadId]", params: { meadId } });

  return (
    <CalculatorScreen>
      <Stack.Screen options={{ title: t("inventory.meads.title") }} />
      <CollectionGate error={isError} pending={isPending} allowed={data?.can_manage === true} retry={() => void refetch()}>
        <StockButton label={t("inventory.meads.add")} onPress={() => open("new")} primary />
        {data?.meads.length ? (
          <StockInput accessibilityLabel={t("inventory.meads.search")} placeholder={t("inventory.meads.search")}
            value={search} onChangeText={setSearch} autoCorrect={false} />
        ) : (
          <StockCard>
            <StockText kind="heading">{t("inventory.meads.emptyTitle")}</StockText>
            <StockText>{t("inventory.meads.emptyDescription")}</StockText>
          </StockCard>
        )}
        {matches?.map((mead) => {
          const total = finishedMeadTotals(mead.bottles);
          return (
            <Pressable accessibilityRole="button" key={mead.id} onPress={() => open(mead.id)}
              style={({ pressed }) => [styles.card, pressed && styles.dim]}>
              <StockText kind="heading">{mead.name}</StockText>
              <StockText>{t("inventory.meads.bottleCount", { count: total.bottles })} · {t("inventory.meads.totalVolume", { volume: number.format(total.liters) })}</StockText>
              {mead.bottles.map((bottle) => (
                <StockText kind="muted" key={bottle.id}>{label(bottle)} · {t("inventory.meads.remaining", { count: bottle.quantity })}</StockText>
              ))}
            </Pressable>
          );
        })}
        {filter && matches?.length === 0 && Boolean(data?.meads.length) ? <StockText kind="muted">{t("inventory.noMatches")}</StockText> : null}
      </CollectionGate>
    </CalculatorScreen>
  );
}
