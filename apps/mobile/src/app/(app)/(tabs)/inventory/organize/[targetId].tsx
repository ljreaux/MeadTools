import { randomUUID } from "expo-crypto";
import { Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Switch } from "react-native";
import { useTranslation } from "react-i18next";

import type { InventoryOrganizationResponse, UpdateInventoryStorageRequestBody } from "@meadtools/api-contract";
import { validateAllocationTotal } from "@meadtools/inventory-domain";

import { CalculatorField, CalculatorScreen, Chips, Segmented } from "@/components/calculator-ui";
import { CollectionGate, CollectionSave, useBottleLabel } from "@/inventory/collection-ui";
import { StockButton, StockCard, StockText, useStockStyles } from "@/inventory/stock-ui";
import { StorageEditor, StorageHistory } from "@/inventory/storage-editor";
import { useInventoryOrganization } from "@/inventory/use-collections";
import { useInventoryChange } from "@/inventory/use-inventory-change";
import { useStockOverview } from "@/inventory/use-stock";
import { useApiClient } from "@/providers/app-providers";

const modes = ["categories", "storage", "storageHistory"] as const;

export default function OrganizeStockScreen() {
  const { t, i18n } = useTranslation();
  const { targetId, kind, name } = useLocalSearchParams<{ targetId: string; kind?: "mead" | "stock"; name?: string }>();
  const api = useApiClient();
  const label = useBottleLabel();
  const overview = useInventoryOrganization();
  const stockOverview = useStockOverview();
  const { data } = overview;
  const allowed = data?.can_manage === true && !overview.isError;
  const targetKind = kind === "mead" ? "mead" : "stock";
  const [mode, setMode] = useState<(typeof modes)[number]>("categories");
  const [selection, setSelection] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const change = useInventoryChange("organization");
  const rows = data?.stock.filter((row) => targetKind === "mead" ? row.mead_id === targetId : row.id === targetId) ?? [];
  const row = rows.find(({ id }) => id === selection) ?? rows[0];
  const assigned = data?.assignments.find((entry) => entry.kind === targetKind && entry.id === targetId)?.label_ids ?? [];
  const count = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 });
  const unit = row ? t(`inventory.units.${row.quantity.unit}`) : "";
  const unlocated = row ? validateAllocationTotal(row.quantity, row.allocations.map(({ quantity }) => quantity)) : null;
  const stockCategory = stockOverview.data?.stock.find(({ id }) => id === targetId)?.category;

  function saveCategories(expected: string[] | null, next: string[]) {
    if (!allowed) return;
    const id = randomUUID();
    void change.save(expected
      ? () => api.updateInventoryOrganization({
          action: "assign_labels", kind: targetKind, id: targetId, operation_id: id, label_ids: next, expected_label_ids: expected
        })
      : null, () => setEditing(false), () => setEditing(false));
  }

  function saveStorage(input: UpdateInventoryStorageRequestBody | null) {
    if (!allowed || !row) return;
    void change.save(input ? () => api.updateInventoryStorage(row.id, input) : null,
      () => setEditing(false), () => setEditing(false));
  }

  function stopEditing() {
    change.clear();
    setEditing(false);
  }

  function openEditor() {
    change.clear();
    setEditing(true);
  }

  return (
    <CalculatorScreen>
      <Stack.Screen options={{ title: t("inventory.organization.organize") }} />
      <CollectionGate error={overview.isError} pending={overview.isPending} allowed={allowed} retry={() => void overview.refetch()}>
        {name ? <StockText kind="heading">{name}</StockText> : null}
        {!editing ? (
          <Segmented label={t("inventory.organization.organize")} options={modes} value={mode}
            onChange={(next) => { setMode(next); change.clear(); }}
            optionLabel={(option) => option === "storageHistory" ? t("inventory.history") : t(`inventory.organization.${option}`)} />
        ) : null}
        {!editing && change.error ? <StockText kind="error">{change.error}</StockText> : null}
        {mode !== "categories" && rows.length > 1 && !editing ? (
          <CalculatorField label={t("inventory.meads.bottleSize")}>
            <Chips label={t("inventory.meads.bottleSize")} options={rows.map(({ id }) => id)} value={row?.id ?? null}
              onChange={setSelection} optionLabel={(id) => {
                const size = rows.find((stock) => stock.id === id)!;
                return label({ size_liters: size.bottle_size_liters ?? 0, display_size: size.display_size });
              }} />
          </CalculatorField>
        ) : null}
        {mode === "categories" && data && editing ? (
          <CategoryAssignment expected={assigned} labels={data.labels} busy={change.busy} retryOnly={change.retryOnly}
            error={change.error} onSave={saveCategories} onCancel={stopEditing} />
        ) : null}
        {mode === "categories" && data && !editing ? (
          <StockCard>
            <StockText kind="heading">{t("inventory.organization.categories")}</StockText>
            {data.labels.filter(({ id }) => assigned.includes(id)).map(({ id, name: title }) => <StockText key={id}>{title}</StockText>)}
            {!assigned.length ? <StockText kind="muted">{t("mobileInventory.noCategories")}</StockText> : null}
            <StockButton label={t("mobileInventory.editCategories")} onPress={openEditor} disabled={overview.isFetching || !data.labels.length} />
            {!data.labels.length ? <StockText kind="muted">{t("inventory.organization.createCategoryHelp")}</StockText> : null}
          </StockCard>
        ) : null}
        {mode !== "categories" && !row ? <StockText kind="muted">{t("inventory.organization.noStock")}</StockText> : null}
        {mode === "storage" && row && !editing ? (
          <StockCard>
            <StockText>{t("inventory.organization.onHand", { amount: count.format(row.quantity.value), unit })}</StockText>
            {row.allocations.map((allocation) => (
              <StockText key={JSON.stringify([allocation.location_id, allocation.position])}>
                {data?.locations.find(({ id }) => id === allocation.location_id)?.path ?? t("inventory.organization.unavailableLocation")}
                {allocation.position ? ` · ${allocation.position}` : ""} · {count.format(allocation.quantity)} {unit}
              </StockText>
            ))}
            {unlocated !== null ? <StockText kind="muted">{t("inventory.organization.unlocatedAmount", { amount: count.format(unlocated), unit })}</StockText> : null}
            <StockButton label={t("mobileInventory.editStorage")} onPress={openEditor}
              disabled={overview.isFetching || (targetKind === "stock" && stockOverview.isPending)} />
          </StockCard>
        ) : null}
        {mode === "storage" && row && data && editing ? (
          <StorageEditor key={row.id} stock={row} locations={data.locations} wholeUnits={targetKind === "mead" || stockCategory === "packaging"}
            busy={change.busy} retryOnly={change.retryOnly} error={change.error} onSave={saveStorage} onCancel={stopEditing} />
        ) : null}
        {mode === "storageHistory" && row ? <StorageHistory stockId={row.id} /> : null}
      </CollectionGate>
    </CalculatorScreen>
  );
}

