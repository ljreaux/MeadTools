import { useQuery, useQueryClient } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";

import { CalculatorScreen } from "@/components/calculator-ui";
import { StockPriceHistory, useStockCostLabel } from "@/inventory/stock-costs";
import type { StockAction, StockCommand } from "@/inventory/stock-draft";
import { StockEditor } from "@/inventory/stock-editor";
import { StockButton, StockCard, StockHistoryRow, StockText, useStockStyles } from "@/inventory/stock-ui";
import { useStockOverview } from "@/inventory/use-stock";
import { useApiClient, useSession } from "@/providers/app-providers";

const adjustmentActions = ["receipt", "manual_use", "correction"] as const;
const reloadCodes = new Set([
  "NOT_FOUND", "OPERATION_CONFLICT", "PREMIUM_REQUIRED",
  "RECONCILIATION_REQUIRED", "STALE_STOCK", "STOCK_ARCHIVED"
]);

export default function InventoryStockScreen() {
  const { stockId } = useLocalSearchParams<{ stockId: string }>();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const styles = useStockStyles();
  const { session } = useSession();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const overview = useStockOverview();
  const costLabel = useStockCostLabel();
  const adding = stockId === "new";
  const allowed = overview.data?.can_manage === true && !overview.isError;
  const history = useQuery({
    queryKey: ["inventory-stock", session?.id, stockId],
    queryFn: () => api.getInventoryStock(stockId),
    enabled: allowed && !adding,
    refetchOnMount: "always"
  });
  const [action, setAction] = useState<StockAction | null>(adding ? "add" : null);
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [retryOnly, setRetryOnly] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attempt = useRef<StockCommand | null>(null);

  const item = history.data?.stock;
  const units = item ? t(`inventory.units.${item.quantity.unit}`) : "";
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 });
  const delta = new Intl.NumberFormat(i18n.language, { signDisplay: "exceptZero", maximumFractionDigits: 6 });
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });

  function refreshInventory() {
    void Promise.all(["inventory", "inventory-stock", "inventory-organization", "brew-costs", "recipe-costs"].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key, session?.id] })));
  }

  async function save(command: StockCommand | null) {
    if (!allowed || submitting.current) return;
    const pending = attempt.current ?? command;
    if (!pending) return;
    attempt.current = pending;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      if (pending.kind === "create") await api.createInventoryStock(pending.input);
      else await api.updateInventoryStock(pending.stockId, pending.input);

      attempt.current = null;
      setRetryOnly(false);
      refreshInventory();
      if (pending.kind === "create" || pending.input.action === "archive") router.back();
      else setAction(null);
    } catch (failure) {
      if (failure instanceof MeadToolsApiError && failure.status >= 400 && failure.status < 500) {
        const body = failure.body;
        const code = body && typeof body === "object" && "code" in body && typeof body.code === "string"
          ? body.code : "";
        attempt.current = null;
        setRetryOnly(false);
        if (reloadCodes.has(code)) {
          if (!adding) setAction(null);
          refreshInventory();
        }
        if (code === "CURRENCY_REQUIRED" || code === "CURRENCY_MISMATCH") void overview.refetch();
        setError(t(`inventory.errors.${code}`, { defaultValue: t("inventory.saveError") }));
      } else {
        setRetryOnly(true);
        setError(t("mobileInventory.retrySame"));
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function openEditor(next: StockAction) {
    setError(null);
    setAction(next);
  }

  function closeEditor() {
    attempt.current = null;
    setRetryOnly(false);
    setError(null);
    if (adding) router.back();
    else setAction(null);
  }

  function confirmArchive() {
    if (!item) return;
    Alert.alert(t("inventory.removeTitle"), t("inventory.removeDescription", { name: item.name }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("mobileInventory.archive"),
        style: "destructive",
        onPress: () => void save({
          kind: "update",
          stockId: item.id,
          input: { action: "archive", operation_id: randomUUID() }
        })
      }
    ]);
  }

  const waiting = overview.isPending || (allowed && !adding && !history.isFetchedAfterMount);
  const loadFailed = overview.isError || (allowed && !adding && history.isError);
  return (
    <CalculatorScreen>
      <Stack.Screen options={{ title: adding ? t("inventory.add") : item?.name ?? t("inventory.title") }} />
      {loadFailed ? (
        <StockCard>
          <StockText kind="error">{t("inventory.loadError")}</StockText>
          <StockButton
            label={t("equipment.retry")}
            onPress={() => void (overview.isError ? overview.refetch() : history.refetch())}
          />
        </StockCard>
      ) : waiting ? (
        <ActivityIndicator accessibilityLabel={t("inventory.loading")} />
      ) : !allowed ? (
        <StockCard>
          <StockText kind="heading">{t("inventory.access.title")}</StockText>
          <StockText>{t("mobileInventory.premium")}</StockText>
        </StockCard>
      ) : action ? (
        <StockEditor
          key={action}
          action={action}
          review={history.data}
          currency={overview.data?.currency ?? null}
          busy={busy}
          retryOnly={retryOnly}
          error={error}
          onCancel={closeEditor}
          onSave={(command) => void save(command)}
        />
      ) : item && history.data ? (
        <>
          <StockCard>
            <StockText kind="heading">{t("inventory.actualQuantity")}</StockText>
            <StockText>{number.format(item.quantity.value)} {units}</StockText>
            <StockText kind="muted">{t(`inventory.categories.${item.category}`)}</StockText>
            <StockText>{costLabel(item)}</StockText>
            {item.notes ? <StockText>{item.notes}</StockText> : null}
            {item.reconciliation_required ? <StockText kind="error">{t("inventory.needsReview")}</StockText> : null}
          </StockCard>
          {error ? <StockText kind="error">{error}</StockText> : null}
          {retryOnly ? (
            <StockButton label={t("equipment.retry")} onPress={() => void save(null)} disabled={busy} primary />
          ) : (
            <View style={styles.row}>
              <StockButton grow label={t("inventory.actions.details")} onPress={() => openEditor("details")} disabled={busy || history.isFetching} />
              {item.reconciliation_required ? (
                <StockButton grow
                  label={t("inventory.reconcile.title")}
                  onPress={() => openEditor("reconcile")}
                  disabled={busy || history.isFetching || !history.data.reconciliation}
                  primary
                />
              ) : adjustmentActions.map((change) => (
                <StockButton grow
                  key={change}
                  label={t(`inventory.actions.${change}`)}
                  onPress={() => openEditor(change)}
                  disabled={busy || history.isFetching}
                />
              ))}
              <StockButton grow label={t("inventory.actions.set_unit_cost")} onPress={() => openEditor("set_unit_cost")}
                disabled={busy || history.isFetching} />
              <StockButton grow label={t("inventory.organization.organize")}
                onPress={() => router.push({ pathname: "/inventory/organize/[targetId]", params: { targetId: item.id, kind: "stock", name: item.name } })}
                disabled={busy} />
              <StockButton grow label={t("mobileInventory.archive")} onPress={confirmArchive} disabled={busy || history.isFetching} destructive />
            </View>
          )}
          <StockText kind="heading">{t("inventory.history")}</StockText>
          {history.data.adjustments.length === 0 ? <StockText>{t("inventory.noHistory")}</StockText> : null}
          {history.data.adjustments.length ? (
            <StockCard>
              {history.data.adjustments.map((change, index) => {
                const balance = change.balance_after;
                const balanceUnit = t(`inventory.units.${balance.unit}`);
                return (
                  <StockHistoryRow
                    key={change.id}
                    first={index === 0}
                    title={t(`inventory.kinds.${change.kind}`, { defaultValue: t("inventory.stockChange") })}
                    value={`${delta.format(change.delta)} ${balanceUnit}`}
                    details={[
                      t("mobileInventory.afterChange", { value: number.format(balance.value), unit: balanceUnit }),
                      date.format(new Date(change.created_at))
                    ]}
                    note={change.note}
                  />
                );
              })}
            </StockCard>
          ) : null}
          {history.data.has_more ? <StockText kind="muted">{t("inventory.recentHistory")}</StockText> : null}
          <StockPriceHistory history={history.data} />
        </>
      ) : null}
    </CalculatorScreen>
  );
}
