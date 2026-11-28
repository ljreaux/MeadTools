import { randomUUID } from "expo-crypto";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { CreateEquipmentRequestBody, EquipmentItem } from "@meadtools/api-contract";
import { capacityUnitSchema } from "@meadtools/inventory-domain";

import { CalculatorField, Chips, Segmented } from "@/components/calculator-ui";

import { CollectionSave } from "./collection-ui";
import { buildEquipmentDetails, type EquipmentDraft } from "./equipment-draft";
import { StockCard, StockInput, StockText } from "./stock-ui";

const equipmentTypes = ["vessel", "other"] as const;

export function EquipmentEditor({ item, total, occupied, busy, retryOnly, error, onSave, onCancel }: {
  item?: EquipmentItem;
  total: number;
  occupied: number;
  busy: boolean;
  retryOnly: boolean;
  error: string | null;
  onSave: (input: CreateEquipmentRequestBody | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<EquipmentDraft>({
    name: item?.name ?? "",
    type: item?.type ?? "vessel",
    capacity: item?.capacity ? String(item.capacity.value) : "",
    unit: item?.capacity?.unit ?? "L",
    notes: item?.notes ?? "",
    quantity: String(total)
  });
  const [invalid, setInvalid] = useState(false);
  const disabled = busy || retryOnly;

  function submit() {
    if (retryOnly) { onSave(null); return; }
    const input = buildEquipmentDetails(draft, randomUUID());
    const valid = input !== null && input.quantity >= occupied;
    setInvalid(!valid);
    if (valid) onSave(input);
  }

  return (
    <StockCard>
      <StockText kind="heading">{t(item ? "equipment.editTitle" : "equipment.addTitle")}</StockText>
      <CalculatorField label={t("equipment.name")}>
        <StockInput accessibilityLabel={t("equipment.name")} value={draft.name} maxLength={200}
          editable={!disabled} onChangeText={(name) => setDraft({ ...draft, name })} />
      </CalculatorField>
      <CalculatorField label={t("equipment.quantityOwned")} hint={occupied ? t("mobileInventory.minimumEquipment", { count: occupied }) : undefined}>
        <StockInput accessibilityLabel={t("equipment.quantityOwned")} value={draft.quantity}
          editable={!disabled} inputMode="numeric" onChangeText={(quantity) => setDraft({ ...draft, quantity })} />
      </CalculatorField>
      {occupied ? <StockText>{t("equipment.vessel")}</StockText> : (
        <CalculatorField label={t("equipment.type")}>
          <Segmented label={t("equipment.type")} options={equipmentTypes} value={draft.type}
            onChange={(type) => { if (!disabled) setDraft({ ...draft, type }); }}
            optionLabel={(type) => t(type === "vessel" ? "equipment.vessel" : "equipment.tool")} />
        </CalculatorField>
      )}
      {draft.type === "vessel" ? (
        <CalculatorField label={t("equipment.capacityOptional")}>
          <StockInput accessibilityLabel={t("equipment.capacityOptional")} value={draft.capacity} inputMode="decimal"
            editable={!disabled} onChangeText={(capacity) => setDraft({ ...draft, capacity })} />
          <Chips label={t("equipment.unit")} options={capacityUnitSchema.options} value={draft.unit}
            onChange={(unit) => { if (!disabled) setDraft({ ...draft, unit }); }}
            optionLabel={(unit) => t(`equipment.units.${unit}`)} />
        </CalculatorField>
      ) : null}
      <CalculatorField label={t("equipment.notes")}>
        <StockInput accessibilityLabel={t("equipment.notes")} value={draft.notes} maxLength={5000} multiline
          editable={!disabled} onChangeText={(notes) => setDraft({ ...draft, notes })} />
      </CalculatorField>
      <CollectionSave busy={busy} retryOnly={retryOnly} label="equipment.save"
        error={invalid ? t("mobileInventory.invalidEquipment") : error} onSave={submit} onCancel={onCancel} />
    </StockCard>
  );
}
