import { useQuery } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { Stack, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { CreateEquipmentRequestBody, EquipmentItem, UpdateEquipmentRequestBody } from "@meadtools/api-contract";
import { groupEquipment } from "@meadtools/inventory-domain";

import { CalculatorScreen, Segmented } from "@/components/calculator-ui";
import { CollectionGate, CollectionSave } from "@/inventory/collection-ui";
import { brewLabel, EquipmentAssignment, EquipmentLabelEditor } from "@/inventory/equipment-assignment";
import { EquipmentEditor } from "@/inventory/equipment-editor";
import { StockButton, StockCard, StockInput, StockText, useStockStyles } from "@/inventory/stock-ui";
import { useInventoryChange } from "@/inventory/use-inventory-change";
import { useApiClient, useSession } from "@/providers/app-providers";

type Editor =
  | { mode: "details"; item?: EquipmentItem; total: number; occupied: number }
  | { mode: "assignment" | "label"; item: EquipmentItem; name: string };
const equipmentFilters = ["all", "vessel", "other"] as const;

export default function EquipmentScreen() {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const { session } = useSession();
  const styles = useStockStyles();
  const change = useInventoryChange("equipment");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof equipmentFilters)[number]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const overview = useQuery({
    queryKey: ["equipment", session?.id],
    queryFn: () => api.getEquipment(),
    enabled: Boolean(session)
  });
  const { data, refetch, isError, isPending, isFetching } = overview;
  useFocusEffect(useCallback(() => { void refetch({ cancelRefetch: false }); }, [refetch]));
  const allowed = data?.can_manage === true && !isError;
  const needle = search.trim().toLocaleLowerCase(i18n.language);
  const groups = groupEquipment(data?.equipment ?? []).filter(({ item, units }) => (
    (filter === "all" || item.type === filter) && units.some((unit) =>
      [unit.name, unit.label, unit.notes, unit.brew?.name, unit.brew?.recipe_name]
        .some((text) => text?.toLocaleLowerCase(i18n.language).includes(needle))
    )
  ));
  const untitled = t("equipment.untitledBrew");
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 6 });
  const disabled = change.busy || change.retryOnly || isFetching;

  function open(next: Editor) {
    change.clear();
    setEditor(next);
  }

  function close() {
    change.clear();
    setEditor(null);
  }

  function save(request: (() => Promise<unknown>) | null) {
    if (allowed) void change.save(request, () => setEditor(null), () => setEditor(null));
  }

  function saveDetails(item: EquipmentItem | undefined, input: CreateEquipmentRequestBody | null) {
    if (!input) { save(null); return; }
    save(() => item ? api.updateEquipment(item.id, { ...input, action: "edit_group" }) : api.createEquipment(input));
  }

  function saveUnit(item: EquipmentItem, input: UpdateEquipmentRequestBody | null) {
    save(input ? () => api.updateEquipment(item.id, input) : null);
  }

  function archive(item: EquipmentItem, name: string, group: boolean) {
    Alert.alert(t("equipment.removeTitle"), t("equipment.removeDescription", { name }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("equipment.remove"),
        style: "destructive",
        onPress: () => saveUnit(item, { action: group ? "archive_group" : "archive", operation_id: randomUUID() })
      }
    ]);
  }

  return (
    <CalculatorScreen>
      <Stack.Screen options={{ title: t("equipment.title") }} />
      <CollectionGate error={isError} pending={isPending} allowed={allowed} retry={() => void refetch()}>
        {editor?.mode === "details" ? (
          <EquipmentEditor key={editor.item?.id ?? "new"} item={editor.item} total={editor.total} occupied={editor.occupied}
            busy={change.busy} retryOnly={change.retryOnly} error={change.error}
            onSave={(input) => saveDetails(editor.item, input)} onCancel={close} />
        ) : editor?.mode === "assignment" ? (
          <EquipmentAssignment key={editor.item.id} item={editor.item} name={editor.name} brews={data?.brews ?? []}
            busy={change.busy} retryOnly={change.retryOnly} error={change.error}
            onSave={(input) => saveUnit(editor.item, input)} onCancel={close} />
        ) : editor?.mode === "label" ? (
          <EquipmentLabelEditor key={editor.item.id} item={editor.item}
            busy={change.busy} retryOnly={change.retryOnly} error={change.error}
            onSave={(input) => saveUnit(editor.item, input)} onCancel={close} />
        ) : (
          <>
            <StockButton label={t("equipment.add")} primary disabled={change.busy || change.retryOnly}
              onPress={() => open({ mode: "details", total: 1, occupied: 0 })} />
            {change.retryOnly ? <CollectionSave {...change} label="equipment.remove" onSave={() => save(null)} /> : (
              change.error ? <StockText kind="error">{change.error}</StockText> : null
            )}
            {data?.equipment.length ? (
              <>
                <StockInput accessibilityLabel={t("equipment.search")} placeholder={t("equipment.search")}
                  value={search} onChangeText={setSearch} autoCorrect={false} />
                <Segmented label={t("equipment.filter")} options={equipmentFilters} value={filter}
                  onChange={setFilter} optionLabel={(value) => t(`equipment.filters.${value}`)} />
              </>
            ) : (
              <StockCard>
                <StockText kind="heading">{t("equipment.emptyTitle")}</StockText>
                <StockText>{t("equipment.emptyDescription")}</StockText>
              </StockCard>
            )}
            {data?.equipment.length && !groups.length ? <StockText kind="muted">{t("equipment.noMatches")}</StockText> : null}
            {groups.map(({ id, item, units, total, available }) => {
              const showUnits = total === 1 || expanded === id;
              const occupied = total - available;
              return (
                <StockCard key={id}>
                  <StockText kind="heading">{item.name}</StockText>
                  <StockText kind="muted">
                    {t(item.type === "vessel" ? "equipment.vessel" : "equipment.tool")}
                    {item.capacity ? ` · ${number.format(item.capacity.value)} ${t(`equipment.units.${item.capacity.unit}`)}` : ""}
                  </StockText>
                  {item.type === "vessel" ? <StockText>{t("equipment.groupAvailability", { total, available })}</StockText> : (
                    total > 1 ? <StockText>{t("mobileInventory.equipmentCount", { count: total })}</StockText> : null
                  )}
                  {item.notes ? <StockText kind="muted">{item.notes}</StockText> : null}
                  {item.type === "vessel" && !showUnits && occupied > 0 ? (
                    units.filter((unit) => unit.brew).map((unit) => (
                      <StockText key={unit.id}>{brewLabel(unit.brew!, untitled)}</StockText>
                    ))
                  ) : null}
                  <View style={styles.row}>
                    <StockButton label={t("equipment.edit")} accessibilityLabel={t("equipment.editNamed", { name: item.name })} disabled={disabled}
                      onPress={() => open({ mode: "details", item, total, occupied })} />
                    {occupied === 0 ? <StockButton label={t("equipment.remove")} accessibilityLabel={t("equipment.removeNamed", { name: item.name })} disabled={disabled} destructive
                      onPress={() => archive(item, item.name, total > 1)} /> : null}
                    {total > 1 ? <StockButton label={t(showUnits ? "mobileInventory.hideEquipmentUnits" : "mobileInventory.showEquipmentUnits")}
                      onPress={() => setExpanded(showUnits ? null : id)} /> : null}
                  </View>
                  {showUnits ? units.map((unit, index) => {
                    if (total === 1 && unit.type === "other" && !unit.label) return null;
                    const name = unit.label || (total === 1 ? item.name : t("equipment.unitLabel", { number: index + 1 }));
                    return (
                      <StockCard key={unit.id}>
                        {total > 1 || unit.label ? <StockText>{name}</StockText> : null}
                        {unit.type === "vessel" ? <StockText kind="muted">{unit.brew
                          ? t("mobileInventory.equipmentCurrentBrew", { name: brewLabel(unit.brew, untitled) })
                          : t("equipment.notAssigned")}</StockText> : null}
                        <View style={styles.row}>
                          {unit.type === "vessel" ? (
                            <StockButton label={t(unit.brew ? "mobileInventory.changeAssignment" : "equipment.assignment")}
                              disabled={disabled || (!unit.brew && !data?.brews.length)}
                              onPress={() => open({ mode: "assignment", item: unit, name })} />
                          ) : null}
                          {total > 1 || unit.label ? <StockButton label={t("mobileInventory.editUnitLabel")} disabled={disabled}
                            onPress={() => open({ mode: "label", item: unit, name })} /> : null}
                          {total > 1 && !unit.brew ? <StockButton label={t("equipment.remove")} accessibilityLabel={t("equipment.removeNamed", { name })} disabled={disabled}
                            onPress={() => archive(unit, name, false)} destructive /> : null}
                        </View>
                      </StockCard>
                    );
                  }) : null}
                </StockCard>
              );
            })}
          </>
        )}
      </CollectionGate>
    </CalculatorScreen>
  );
}
