import { useQuery } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert } from "react-native";
import { useTranslation } from "react-i18next";

import type { UpdateBrewCostRequestBody, UpdateInventoryCostExclusionsRequestBody } from "@meadtools/api-contract";

import { CalculatorScreen, Segmented } from "@/components/calculator-ui";
import { CollectionGate, CollectionSave } from "@/inventory/collection-ui";
import { CostSummaryView } from "@/inventory/cost-summary-view";
import { StockButton, StockCard, StockText } from "@/inventory/stock-ui";
import { useCostExclusions } from "@/inventory/use-cost-exclusions";
import { useInventoryChange } from "@/inventory/use-inventory-change";
import { useApiClient, useSession } from "@/providers/app-providers";

const views = ["recorded", "planned"] as const;
const unchanged = () => undefined;

export default function CostSummaryScreen() {
  const { t } = useTranslation();
  const { brewId, recipeId, name } = useLocalSearchParams<{ brewId?: string; recipeId?: string; name?: string }>();
  const api = useApiClient();
  const router = useRouter();
  const { session } = useSession();
  const [view, setView] = useState<(typeof views)[number]>("recorded");
  const recipe = Number(recipeId);
  const validRecipe = Number.isInteger(recipe) && recipe > 0 && recipe <= 2_147_483_647 && !brewId;
  const brewQuery = useQuery({
    queryKey: ["brew-costs", session?.id, brewId],
    queryFn: () => api.getBrewCosts(brewId!),
    enabled: Boolean(session && brewId),
    refetchOnMount: "always"
  });
  const recipeQuery = useQuery({
    queryKey: ["recipe-costs", session?.id, recipe],
    queryFn: () => api.getRecipeCosts(recipe),
    enabled: Boolean(session && validRecipe),
    refetchOnMount: "always"
  });
  const query = brewId ? brewQuery : recipeQuery;
  const allowed = query.data?.can_manage === true && !query.isError;
  const exclusions = useCostExclusions(allowed);
  const change = useInventoryChange("costs");
  const busy = change.busy || change.retryOnly || query.isFetching;
  const brew = brewQuery.data;
  const planned = brew?.planned;
  const selected = view === "planned" && planned ? "planned" : "recorded";
  const summary = brewId ? selected === "recorded" ? brew?.recorded : planned : recipeQuery.data?.estimate;
  const title = t(brewId ? "inventoryCosts.brewTitle" : "inventoryCosts.recipeTitle");

  function exclude(input: UpdateInventoryCostExclusionsRequestBody) {
    if (allowed) void change.save(() => api.updateInventoryCostExclusions(input), unchanged, unchanged);
  }

  function updateBrew(input: UpdateBrewCostRequestBody) {
    if (allowed && brewId) void change.save(() => api.updateBrewCosts(brewId, input), unchanged, unchanged);
  }

  function recalculate() {
    Alert.alert(t("inventoryCosts.recalculateTitle"), t("inventoryCosts.recalculateDescription"), [
      { text: t("cancel"), style: "cancel" },
      { text: t("inventoryCosts.recalculate"), onPress: () => updateBrew({ action: "recalculate", operation_id: randomUUID() }) }
    ]);
  }

  return (
    <CalculatorScreen>
      <Stack.Screen options={{ title, headerBackButtonDisplayMode: "minimal" }} />
      {name ? <StockText kind="heading">{name}</StockText> : null}
      {query.isError || (!brewId && !validRecipe) ? (
        <StockCard>
          <StockText kind="error">{t("inventoryCosts.loadError")}</StockText>
          {brewId || validRecipe ? <StockButton label={t("equipment.retry")} onPress={() => void query.refetch()} /> : null}
        </StockCard>
      ) : (
        <CollectionGate error={false} pending={query.isPending} allowed={allowed} retry={() => void query.refetch()}>
          {planned ? (
            <Segmented label={title} options={views} value={selected} onChange={setView}
              optionLabel={(option) => t(`inventoryCosts.${option}`)} />
          ) : null}
          <StockText kind="muted">{t(brewId
            ? selected === "recorded" ? "inventoryCosts.recordedHelp" : "inventoryCosts.plannedHelp"
            : "inventoryCosts.recipeHelp")}</StockText>
          {change.retryOnly ? (
            <CollectionSave {...change} label="save" onSave={() => void change.save(null, unchanged, unchanged)} />
          ) : change.error ? <StockText kind="error">{change.error}</StockText> : null}
          {brewId && selected === "recorded" && Boolean(brew?.recorded.lines.length) ? (
            <StockButton label={t("inventoryCosts.recalculate")} onPress={recalculate} disabled={busy} />
          ) : null}
          {!brewId ? <StockButton label={t("inventoryCosts.refresh")} onPress={() => void recipeQuery.refetch()} disabled={busy} /> : null}
          {exclusions.isPending ? <ActivityIndicator /> : exclusions.isError ? (
            <StockButton label={t("mobileInventory.retryExclusions")} onPress={() => void exclusions.refetch()} disabled={busy} />
          ) : null}
          {summary ? (
            <CostSummaryView summary={summary} exclusions={exclusions.data?.exclusions ?? []} busy={busy}
              empty={t(brewId && selected === "recorded" ? "inventoryCosts.noRecordedUses" : "inventoryCosts.noRecipeLines")}
              onExclusion={exclude}
              onUse={brewId && selected === "recorded" ? (key, excluded) => updateBrew({ action: "exclude_use", key, excluded }) : undefined} />
          ) : null}
          <StockButton label={t("inventoryCosts.openInventory")} onPress={() => router.push("/inventory")} />
        </CollectionGate>
      )}
    </CalculatorScreen>
  );
}
