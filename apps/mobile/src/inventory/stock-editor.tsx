import { randomUUID } from "expo-crypto";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";

import type { InventoryStockHistoryResponse } from "@meadtools/api-contract";
import { quantityUnitSchema, stockInputSchema } from "@meadtools/inventory-domain";

import { CalculatorField, Chips } from "@/components/calculator-ui";

import { StorageSourceField } from "./storage-source-field";
import { StockCatalogField } from "./stock-catalog-field";
import { buildStockCommand, type StockAction, type StockCommand, type StockDraft } from "./stock-draft";
import { StockButton, StockCard, StockInput, StockText, useStockStyles } from "./stock-ui";

const categories = stockInputSchema.shape.category.options;

export function StockEditor({
  action,
  review,
  busy,
  retryOnly,
  error,
  onCancel,
  onSave
}: {
  action: StockAction;
  review?: InventoryStockHistoryResponse;
  busy: boolean;
  retryOnly: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (command: StockCommand | null) => void;
}) {
  const { t, i18n } = useTranslation();
  const styles = useStockStyles();
  // Keep the balance and linked uses the user actually opened the form with.
  const [snapshot] = useState(review);
  const item = snapshot?.stock;
  const [draft, setDraft] = useState<StockDraft>({
    name: item?.name ?? "",
    category: item?.category ?? "honey",
    unit: item?.quantity.unit ?? "kg",
    amount: item && (action === "correction" || action === "reconcile")
      ? String(item.quantity.value)
      : "",
    notes: action === "details" ? item?.notes ?? "" : "",
    catalogReference: item?.catalogReference ?? null
  });
  const [invalid, setInvalid] = useState(false);
  const disabled = busy || retryOnly;
  const count = action === "correction" || action === "reconcile";
  const amountLabel = t(count ? "inventory.actualQuantity" : "inventory.quantity");
  const nameLabel = t("inventory.name");
  const notesLabel = t("inventory.notes");
  const format = (quantity: NonNullable<typeof item>["quantity"]) =>
    `${new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 }).format(quantity.value)} ${t(`inventory.units.${quantity.unit}`)}`;

  function submit() {
    const command = retryOnly ? null : buildStockCommand(action, draft, snapshot, randomUUID());
    setInvalid(!retryOnly && !command);
    if (retryOnly || command) onSave(command);
  }

  return (
    <StockCard>
      {action !== "add" && (
        <StockText kind="heading">
          {action === "reconcile" ? t("inventory.reconcile.title") : t(`inventory.actions.${action}`)}
        </StockText>
      )}
      {action === "add" || action === "details" ? (
        <CalculatorField label={nameLabel}>
          <StockInput
            accessibilityLabel={nameLabel}
            editable={!disabled}
            maxLength={200}
            onChangeText={(name) => setDraft({ ...draft, name })}
            value={draft.name}
          />
        </CalculatorField>
      ) : null}
      {action === "add" && (
        <CalculatorField label={t("inventory.category")}>
          <Chips
            label={t("inventory.category")}
            options={categories}
            optionLabel={(value) => t(`inventory.categories.${value}`)}
            onChange={(category) => {
              if (disabled || category === draft.category) return;
              setDraft({
                ...draft,
                category,
                unit: category === "packaging" ? "units" : draft.category === "packaging" ? "kg" : draft.unit,
                catalogReference: null
              });
            }}
            value={draft.category}
          />
        </CalculatorField>
      )}
      {(action === "add" || action === "details") && (
        <StockCatalogField
          category={draft.category}
          value={draft.catalogReference}
          onChange={(catalogReference) => setDraft({ ...draft, catalogReference })}
          disabled={disabled}
        />
      )}
      {action !== "details" && (
        <CalculatorField label={amountLabel} hint={
          action === "reconcile" ? t("inventory.reconcile.countHelp") :
          action === "correction" ? t("inventory.correctionHelp") :
          action === "add" ? undefined : t("inventory.changeHelp")
        }>
          <StockInput
            accessibilityLabel={amountLabel}
            editable={!disabled}
            onChangeText={(amount) => setDraft({ ...draft, amount })}
            inputMode={draft.category === "packaging" ? "numeric" : "decimal"}
            value={draft.amount}
          />
          {action === "add" && draft.category !== "packaging" ? (
            <Chips
              label={t("inventory.unit")}
              options={quantityUnitSchema.options}
              optionLabel={(value) => t(`inventory.units.${value}`)}
              onChange={(unit) => {
                if (!disabled) setDraft({ ...draft, unit });
              }}
              value={draft.unit}
            />
          ) : <StockText kind="muted">{t(`inventory.units.${draft.unit}`)}</StockText>}
        </CalculatorField>
      )}
      {action === "reconcile" && snapshot?.reconciliation ? (
        <StockCard>
          <StockText kind="heading">{t("inventory.reconcile.linksTitle")}</StockText>
          {snapshot.reconciliation.uses.length === 0 ? (
            <StockText>{t("inventory.reconcile.noLinks")}</StockText>
          ) : snapshot.reconciliation.uses.map((use) => (
            <View key={use.id}>
              <StockText>{use.name || t("inventory.reconcile.removedEntry")}</StockText>
              <StockText kind="muted">
                {use.current
                  ? t("inventory.reconcile.baseline", { previous: format(use.previous), current: format(use.current) })
                  : t("inventory.reconcile.unlink", { previous: format(use.previous) })}
              </StockText>
            </View>
          ))}
        </StockCard>
      ) : null}
      {action === "manual_use" && item ? (
        <StorageSourceField stockId={item.id} value={draft.storageSource} disabled={disabled}
          onChange={(storageSource) => setDraft({ ...draft, storageSource })} />
      ) : null}
      <CalculatorField label={notesLabel}>
        <StockInput
          accessibilityLabel={notesLabel}
          editable={!disabled}
          maxLength={5000}
          multiline
          onChangeText={(notes) => setDraft({ ...draft, notes })}
          value={draft.notes}
        />
      </CalculatorField>
      {action === "receipt" && item?.cost.unit_cost != null ? (
        <StockText>{t("inventoryCosts.unpricedReceiptWarning")}</StockText>
      ) : null}
      {invalid || error ? <StockText kind="error">{invalid ? t("inventory.invalid") : error}</StockText> : null}
      <View style={styles.row}>
        <StockButton
          label={retryOnly ? t("equipment.retry") : t(action === "reconcile" ? "inventory.reconcile.confirm" : "inventory.save")}
          onPress={submit}
          disabled={busy}
          primary
        />
        <StockButton label={t("cancel")} onPress={onCancel} disabled={busy} />
      </View>
    </StockCard>
  );
}
