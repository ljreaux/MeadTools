import { randomUUID } from "expo-crypto";
import { useState } from "react";
import { Pressable, Text } from "react-native";
import { useTranslation } from "react-i18next";

import type { EquipmentBrewSummary, EquipmentItem, UpdateEquipmentRequestBody } from "@meadtools/api-contract";

import { CollectionSave } from "./collection-ui";
import { buildEquipmentAssignment } from "./equipment-draft";
import { StockCard, StockInput, StockText, useStockStyles } from "./stock-ui";

export function brewLabel(brew: EquipmentBrewSummary, fallback: string) {
  return brew.name || brew.recipe_name || fallback;
}

export function EquipmentAssignment({ item, name, brews, busy, retryOnly, error, onSave, onCancel }: {
  item: EquipmentItem;
  name: string;
  brews: EquipmentBrewSummary[];
  busy: boolean;
  retryOnly: boolean;
  error: string | null;
  onSave: (input: UpdateEquipmentRequestBody | null) => void;
  onCancel: () => void;
}) {
  const { t, i18n } = useTranslation();
  const styles = useStockStyles();
  const [review] = useState(item);
  const [selected, setSelected] = useState(review.brew?.id ?? null);
  const [search, setSearch] = useState("");
  const [invalid, setInvalid] = useState(false);
  const disabled = busy || retryOnly;
  const untitled = t("equipment.untitledBrew");
  const filter = search.trim().toLocaleLowerCase(i18n.language);
  const choices = brews.filter((brew) => brewLabel(brew, untitled).toLocaleLowerCase(i18n.language).includes(filter));
  const reassigning = review.brew && selected !== null && review.brew.id !== selected;
  const releasing = review.brew && selected === null;

  function submit() {
    if (retryOnly) { onSave(null); return; }
    const input = buildEquipmentAssignment(review, selected, randomUUID());
    setInvalid(!input);
    if (input) onSave(input);
  }

  function option(id: string | null, label: string) {
    const checked = selected === id;
    return (
      <Pressable key={id ?? "unassigned"} accessibilityRole="radio" accessibilityState={{ checked, disabled }}
        onPress={() => { setSelected(id); setInvalid(false); }} disabled={disabled}
        style={({ pressed }) => [styles.button, checked && styles.primary, pressed && styles.dim]}>
        <Text style={[styles.buttonText, checked && styles.primaryText]}>{label}</Text>
      </Pressable>
    );
  }

  return (
    <StockCard>
      <StockText kind="heading">{t("equipment.assignmentTitle", { name })}</StockText>
      {review.brew ? <StockText>{t("mobileInventory.equipmentCurrentBrew", { name: brewLabel(review.brew, untitled) })}</StockText> : null}
      {brews.length ? (
        <StockInput accessibilityLabel={t("mobileInventory.searchBrews")} placeholder={t("mobileInventory.searchBrews")}
          value={search} onChangeText={setSearch} editable={!disabled} autoCorrect={false} />
      ) : <StockText kind="muted">{t("mobileInventory.noOngoingBrews")}</StockText>}
      {review.brew ? option(null, t("equipment.unassigned")) : null}
      {choices.map((brew) => option(brew.id, brewLabel(brew, untitled)))}
      {filter && !choices.length ? <StockText kind="muted">{t("mobileInventory.noMatchingBrews")}</StockText> : null}
      {reassigning ? <StockText>{t("equipment.reassignmentNotice", { name: brewLabel(review.brew!, untitled) })}</StockText> : null}
      <CollectionSave busy={busy} retryOnly={retryOnly}
        error={invalid ? t("mobileInventory.chooseDifferentBrew") : error}
        label={reassigning ? "equipment.reassign" : releasing ? "mobileInventory.releaseVessel" : "equipment.saveAssignment"}
        onSave={submit} onCancel={onCancel} />
    </StockCard>
  );
}

export function EquipmentLabelEditor({ item, busy, retryOnly, error, onSave, onCancel }: {
  item: EquipmentItem;
  busy: boolean;
  retryOnly: boolean;
  error: string | null;
  onSave: (input: UpdateEquipmentRequestBody | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(item.label ?? "");
  return (
    <StockCard>
      <StockText kind="heading">{t("mobileInventory.editUnitLabel")}</StockText>
      <StockInput accessibilityLabel={t("mobileInventory.editUnitLabel")} placeholder={t("equipment.labelPlaceholder")}
        value={label} onChangeText={setLabel} maxLength={100} editable={!busy && !retryOnly} />
      <CollectionSave busy={busy} retryOnly={retryOnly} error={error} label="save"
        onSave={() => onSave(retryOnly ? null : { action: "label", operation_id: randomUUID(), label: label.trim() || null })}
        onCancel={onCancel} />
    </StockCard>
  );
}