function CategoryAssignment({ labels, expected, busy, retryOnly, error, onSave, onCancel }: {
  labels: InventoryOrganizationResponse["labels"];
  expected: string[];
  busy: boolean;
  retryOnly: boolean;
  error: string | null;
  onSave: (expected: string[] | null, selected: string[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const styles = useStockStyles();
  const [reviewed] = useState(expected);
  const [selected, setSelected] = useState(reviewed);
  return (
    <StockCard>
      <StockText kind="muted">{t("inventory.organization.categoryHelp")}</StockText>
      {labels.map(({ id, name }) => {
        const checked = selected.includes(id);
        const disabled = busy || retryOnly || (!checked && selected.length >= 50);
        return (
          <Pressable key={id} accessibilityRole="switch" accessibilityLabel={name} accessibilityState={{ checked, disabled }}
            disabled={disabled} style={styles.row} onPress={() => setSelected((current) =>
              current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
            )}>
            <Switch accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
              pointerEvents="none" value={checked} disabled={disabled} />
            <StockText>{name}</StockText>
          </Pressable>
        );
      })}
      <CollectionSave busy={busy} retryOnly={retryOnly} error={error} label="inventory.organization.saveCategories"
        onSave={() => onSave(retryOnly ? null : reviewed, selected)} onCancel={onCancel} />
    </StockCard>
  );
}
