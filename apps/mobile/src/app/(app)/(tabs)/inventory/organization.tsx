import { randomUUID } from "expo-crypto";
import { Stack } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { InventoryLabel, InventoryLocation, UpdateInventoryOrganizationRequestBody } from "@meadtools/api-contract";
import { updateInventoryOrganizationRequestBodySchema } from "@meadtools/api-contract/inventory";

import { CalculatorField, CalculatorScreen, Chips } from "@/components/calculator-ui";
import { possibleStorageParents } from "@/inventory/collection-draft";
import { CollectionGate, CollectionSave } from "@/inventory/collection-ui";
import { StockButton, StockCard, StockInput, StockText, useStockStyles } from "@/inventory/stock-ui";
import { useInventoryOrganization } from "@/inventory/use-collections";
import { useInventoryChange } from "@/inventory/use-inventory-change";
import { useApiClient } from "@/providers/app-providers";

type Editor =
  | { kind: "label"; item?: InventoryLabel }
  | { kind: "location"; item?: InventoryLocation };

export default function InventoryOrganizationScreen() {
  const { t } = useTranslation();
  const api = useApiClient();
  const styles = useStockStyles();
  const overview = useInventoryOrganization();
  const { data } = overview;
  const [editor, setEditor] = useState<Editor | null>(null);
  const change = useInventoryChange("organization");
  const allowed = data?.can_manage === true && !overview.isError;

  function save(input: UpdateInventoryOrganizationRequestBody | null) {
    if (!allowed) return;
    void change.save(input ? () => api.updateInventoryOrganization(input) : null,
      () => setEditor(null), () => setEditor(null));
  }

  function open(next: Editor) {
    change.clear();
    setEditor(next);
  }

  function archive(kind: Editor["kind"], item: InventoryLabel) {
    Alert.alert(
      t("inventory.organization.archiveNamed", { name: item.name }),
      t(kind === "label" ? "inventory.organization.archiveCategoryHelp" : "inventory.organization.archiveLocationHelp"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("inventory.meads.archive"),
          style: "destructive",
          onPress: () => save({
            action: kind === "label" ? "archive_label" : "archive_location",
            id: item.id,
            expected_version: item.version,
            operation_id: randomUUID()
          })
        }
      ]
    );
  }

  return (
    <CalculatorScreen>
      <Stack.Screen options={{ title: t("inventory.organization.manage") }} />
      <CollectionGate error={overview.isError} pending={overview.isPending} allowed={allowed} retry={() => void overview.refetch()}>
        {editor ? (
          <OrganizationEditor key={editor.item?.id ?? editor.kind} editor={editor} locations={data?.locations ?? []}
            busy={change.busy} retryOnly={change.retryOnly} error={change.error} onSave={save}
            onCancel={() => { change.clear(); setEditor(null); }} />
        ) : (
          <>
            {change.retryOnly ? <CollectionSave {...change} label="inventory.meads.archive" onSave={() => save(null)} /> : (
              change.error ? <StockText kind="error">{change.error}</StockText> : null
            )}
            <StockCard>
              <StockText kind="heading">{t("inventory.organization.categories")}</StockText>
              {!data?.labels.length ? <StockText kind="muted">{t("inventory.organization.empty_label")}</StockText> : null}
              {data?.labels.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={styles.rowName}><StockText>{item.name}</StockText></View>
                  <StockButton label={t("equipment.edit")} accessibilityLabel={t("inventory.organization.editNamed", { name: item.name })}
                    onPress={() => open({ kind: "label", item })} disabled={change.busy || change.retryOnly || overview.isFetching} />
                  <StockButton label={t("inventory.meads.archive")} accessibilityLabel={t("inventory.organization.archiveNamed", { name: item.name })}
                    onPress={() => archive("label", item)} disabled={change.busy || change.retryOnly || overview.isFetching} destructive />
                </View>
              ))}
              <StockButton label={t("inventory.organization.add_label")} onPress={() => open({ kind: "label" })} disabled={change.busy || change.retryOnly} />
            </StockCard>
            <StockCard>
              <StockText kind="heading">{t("inventory.organization.locations")}</StockText>
              {!data?.locations.length ? <StockText kind="muted">{t("inventory.organization.empty_location")}</StockText> : null}
              {data?.locations.map((item) => (
                <View key={item.id} style={styles.row}>
                  <View style={styles.rowName}><StockText>{item.path}</StockText></View>
                  <StockButton label={t("equipment.edit")} accessibilityLabel={t("inventory.organization.editNamed", { name: item.name })}
                    onPress={() => open({ kind: "location", item })} disabled={change.busy || change.retryOnly || overview.isFetching} />
                  <StockButton label={t("inventory.meads.archive")} accessibilityLabel={t("inventory.organization.archiveNamed", { name: item.name })}
                    onPress={() => archive("location", item)} disabled={change.busy || change.retryOnly || overview.isFetching} destructive />
                </View>
              ))}
              <StockButton label={t("inventory.organization.add_location")} onPress={() => open({ kind: "location" })} disabled={change.busy || change.retryOnly} />
            </StockCard>
          </>
        )}
      </CollectionGate>
    </CalculatorScreen>
  );
}

function OrganizationEditor({ editor, locations, busy, retryOnly, error, onSave, onCancel }: {
  editor: Editor;
  locations: InventoryLocation[];
  busy: boolean;
  retryOnly: boolean;
  error: string | null;
  onSave: (input: UpdateInventoryOrganizationRequestBody | null) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(editor.item?.name ?? "");
  const [parent, setParent] = useState(editor.kind === "location" ? editor.item?.parent_id ?? "" : "");
  const [invalid, setInvalid] = useState(false);
  const parents = possibleStorageParents(locations, editor.item?.id);
  const disabled = busy || retryOnly;

  function submit() {
    if (retryOnly) { onSave(null); return; }
    const parsed = updateInventoryOrganizationRequestBodySchema.safeParse({
      action: editor.item ? `edit_${editor.kind}` : `create_${editor.kind}`,
      operation_id: randomUUID(),
      name,
      ...(editor.item ? { id: editor.item.id, expected_version: editor.item.version } : {}),
      ...(editor.kind === "location" ? { parent_id: parent || null } : {})
    });
    setInvalid(!parsed.success);
    if (parsed.success) onSave(parsed.data);
  }

  return (
    <StockCard>
      <StockText kind="heading">{editor.item
        ? t("inventory.organization.editNamed", { name: editor.item.name })
        : t(`inventory.organization.add_${editor.kind}`)}</StockText>
      <CalculatorField label={t("inventory.name")}>
        <StockInput accessibilityLabel={t("inventory.name")} value={name} onChangeText={setName} maxLength={100} editable={!disabled} />
      </CalculatorField>
      {editor.kind === "location" ? (
        <CalculatorField label={t("inventory.organization.parent")}>
          <Chips label={t("inventory.organization.parent")} options={["", ...parents.map(({ id }) => id)]} value={parent}
            onChange={(id) => { if (!disabled) setParent(id); }}
            optionLabel={(id) => id ? parents.find((row) => row.id === id)!.path : t("inventory.organization.noParent")} />
        </CalculatorField>
      ) : null}
      <CollectionSave busy={busy} retryOnly={retryOnly}
        error={invalid ? t("inventory.organization.errors.INVALID_INVENTORY_REQUEST") : error}
        label="save" onSave={submit} onCancel={onCancel} />
    </StockCard>
  );
}
