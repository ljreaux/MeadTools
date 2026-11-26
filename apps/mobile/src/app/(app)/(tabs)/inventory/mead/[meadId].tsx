import { useQuery } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { useTranslation } from "react-i18next";

import { CalculatorScreen } from "@/components/calculator-ui";
import { CollectionGate, CollectionSave, useBottleLabel } from "@/inventory/collection-ui";
import { MeadEditor, type MeadAction, type MeadChange } from "@/inventory/mead-editor";
import { StockButton, StockCard, StockText, useStockStyles } from "@/inventory/stock-ui";
import { useFinishedMeads } from "@/inventory/use-collections";
import { useInventoryChange } from "@/inventory/use-inventory-change";
import { useApiClient, useSession } from "@/providers/app-providers";

const amountActions = ["receipt", "manual_use", "correction"] as const;

export default function FinishedMeadScreen() {
  const { t, i18n } = useTranslation();
  const { meadId } = useLocalSearchParams<{ meadId: string }>();
  const router = useRouter();
  const styles = useStockStyles();
  const label = useBottleLabel();
  const api = useApiClient();
  const { session } = useSession();
  const adding = meadId === "new";
  const overview = useFinishedMeads();
  const allowed = overview.data?.can_manage === true && !overview.isError;
  const history = useQuery({
    queryKey: ["finished-mead", session?.id, meadId],
    queryFn: () => api.getFinishedMead(meadId),
    enabled: allowed && !adding,
    refetchOnMount: "always"
  });
  const [action, setAction] = useState<MeadAction | null>(adding ? "add" : null);
  const change = useInventoryChange("meads");
  const mead = history.data?.mead;
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const delta = new Intl.NumberFormat(i18n.language, { signDisplay: "exceptZero" });

  function open(next: MeadAction) {
    change.clear();
    setAction(next);
  }

  function save(input: MeadChange | null) {
    if (!allowed) return;
    void change.save(input
      ? () => "mead" in input ? api.createFinishedMead(input) : api.updateFinishedMead(meadId, input)
      : null,
    () => { if (adding) router.back(); else setAction(null); },
    () => { if (!adding) setAction(null); });
  }

  function archive(retry = false) {
    if (!allowed || !mead) return;
    const perform = () => {
      const input = { action: "archive", expected_revision: mead.revision, operation_id: randomUUID() } as const;
      void change.save(retry ? null : () => api.updateFinishedMead(meadId, input), () => router.back(), () => setAction(null));
    };
    if (retry) { perform(); return; }
    Alert.alert(t("inventory.meads.archiveTitle"), t("inventory.meads.archiveDescription", { name: mead.name }), [
      { text: t("cancel"), style: "cancel" },
      { text: t("inventory.meads.archive"), style: "destructive", onPress: perform }
    ]);
  }

  return (
    <CalculatorScreen>
      <Stack.Screen options={{ title: adding ? t("inventory.meads.add") : mead?.name ?? t("inventory.meads.title") }} />
      <CollectionGate error={overview.isError || (allowed && !adding && history.isError)}
        pending={overview.isPending || (allowed && !adding && !history.isFetchedAfterMount)} allowed={allowed}
        retry={() => void (overview.isError ? overview.refetch() : history.refetch())}>
        {action ? (
          <MeadEditor key={action} action={action} mead={mead} busy={change.busy} retryOnly={change.retryOnly} error={change.error}
            onSave={save} onCancel={() => { change.clear(); if (adding) router.back(); else setAction(null); }} />
        ) : mead && history.data ? (
          <>
            <StockCard>
              <StockText kind="heading">{t("inventory.meads.onHand")}</StockText>
              {mead.bottles.map((bottle) => (
                <StockText key={bottle.id}>{label(bottle)} · {t("inventory.meads.remaining", { count: bottle.quantity })}</StockText>
              ))}
              {mead.notes ? <StockText kind="muted">{mead.notes}</StockText> : null}
            </StockCard>
            {change.retryOnly ? <CollectionSave {...change} label="inventory.meads.archive" onSave={() => archive(true)} /> : (
              <>
                {change.error ? <StockText kind="error">{change.error}</StockText> : null}
                <View style={styles.row}>
                  <StockButton label={t("inventory.meads.actions.details")} onPress={() => open("details")} disabled={history.isFetching || change.busy} />
                  {amountActions.map((next) => (
                    <StockButton key={next} label={t(`inventory.meads.actions.${next}`)} onPress={() => open(next)}
                      disabled={history.isFetching || change.busy || (next !== "receipt" && !mead.bottles.length)} />
                  ))}
                  <StockButton label={t("inventory.organization.organize")}
                    onPress={() => router.push({ pathname: "/inventory/organize/[targetId]", params: { targetId: mead.id, kind: "mead", name: mead.name } })}
                    disabled={change.busy} />
                  <StockButton label={t("inventory.meads.archive")} onPress={() => archive()} disabled={history.isFetching || change.busy} destructive />
                </View>
              </>
            )}
            <StockText kind="heading">{t("inventory.history")}</StockText>
            {!history.data.adjustments.length ? <StockText>{t("inventory.noHistory")}</StockText> : null}
            {history.data.adjustments.map((entry) => (
              <StockCard key={entry.id}>
                <StockText kind="heading">{t(`inventory.meads.kinds.${entry.kind}`, { defaultValue: t("inventory.stockChange") })}</StockText>
                <StockText>{label(entry)} · {t("inventory.meads.bottleDelta", { count: Math.abs(entry.delta), amount: delta.format(entry.delta) })}</StockText>
                <StockText kind="muted">{t("inventory.meads.balanceAfter", { count: entry.balance_after })}</StockText>
                <StockText kind="muted">{date.format(new Date(entry.created_at))}</StockText>
                {entry.source ? <StockText>{entry.source.name}</StockText> : null}
                {entry.note ? <StockText>{entry.note}</StockText> : null}
              </StockCard>
            ))}
            {history.data.has_more ? <StockText kind="muted">{t("inventory.recentHistory")}</StockText> : null}
          </>
        ) : null}
      </CollectionGate>
    </CalculatorScreen>
  );
}
