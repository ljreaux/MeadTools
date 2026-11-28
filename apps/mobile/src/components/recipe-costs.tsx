import { useQuery } from "@tanstack/react-query";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { InventoryCostSummary } from "@meadtools/api-contract/contracts";
import { VOLUME_TO_L } from "@meadtools/core/recipe";

import { useRecipeStyles } from "@/components/recipe-view";
import { useApiClient, useSession } from "@/providers/app-providers";

export function RecipeCosts({ recipeId }: { recipeId: number }) {
  const { t } = useTranslation();
  const { colors, styles } = useRecipeStyles();
  const api = useApiClient();
  const { session } = useSession();
  const costs = useQuery({
    queryKey: ["recipe-costs", session?.id, recipeId],
    queryFn: async () => {
      const { can_manage, estimate } = await api.getRecipeCosts(recipeId);
      return can_manage ? estimate : null;
    },
    staleTime: 0,
    gcTime: 0
  });

  const refresh = () => void costs.refetch();
  const title = t("inventoryCosts.recipeTitle");

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
      {costs.isPending ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel={title} />
      ) : costs.isError ? (
        <>
          <Text accessibilityRole="alert" style={styles.body}>{t("inventoryCosts.loadError")}</Text>
          <Pressable accessibilityRole="button" onPress={refresh} style={styles.action}>
            <Text style={[styles.heading, { color: colors.accent }]}>{t("PDF.retry")}</Text>
          </Pressable>
        </>
      ) : costs.data ? (
        <>
          <RecipeCostSummary summary={costs.data} />
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: costs.isFetching }}
            disabled={costs.isFetching}
            onPress={refresh}
            style={styles.action}
          >
            <Text style={[styles.heading, { color: costs.isFetching ? colors.textMuted : colors.accent }]}>
              {t("inventoryCosts.refresh")}
            </Text>
          </Pressable>
        </>
      ) : (
        <Text style={styles.muted}>{t("inventoryCosts.premiumHelp")}</Text>
      )}
    </View>
  );
}

function RecipeCostSummary({ summary }: { summary: InventoryCostSummary }) {
  const { t, i18n } = useTranslation();
  const { styles } = useRecipeStyles();

  if (!summary.lines.length) {
    return <Text style={styles.muted}>{t("inventoryCosts.noRecipeLines")}</Text>;
  }

  const locale = i18n.resolvedLanguage ?? i18n.language;
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  const currency = summary.totals.length === 1 ? summary.totals[0].currency : null;
  const status = summary.complete
    ? summary.totals.length ? "complete" : "allExcluded"
    : summary.mixed_currencies ? "mixedCurrencies" : "incomplete";

  return (
    <>
      <Text style={styles.muted}>{t("inventoryCosts.recipeHelp")}</Text>
      {summary.totals.length ? (
        summary.totals.map(({ amount, currency }) => (
          <Text key={currency} style={styles.title}>{money(amount, currency)}</Text>
        ))
      ) : (
        <Text style={styles.heading}>{t("inventoryCosts.noTotal")}</Text>
      )}
      <Text style={styles.body}>{t(`inventoryCosts.${status}`)}</Text>
      {currency && summary.per_liter !== null && summary.volume_liters !== null ? (
        <Text style={styles.muted}>
          {t("inventoryCosts.perVolume", {
            perLiter: money(summary.per_liter, currency),
            perGallon: money(summary.per_liter * VOLUME_TO_L.gal, currency),
            liters: new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(summary.volume_liters)
          })}
        </Text>
      ) : null}
    </>
  );
}
