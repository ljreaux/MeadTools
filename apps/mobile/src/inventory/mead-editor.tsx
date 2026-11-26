import { randomUUID } from "expo-crypto";
import { useState } from "react";
import { Switch, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { CreateFinishedMeadRequestBody, FinishedMeadItem, InventoryStorageSource, UpdateFinishedMeadRequestBody } from "@meadtools/api-contract";
import { updateFinishedMeadRequestBodySchema } from "@meadtools/api-contract/inventory";
import { bottleDisplaySizeSchema } from "@meadtools/inventory-domain";

import { CalculatorField, Chips } from "@/components/calculator-ui";
import { parseDecimalInput } from "@/outbox/gravity-entry-form";

import { buildMeadReceipt, buildNewMead, type BottleDraft } from "./collection-draft";
import { CollectionSave, useBottleLabel } from "./collection-ui";
import { StorageSourceField } from "./storage-source-field";
import { StockButton, StockCard, StockInput, StockText, useStockStyles } from "./stock-ui";

export type MeadAction = "add" | "details" | "receipt" | "manual_use" | "correction";
export type MeadChange = CreateFinishedMeadRequestBody | UpdateFinishedMeadRequestBody;

function newBottle(): BottleDraft {
  return { key: randomUUID(), size: "750", unit: "mL", count: "" };
}

export function MeadEditor({ action, mead, busy, retryOnly, error, onSave, onCancel }: {
  action: MeadAction;
  mead?: FinishedMeadItem;
  busy: boolean;
  retryOnly: boolean;
  error: string | null;
  onSave: (input: MeadChange | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const label = useBottleLabel();
  const styles = useStockStyles();
  const [snapshot] = useState(mead);
  const [name, setName] = useState(snapshot?.name ?? "");
  const [notes, setNotes] = useState(action === "details" ? snapshot?.notes ?? "" : "");
  const [bottles, setBottles] = useState(() => [newBottle()]);
  const [bottleId, setBottleId] = useState(snapshot?.bottles[0]?.id ?? "");
  const [newSize, setNewSize] = useState(false);
  const [amount, setAmount] = useState(action === "correction" ? String(snapshot?.bottles[0]?.quantity ?? 0) : "");
  const [source, setSource] = useState<InventoryStorageSource>();
  const [invalid, setInvalid] = useState(false);
  const disabled = busy || retryOnly;
  const selected = snapshot?.bottles.find(({ id }) => id === bottleId);
  const showSizeDraft = action === "add" || (action === "receipt" && (newSize || !selected));
  const changeCount = action === "receipt" || action === "correction" || action === "manual_use";
  const countLabel = t(action === "correction" ? "inventory.meads.onHand" : "inventory.quantity");

  function submit() {
    if (retryOnly) { onSave(null); return; }
    const operationId = randomUUID();
    let input: MeadChange | null = null;
    if (action === "add") {
      input = buildNewMead(operationId, name, notes, bottles);
    } else if (snapshot && action === "receipt") {
      input = buildMeadReceipt(operationId, snapshot.revision, amount, notes, showSizeDraft ? bottles[0] : selected!);
    } else if (snapshot) {
      const parsed = updateFinishedMeadRequestBodySchema.safeParse({
        action,
        operation_id: operationId,
        expected_revision: snapshot.revision,
        ...(action === "details"
          ? { name, notes: notes.trim() || null }
          : { size_liters: selected?.size_liters, quantity: parseDecimalInput(amount), note: notes.trim() || null, ...(source === undefined ? {} : { storage_source: source }) })
      });
      if (parsed.success) input = parsed.data;
    }
    setInvalid(!input);
    if (input) onSave(input);
  }

  function patchBottle(key: string, patch: Partial<BottleDraft>) {
    setBottles((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }

  return (
    <StockCard>
      {action !== "add" ? <StockText kind="heading">{t(`inventory.meads.actions.${action}`)}</StockText> : null}
      {action === "add" || action === "details" ? (
        <CalculatorField label={t("inventory.name")}>
          <StockInput accessibilityLabel={t("inventory.name")} value={name} onChangeText={setName} maxLength={200} editable={!disabled} />
        </CalculatorField>
      ) : null}
      {action === "receipt" && Boolean(snapshot?.bottles.length) ? (
        <View style={styles.row}>
          <StockText>{t("mobileInventory.newBottleSize")}</StockText>
          <Switch accessibilityLabel={t("mobileInventory.newBottleSize")} value={newSize} onValueChange={setNewSize} disabled={disabled} />
        </View>
      ) : null}
      {changeCount && !showSizeDraft && snapshot?.bottles.length ? (
        <CalculatorField label={t("inventory.meads.bottleSize")}>
          <Chips label={t("inventory.meads.bottleSize")} options={snapshot.bottles.map(({ id }) => id)} value={bottleId}
            onChange={(id) => {
              if (disabled) return;
              setBottleId(id);
              setSource(undefined);
              if (action === "correction") setAmount(String(snapshot.bottles.find((row) => row.id === id)?.quantity ?? 0));
            }}
            optionLabel={(id) => {
              const bottle = snapshot.bottles.find((row) => row.id === id)!;
              return `${label(bottle)} · ${t("inventory.meads.remaining", { count: bottle.quantity })}`;
            }}
          />
        </CalculatorField>
      ) : null}
      {showSizeDraft ? bottles.map((row, index) => (
        <StockCard key={row.key}>
          <CalculatorField label={t("inventory.meads.capacity")}>
            <StockInput accessibilityLabel={t("inventory.meads.capacity")} value={row.size}
              onChangeText={(size) => patchBottle(row.key, { size })} inputMode="decimal" editable={!disabled} />
            <Chips label={t("inventory.meads.capacityUnit")} options={bottleDisplaySizeSchema.shape.unit.options}
              value={row.unit} onChange={(unit) => { if (!disabled) patchBottle(row.key, { unit }); }}
              optionLabel={(unit) => t(`inventory.units.${unit}`)} />
          </CalculatorField>
          {action === "add" ? (
            <CalculatorField label={t("inventory.meads.onHand")}>
              <StockInput accessibilityLabel={t("inventory.meads.onHand")} value={row.count}
                onChangeText={(count) => patchBottle(row.key, { count })} inputMode="numeric" editable={!disabled} />
            </CalculatorField>
          ) : null}
          {bottles.length > 1 ? <StockButton label={t("inventory.meads.removeSizeNamed", { index: index + 1 })}
            onPress={() => setBottles((current) => current.filter(({ key }) => key !== row.key))} disabled={disabled} /> : null}
        </StockCard>
      )) : null}
      {action === "add" ? <StockButton label={t("inventory.meads.addSize")} onPress={() => setBottles((current) => [...current, newBottle()])}
        disabled={disabled || bottles.length >= 50} /> : null}
      {changeCount ? (
        <CalculatorField label={countLabel} hint={t(action === "correction" ? "inventory.correctionHelp" : "inventory.meads.countHelp")}>
          <StockInput accessibilityLabel={countLabel} value={amount} onChangeText={setAmount} inputMode="numeric" editable={!disabled} />
        </CalculatorField>
      ) : null}
      {action === "manual_use" && selected ? <StorageSourceField stockId={selected.id} value={source} onChange={setSource} disabled={disabled} /> : null}
      <CalculatorField label={t("inventory.notes")}>
        <StockInput accessibilityLabel={t("inventory.notes")} value={notes} onChangeText={setNotes} maxLength={5000} editable={!disabled} multiline />
      </CalculatorField>
      <CollectionSave busy={busy} retryOnly={retryOnly}
        error={invalid ? t(action === "add" ? "inventory.meads.invalidCreate" : action === "details" ? "inventory.meads.invalidName" : "inventory.meads.invalid") : error}
        label="inventory.meads.save" onSave={submit} onCancel={onCancel} />
    </StockCard>
  );
}
