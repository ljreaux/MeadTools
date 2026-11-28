import { useQuery } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useState } from "react";
import { ActivityIndicator } from "react-native";
import { useTranslation } from "react-i18next";

import type { InventoryLocation, InventoryOrganizedStock, UpdateInventoryStorageRequestBody } from "@meadtools/api-contract";

import { CalculatorField, Chips } from "@/components/calculator-ui";
import { useApiClient, useSession } from "@/providers/app-providers";

import { buildStorageChange, type AllocationDraft } from "./collection-draft";
import { CollectionSave } from "./collection-ui";
import { StockButton, StockCard, StockInput, StockText } from "./stock-ui";

export function StorageEditor({ stock, locations, wholeUnits, busy, retryOnly, error, onSave, onCancel }: {
  stock: InventoryOrganizedStock;
  locations: InventoryLocation[];
  wholeUnits: boolean;
  busy: boolean;
  retryOnly: boolean;
  error: string | null;
  onSave: (input: UpdateInventoryStorageRequestBody | null) => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [snapshot] = useState(stock);
  const [rows, setRows] = useState<AllocationDraft[]>(() => snapshot.allocations.map((allocation) => ({
    key: randomUUID(), locationId: allocation.location_id, position: allocation.position, amount: String(allocation.quantity)
  })));
  const [invalid, setInvalid] = useState(false);
  const disabled = busy || retryOnly;
  const [operationId] = useState(randomUUID);
  const valid = buildStorageChange(snapshot, rows, operationId, wholeUnits);
  const unit = t(`inventory.units.${snapshot.quantity.unit}`);
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 });

  function patch(key: string, change: Partial<AllocationDraft>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...change } : row));
  }

  function submit() {
    if (retryOnly) { onSave(null); return; }
    setInvalid(!valid);
    if (valid) onSave(valid.input);
  }

  return (
    <StockCard>
      <StockText>{t("inventory.organization.onHand", { amount: number.format(snapshot.quantity.value), unit })}</StockText>
      {valid ? <StockText kind="muted">{t("inventory.organization.unlocatedAmount", { amount: number.format(valid.unlocated), unit })}</StockText> : null}
      {!locations.length ? <StockText kind="muted">{t("inventory.organization.createLocationHelp")}</StockText> : null}
      {rows.map((row, index) => (
        <StockCard key={row.key}>
          <StockText kind="heading">{t("inventory.organization.positionNumber", { count: index + 1 })}</StockText>
          <CalculatorField label={t("inventory.organization.location")}>
            <Chips label={t("inventory.organization.location")} options={locations.map(({ id }) => id)} value={row.locationId}
              onChange={(locationId) => { if (!disabled) patch(row.key, { locationId }); }}
              optionLabel={(id) => locations.find((item) => item.id === id)!.path} />
          </CalculatorField>
          <CalculatorField label={t("inventory.organization.position")}>
            <StockInput accessibilityLabel={t("inventory.organization.position")} value={row.position} maxLength={200}
              onChangeText={(position) => patch(row.key, { position })} editable={!disabled} />
          </CalculatorField>
          <CalculatorField label={t("inventory.quantity")} hint={unit}>
            <StockInput accessibilityLabel={t("inventory.quantity")} value={row.amount}
              onChangeText={(amount) => patch(row.key, { amount })} inputMode={wholeUnits ? "numeric" : "decimal"} editable={!disabled} />
          </CalculatorField>
          <StockButton label={t("inventory.organization.removePosition")} onPress={() => setRows((current) => current.filter(({ key }) => key !== row.key))} disabled={disabled} />
        </StockCard>
      ))}
      <StockButton label={t("inventory.organization.addPosition")} disabled={disabled || !locations.length || rows.length >= 100}
        onPress={() => setRows((current) => [...current, { key: randomUUID(), locationId: locations[0].id, position: "", amount: "" }])} />
      <CollectionSave busy={busy} retryOnly={retryOnly} error={invalid && !valid ? t("inventory.organization.invalidAllocations") : error}
        label="inventory.organization.saveStorage" onSave={submit} onCancel={onCancel} />
    </StockCard>
  );
}

export function StorageHistory({ stockId }: { stockId: string }) {
  const { t, i18n } = useTranslation();
  const { session } = useSession();
  const api = useApiClient();
  const { isPending, isError, data, refetch } = useQuery({
    queryKey: ["inventory-storage", session?.id, stockId],
    queryFn: () => api.getInventoryStorageHistory(stockId)
  });
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" });
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 });
  if (isPending) return <ActivityIndicator accessibilityLabel={t("inventory.loading")} />;
  if (isError || !data) return (
    <StockCard>
      <StockText kind="error">{t("inventory.loadError")}</StockText>
      <StockButton label={t("equipment.retry")} onPress={() => void refetch()} />
    </StockCard>
  );
  return (
    <>
      {!data.changes.length ? <StockText kind="muted">{t("inventory.organization.noMovements")}</StockText> : null}
      {data.changes.map((change) => (
        <StockCard key={change.id}>
          <StockText kind="heading">{change.location_path}{change.position ? ` · ${change.position}` : ""}</StockText>
          <StockText>{t(change.reason === "move" ? "inventory.organization.moved" : "inventory.organization.balanceChange")}</StockText>
          <StockText>{number.format(change.delta)} {t(`inventory.units.${change.unit}`)}</StockText>
          <StockText kind="muted">{t("inventory.balanceAfter", { value: number.format(change.balance_after), unit: t(`inventory.units.${change.unit}`) })}</StockText>
          <StockText kind="muted">{date.format(new Date(change.created_at))}</StockText>
        </StockCard>
      ))}
      {data.has_more ? <StockText kind="muted">{t("inventory.recentHistory")}</StockText> : null}
    </>
  );
}
