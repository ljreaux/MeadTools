import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { UpdateInventoryCostExclusionsRequestBody } from "@meadtools/api-contract";

import { CalculatorField, CalculatorScreen } from "@/components/calculator-ui";
import { CollectionGate, CollectionSave } from "@/inventory/collection-ui";
import { CurrencyPicker } from "@/inventory/price-fields";
import { StockButton, StockCard, StockInput, StockText, useStockStyles } from "@/inventory/stock-ui";
import { useCostExclusions } from "@/inventory/use-cost-exclusions";
import { useInventoryChange } from "@/inventory/use-inventory-change";
import { useStockOverview } from "@/inventory/use-stock";
import { useApiClient, useSession } from "@/providers/app-providers";

export default function InventoryCostsScreen() {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const { session } = useSession();
  const router = useRouter();
  const styles = useStockStyles();
  const overview = useStockOverview();
  const allowed = overview.data?.can_manage === true && !overview.isError;
  const exclusions = useCostExclusions(allowed);
  const change = useInventoryChange("costs");
  const [editingCurrency, setEditingCurrency] = useState(false);
  const [currency, setCurrency] = useState<string | null>(null);
  const [exclusionName, setExclusionName] = useState("");
  const [showRecipes, setShowRecipes] = useState(false);
  const [search, setSearch] = useState("");
  const current = overview.data?.currency ?? null;
  const recipes = useQuery({
    queryKey: ["recipes", session?.id],
    queryFn: () => api.listRecipes(),
    enabled: allowed && showRecipes && Boolean(session)
  });
  const needle = search.trim().toLocaleLowerCase(i18n.language);
  const matches = recipes.data?.filter((recipe) => (recipe.name || t("untitledRecipe")).toLocaleLowerCase(i18n.language).includes(needle));
  const disabled = change.busy || change.retryOnly;

  function save(request: (() => Promise<unknown>) | null, done: () => void) {
    if (allowed) void change.save(request, done, () => setEditingCurrency(false));
  }

  function changeExclusion(input: UpdateInventoryCostExclusionsRequestBody | null) {
    save(input ? () => api.updateInventoryCostExclusions(input) : null, () => setExclusionName(""));
  }

  return (
    <CalculatorScreen>
      <Stack.Screen options={{ title: t("mobileInventory.costs") }} />
      <CollectionGate error={overview.isError} pending={overview.isPending} allowed={allowed} retry={() => void overview.refetch()}>
        <StockCard>
          <StockText kind="heading">{t("inventoryCosts.currency")}</StockText>
          <StockText>{current ? t("inventoryCosts.currencyCurrent", { currency: current }) : t("inventoryCosts.currencyUnset")}</StockText>
          <StockText kind="muted">{t("inventoryCosts.currencyHelp")}</StockText>
          {editingCurrency ? (
            <>
              <CurrencyPicker value={currency} onChange={setCurrency} disabled={disabled} />
              <CollectionSave busy={change.busy} saveDisabled={!change.retryOnly && (!currency || currency === current)}
                retryOnly={change.retryOnly} error={change.error} label="save"
                onSave={() => save(change.retryOnly || !currency ? null : () => api.updateInventoryCurrency({ currency }), () => setEditingCurrency(false))}
                onCancel={() => { change.clear(); setEditingCurrency(false); }} />
            </>
          ) : (
            <StockButton label={t(current ? "inventoryCosts.currencyChange" : "inventoryCosts.currencyChoose")}
              disabled={disabled} onPress={() => { change.clear(); setCurrency(current); setEditingCurrency(true); }} />
          )}
        </StockCard>
        <StockCard>
          <StockText kind="heading">{t("inventoryCosts.excludedListLabel")}</StockText>
          <StockText kind="muted">{t("inventoryCosts.excludedListHelp")}</StockText>
          {exclusions.isPending ? <ActivityIndicator /> : exclusions.isError ? (
            <StockButton label={t("equipment.retry")} onPress={() => void exclusions.refetch()} />
          ) : exclusions.data?.exclusions.map(({ id, name }) => (
            <View style={styles.row} key={id}>
              <StockText>{name}</StockText>
              <StockButton label={t("inventoryCosts.includeNamed", { name })} disabled={disabled || editingCurrency}
                onPress={() => changeExclusion({ action: "include", id })} />
            </View>
          ))}
          <CalculatorField label={t("mobileInventory.exclusionName")}>
            <StockInput accessibilityLabel={t("mobileInventory.exclusionName")} value={exclusionName} onChangeText={setExclusionName}
              maxLength={200} editable={!disabled && !editingCurrency} />
          </CalculatorField>
          {change.retryOnly && !editingCurrency ? (
            <CollectionSave {...change} label="inventoryCosts.exclude" onSave={() => changeExclusion(null)} />
          ) : (
            <StockButton label={t("inventoryCosts.exclude")} disabled={disabled || editingCurrency || !exclusionName.trim()}
              onPress={() => changeExclusion({ action: "exclude", name: exclusionName.trim(), catalog_reference: null })} />
          )}
          {!editingCurrency && !change.retryOnly && change.error ? <StockText kind="error">{change.error}</StockText> : null}
        </StockCard>
        <StockCard>
          <StockButton label={t("mobileInventory.recipeEstimates")} onPress={() => setShowRecipes(!showRecipes)} />
          {showRecipes ? (
            <>
              {recipes.isPending ? <ActivityIndicator /> : recipes.isError ? <StockButton label={t("equipment.retry")} onPress={() => void recipes.refetch()} /> : (
                <>
                  <StockInput accessibilityLabel={t("mobileInventory.findRecipe")} placeholder={t("mobileInventory.findRecipe")}
                    value={search} onChangeText={setSearch} autoCorrect={false} />
                  {matches?.map((recipe) => <StockButton key={recipe.id} label={recipe.name || t("untitledRecipe")}
                    onPress={() => router.push({ pathname: "/cost-summary", params: { recipeId: String(recipe.id), name: recipe.name } })} />)}
                  {!matches?.length ? <StockText kind="muted">{t("mobileInventory.noRecipeEstimates")}</StockText> : null}
                </>
              )}
            </>
          ) : null}
        </StockCard>
      </CollectionGate>
    </CalculatorScreen>
  );
}
