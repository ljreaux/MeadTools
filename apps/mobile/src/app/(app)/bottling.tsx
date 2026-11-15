import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, TextInput, type TextStyle, View, type ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import type {
  BrewEntryResponse,
  BrewInventoryContextResponse,
  CreateBrewEntryRequestBody,
  InventoryOverviewResponse
} from "@meadtools/api-contract";
import type { BrewPackagingData } from "@meadtools/brew-domain/entry-payload";
import { BOTTLE_SIZES_L } from "@meadtools/core/extra-calculators";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";
import { InventoryError, type BottlingSelection } from "@meadtools/inventory-domain";

import {
  BottlingReviewError, buildBottlingSelection, buildPackaging, emptyBottle, initialPackagingDraft,
  packagingStockReview, wholeCount, type BottleDraft, type PackagingDraft, type PackagingPayload
} from "@/entries/bottling";
import { inventoryErrorCode } from "@/entries/inventory-deduction";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useApiClient, useSession } from "@/providers/app-providers";

type Review = {
  payload: PackagingPayload | null;
  context: BrewInventoryContextResponse;
  stock: InventoryOverviewResponse["stock"];
};
type Split = { id: string; rowId: string; count: string; target: string; location: string | null; position: string };

export default function BottlingScreen() {
  const { brewId, entryId } = useLocalSearchParams<{ brewId: string; entryId?: string }>();
  const { session } = useSession();
  const api = useApiClient();
  const online = useIsOnline();
  const brew = useQuery({
    queryKey: ["brew", session?.id, brewId],
    queryFn: () => api.getBrew(brewId),
    enabled: Boolean(session && brewId) && online
  });
  const entry = brew.data?.entries.find((item) => item.id === entryId && item.type === "PACKAGING");
  const { colors } = useThemeColors();
  const { t } = useTranslation();
  const styles = createStyles(colors);

  if (!brew.data || (entryId && !entry)) {
    return <View style={styles.center}>
      {brew.isFetching ? <ActivityIndicator color={colors.accent} /> : <Text accessibilityRole="alert" style={styles.body}>
        {t(online ? "mobileBrews.editEntry.notFound" : "mobileBrews.bottling.offline")}
      </Text>}
    </View>;
  }
  return <BottlingForm key={entry?.id ?? brewId} brewId={brewId}
    name={brew.data.name ?? brew.data.recipe_name ?? t("bottlingInventory.defaultName")} entry={entry} online={online} />;
}

function BottlingForm({ brewId, name, entry, online }: { brewId: string; name: string; entry?: BrewEntryResponse; online: boolean }) {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { session } = useSession();
  const [initial] = useState(() => {
    const data = (entry?.data ?? {}) as Partial<BrewPackagingData>;
    const draft = initialPackagingDraft(data, entry?.note ?? "", Crypto.randomUUID);
    const legacyKeys = Object.fromEntries([
      ...(data.bottleRows ?? []).flatMap((row, index) => row.id ? [] : [[`bottle:${draft.bottles[index].id}`, `bottle:${index}`]]),
      ...(data.closures ?? []).flatMap((row, index) => row.id ? [] : [[`closure:${draft.closures[index].id}`, `closure:${index}`]])
    ]);
    if (!entry) draft.bottles = [emptyBottle(Crypto.randomUUID())];
    return { draft, legacyKeys };
  });
  const [draft, setDraft] = useState<PackagingDraft>(initial.draft);
  const [review, setReview] = useState<Review | null>(null);
  const [stockChoices, setStockChoices] = useState<Record<string, string | null>>({});
  const [splits, setSplits] = useState<Split[]>([]);
  const [track, setTrack] = useState(false);
  const [mode, setMode] = useState<BottlingSelection["mode"]>("sync");
  const [confirmed, setConfirmed] = useState(false);
  const [newName, setNewName] = useState(name.slice(0, 200));
  const [newMeadId] = useState(() => Crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const locked = useRef(false);
  const attempt = useRef<CreateBrewEntryRequestBody | null>(null);
  // Mirrors `attempt` for rendering: a retry must resend the same request.
  const [attemptPending, setAttemptPending] = useState(false);

  const premium = review?.context.can_manage === true;
  const meads = useQuery({
    queryKey: ["finished-meads", session?.id],
    queryFn: () => api.getFinishedMeads(),
    enabled: premium && online
  });
  const organization = useQuery({
    queryKey: ["inventory-organization", session?.id],
    queryFn: () => api.getInventoryOrganization(),
    enabled: premium && online && Boolean(review?.payload)
  });

  const previous = review?.context.usages.filter((use) => use.entry_id === entry?.id) ?? [];
  const source = review?.context.bottlings.find((row) => row.entry_id === entry?.id);
  const stockReview = premium ? packagingStockReview(review.payload, review.stock, previous, stockChoices, initial.legacyKeys) : null;
  let balances: ReturnType<NonNullable<typeof stockReview>["balances"]> = [];
  let stockError = "";
  try {
    balances = stockReview?.balances() ?? [];
  } catch (error) {
    stockError = error instanceof InventoryError ? error.code : "INVALID_QUANTITY";
  }

  const n = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 3 });
  const unitLabel = (unit: string) => t(`units.${unit}`, { defaultValue: unit });
  const newSplit = (rowId: string, count: string): Split => ({
    id: Crypto.randomUUID(), rowId, count, target: "new", location: null, position: ""
  });
  const patchSplit = (id: string, patch: Partial<Split>) =>
    setSplits((current) => current.map((row) => row.id === id ? { ...row, ...patch } : row));
  const patchBottle = (id: string, patch: Partial<BottleDraft>) =>
    setDraft((current) => ({ ...current, bottles: current.bottles.map((row) => row.id === id ? { ...row, ...patch } : row) }));

  async function startReview(removing: boolean) {
    if (!online || locked.current) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      const payload = removing ? null : buildPackaging(draft, entry?.datetime ?? new Date().toISOString());
      const context = await api.getBrewInventory(brewId);
      const stock = context.can_manage ? (await api.getInventoryOverview()).stock : [];
      const source = context.bottlings.find((row) => row.entry_id === entry?.id);
      const rows = payload?.data.bottleRows ?? [];
      const output = source?.outputs ?? [];
      const activeIds = new Set(rows.map((row) => row.id));
      setSplits(output.length
        ? output.filter((row) => activeIds.has(row.row_id)).map((row) => ({
          ...newSplit(row.row_id, String(row.quantity)), target: row.mead_id
        }))
        : rows.map((row) => newSplit(row.id!, String(row.quantity))));
      setMode(source?.reconciliation_required ? "reconcile" : "sync");
      setConfirmed(false);
      setTrack(Boolean(output.length));
      setStockChoices({});
      setReview({ payload, context, stock });
    } catch (error) {
      const code = inventoryErrorCode(error) ?? (error instanceof InventoryError ? error.code : null);
      setMessage(code ? t(`inventory.errors.${code}`, { defaultValue: t("inventory.saveError") })
        : error instanceof MeadToolsApiError ? t("inventory.loadError") : t("mobileBrews.bottling.invalid"));
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  function failure(error: unknown) {
    const code = inventoryErrorCode(error) ?? (error instanceof InventoryError || error instanceof BottlingReviewError ? error.code : null);
    if (!code) return error instanceof MeadToolsApiError
      ? t("inventory.saveError") : t("bottlingInventory.errors.INVALID_QUANTITY");
    const inventoryKey = `inventory.errors.${code}`;
    const bottlingKey = `bottlingInventory.errors.${code}`;
    return t(stockError ? inventoryKey : bottlingKey, { defaultValue: t(inventoryKey, { defaultValue: t("inventory.saveError") }) });
  }

  async function saveReview() {
    if (!online || !review || locked.current || (stockError && !attempt.current)) return;
    locked.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (!attempt.current) {
        const inventory = stockReview?.selection(Crypto.randomUUID());
        const outputs: BottlingSelection["outputs"] = track && review.payload ? splits.map((row) => ({
          row_id: row.rowId,
          quantity: wholeCount(row.count),
          target: row.target === "new" ? { kind: "new", mead_id: newMeadId, name: newName.trim() }
            : { kind: "existing", mead_id: row.target },
          location_id: mode === "reconcile" ? null : row.location,
          position: mode === "reconcile" ? "" : row.position
        })) : [];
        const bottling = premium ? buildBottlingSelection({
          payload: review.payload, source, operationId: Crypto.randomUUID(), mode,
          confirmed, outputs, correcting: Boolean(entry && review.payload)
        }) : undefined;
        attempt.current = {
          ...review.payload, type: "PACKAGING", inventory, bottling,
          client_entry_id: entry ? undefined : Crypto.randomUUID()
        };
        setAttemptPending(true);
      }
      const { type: _type, client_entry_id: _id, ...update } = attempt.current;
      const result = !entry ? await api.createBrewEntry(brewId, attempt.current)
        : review.payload ? await api.updateBrewEntry(brewId, entry.id, update)
        : await api.deleteBrewEntry(brewId, entry.id, { inventory: update.inventory, bottling: update.bottling });
      if ("entries" in result) queryClient.setQueryData(["brew", session?.id, brewId], result);
      void Promise.all(["brew", "brews", "inventory", "finished-meads", "inventory-organization"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key, session?.id] })));
      if ("inventory" in result && result.inventory?.status === "reconciliation_required") {
        Alert.alert(t("bottlingInventory.changedSources"), t("bottlingInventory.pending"));
      }
      router.back();
    } catch (error) {
      if (error instanceof MeadToolsApiError && error.status >= 400 && error.status < 500) {
        attempt.current = null;
        setAttemptPending(false);
      }
      setMessage(attempt.current ? t("mobileBrews.bottling.retrySame") : failure(error));
      locked.current = false;
      setBusy(false);
    }
  }

  function field(label: string, value: string, onChangeText: (value: string) => void, inputMode: "text" | "numeric" | "decimal" = "text") {
    return <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} inputMode={inputMode} value={value} onChangeText={onChangeText} />
    </View>;
  }

  function options<T extends string | null>(
    label: string, value: T, values: readonly { id: T; name: string }[], onSelect: (value: T) => void
  ) {
    return <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal contentContainerStyle={styles.options} keyboardShouldPersistTaps="handled"
        accessibilityLabel={label} accessibilityRole="radiogroup">
        {values.map(({ id, name }) => <Pressable key={id ?? "none"} accessibilityRole="radio"
          accessibilityState={{ checked: value === id }} style={[styles.button, id === value && styles.selected]}
          onPress={() => onSelect(id)}><Text style={styles.body}>{name}</Text></Pressable>)}
      </ScrollView>
    </View>;
  }

  function toggle(label: string, checked: boolean, onChange: () => void) {
    return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked }}
      style={styles.button} onPress={onChange}><Text style={styles.body}>{checked ? "☑" : "☐"} {label}</Text></Pressable>;
  }

  function renderDraft() {
    return <>
      <Text accessibilityRole="header" style={styles.heading}>{t("mobileBrews.bottling.bottles")}</Text>
      {draft.bottles.map((row, index) => <View key={row.id} style={styles.card}>
        {field(t("mobileBrews.bottling.bottleCount", { index: index + 1 }), row.quantity, (quantity) => patchBottle(row.id, { quantity }), "numeric")}
        {options(t("mobileBrews.bottling.size"), row.size,
          [...Object.keys(BOTTLE_SIZES_L).map((size) => ({ id: size, name: size })), { id: "custom", name: t("mobileBrews.bottling.custom") }],
          (size) => patchBottle(row.id, { size }))}
        {row.size === "custom" ? <>
          {field(t("mobileBrews.bottling.customSize"), row.custom, (custom) => patchBottle(row.id, { custom }), "decimal")}
          {options(t("mobileBrews.addEntry.unitLabel"), row.customUnit,
            [{ id: "ml", name: "mL" }, { id: "liter", name: "L" }, { id: "fl_oz", name: unitLabel("fl_oz") }, { id: "gallon", name: unitLabel("gal") }],
            (customUnit) => patchBottle(row.id, { customUnit }))}
        </> : null}
        <ActionButton label={t("mobileBrews.bottling.removeRow")} onPress={() => setDraft((current) => ({ ...current, bottles: current.bottles.filter((item) => item.id !== row.id) }))} styles={styles} />
      </View>)}
      <ActionButton label={t("mobileBrews.bottling.addBottle")} onPress={() => setDraft((current) => ({ ...current, bottles: [...current.bottles, emptyBottle(Crypto.randomUUID())] }))} disabled={draft.bottles.length >= 50} styles={styles} />
      <Text accessibilityRole="header" style={styles.heading}>{t("mobileBrews.bottling.closures")}</Text>
      {draft.closures.map((row, index) => <View key={row.id} style={styles.card}>
        {field(t("mobileBrews.bottling.closureName", { index: index + 1 }), row.name,
          (name) => setDraft((current) => ({ ...current, closures: current.closures.map((item) => item.id === row.id ? { ...item, name } : item) })))}
        {field(t("mobileBrews.bottling.closureCount", { index: index + 1 }), row.quantity,
          (quantity) => setDraft((current) => ({ ...current, closures: current.closures.map((item) => item.id === row.id ? { ...item, quantity } : item) })), "numeric")}
        <ActionButton label={t("mobileBrews.bottling.removeRow")} onPress={() => setDraft((current) => ({ ...current, closures: current.closures.filter((item) => item.id !== row.id) }))} styles={styles} />
      </View>)}
      <ActionButton label={t("mobileBrews.bottling.addClosure")} onPress={() => setDraft((current) => ({
        ...current, closures: [...current.closures, { id: Crypto.randomUUID(), name: "", quantity: "" }]
      }))} disabled={draft.closures.length >= 50} styles={styles} />
      {field(t("mobileBrews.bottling.volume"), draft.volume, (volume) => setDraft((current) => ({ ...current, volume })), "decimal")}
      <Text style={styles.hint}>{t("mobileBrews.bottling.volumeHint")}</Text>
      {options(t("mobileBrews.addEntry.unitLabel"), draft.unit, [{ id: "L", name: "L" }, { id: "gal", name: unitLabel("gal") }],
        (unit) => setDraft((current) => ({ ...current, unit })))}
      {field(t("mobileBrews.addEntry.noteLabel"), draft.note, (note) => setDraft((current) => ({ ...current, note })))}
      <ActionButton label={t("bottlingInventory.title")} onPress={() => void startReview(false)} disabled={busy || !online} primary styles={styles} />
      {entry ? <ActionButton label={t("bottlingInventory.removeTitle")} onPress={() => void startReview(true)} disabled={busy || !online} styles={styles} /> : null}
    </>;
  }

  function renderReview(current: Review): ReactNode {
    const removal = !current.payload;
    const rows = current.payload?.data.bottleRows ?? [];
    const targets = new Map((source?.outputs ?? []).map((row) => [row.mead_id, { id: row.mead_id, name: row.name }]));
    for (const item of meads.data?.meads ?? []) targets.set(item.id, { id: item.id, name: item.name });
    const targetOptions = [...targets.values(), ...(mode === "sync" ? [{ id: "new", name: t("bottlingInventory.newEntry") }] : [])];
    const locations = [{ id: null, name: t("inventory.organization.unlocated") }, ...(organization.data?.locations ?? [])
      .map((location) => ({ id: location.id, name: location.path }))];
    const preview = new Map<string, { target: string; size: number; previous: number; next: number }>();
    function addOutput(target: string, size: number, quantity: number, side: "previous" | "next") {
      const key = JSON.stringify([target, size]);
      const item = preview.get(key) ?? { target, size, previous: 0, next: 0 };
      item[side] += quantity;
      preview.set(key, item);
    }
    for (const output of source?.outputs ?? []) addOutput(output.mead_id, output.size_liters, output.quantity, "previous");
    if (track && !removal) {
      for (const split of splits) {
        const row = rows.find((item) => item.id === split.rowId);
        const count = Number(split.count);
        if (row && Number.isSafeInteger(count) && count > 0) addOutput(split.target, row.sizeLiters, count, "next");
      }
    }
    const outputNeedsConfirmation = Boolean(source?.reconciliation_required || mode === "reconcile"
      || (entry && !removal && !source?.outputs.length && track && splits.length));
    const blockedOutput = track && !removal && splits.some((row) => !targetOptions.some((item) => item.id === row.target));
    const blocked = !online || busy || Boolean(stockError) || blockedOutput || (outputNeedsConfirmation && !confirmed);
    return <>
      <Text accessibilityRole="header" style={styles.heading}>{t(removal ? "bottlingInventory.removeTitle" : "bottlingInventory.title")}</Text>
      <Text style={styles.body}>{t(removal ? "bottlingInventory.removeHelp" : premium ? "bottlingInventory.help" : "mobileBrews.bottling.untracked")}</Text>
      {current.payload ? <Text style={styles.label}>{n.format(current.payload.data.displayValue ?? 0)} {unitLabel(current.payload.data.displayUnit ?? "L")}</Text> : null}
      {attemptPending ? null : <>
        {stockReview?.rows.map(({ line, options: stocks, selected }) => <View key={line.key} style={styles.card}>
          {options(`${line.name} · ${line.quantity.value}`, selected,
            [...stocks.map((stock) => ({ id: stock.id, name: `${stock.name} · ${n.format(stock.quantity.value)}` })),
              { id: null, name: t("brewInventory.untrackedChoice") }],
            (id) => setStockChoices((current) => ({ ...current, [line.key]: id })))}
        </View>)}
        {balances.map(({ stock_id, quantity }) => <Text key={stock_id} style={styles.hint}>
          {stockReview?.stock.get(stock_id)?.name} · {t("inventory.balanceAfter", {
            value: n.format(quantity.value), unit: unitLabel(quantity.unit)
          })}
        </Text>)}
        {stockError ? <Text accessibilityRole="alert" style={styles.error}>{t(`inventory.errors.${stockError}`, { defaultValue: t("inventory.invalid") })}</Text> : null}
        {premium ? <>
          {source?.reconciliation_required ? <Text accessibilityRole="alert" style={styles.error}>{t("bottlingInventory.pending")}</Text> : null}
          {source && !source.reconciliation_required ? options(t("bottlingInventory.correctionMode"), mode,
            [{ id: "sync", name: t("bottlingInventory.applyDifference") }, { id: "reconcile", name: t("bottlingInventory.reconcile") }],
            (next) => { setMode(next); setConfirmed(false); }) : null}
          {source ? <Text style={styles.hint}>{t(mode === "reconcile" ? "bottlingInventory.reconcileHelp" : "bottlingInventory.differenceHelp")}</Text> : null}
          {source?.outputs.map((output, index) => <Text key={`${output.row_id}:${index}`} style={styles.hint}>
            {output.name} · {n.format(output.size_liters)} L · {output.quantity}
          </Text>)}
          {!removal && rows.length ? toggle(t("bottlingInventory.track"), track, () => { setTrack(!track); setConfirmed(false); }) : null}
          {track && !removal ? <>
            {meads.isError || organization.isError ? <Text accessibilityRole="alert" style={styles.error}>{t("inventory.loadError")}</Text> : null}
            <Text style={styles.hint}>{t("bottlingInventory.storageHelp")}</Text>
            {mode === "sync" && splits.some((row) => row.target === "new")
              ? field(t("bottlingInventory.newEntry"), newName, setNewName) : null}
            {rows.map((row) => {
              const assigned = splits.filter((split) => split.rowId === row.id);
              const remaining = row.quantity - assigned.reduce((sum, split) => sum + (Number(split.count) || 0), 0);
              return <View key={row.id} style={styles.card}>
                <Text style={styles.label}>{row.label === "Custom" ? `${n.format(row.sizeLiters)} L` : row.label} · {row.quantity}</Text>
                {assigned.map((split) => <View key={split.id} style={styles.group}>
                  {field(t("bottlingInventory.bottlesToTrack"), split.count, (count) => patchSplit(split.id, { count }), "numeric")}
                  {options(t("bottlingInventory.entry"), split.target, targetOptions, (target) => patchSplit(split.id, { target }))}
                  {mode === "sync" ? <>
                    {options(t("bottlingInventory.addedLocation"), split.location, locations, (location) => patchSplit(split.id, { location }))}
                    {split.location ? field(t("mobileBrews.bottling.position"), split.position, (position) => patchSplit(split.id, { position })) : null}
                  </> : null}
                  <ActionButton label={t("bottlingInventory.removeSplit")} onPress={() => setSplits((current) => current.filter((item) => item.id !== split.id))} styles={styles} />
                </View>)}
                <Text style={remaining < 0 ? styles.error : styles.hint}>{t(remaining < 0 ? "bottlingInventory.overAssigned" : "bottlingInventory.untrackedCount", { count: Math.abs(remaining) })}</Text>
                <ActionButton label={t("bottlingInventory.split")} onPress={() => setSplits((current) => [...current, newSplit(row.id!, remaining > 0 ? String(remaining) : "")])} disabled={splits.length >= 100} styles={styles} />
              </View>;
            })}
          </> : null}
          {preview.size > 0 && meads.data ? <View style={styles.card}>
            <Text style={styles.label}>{t("bottlingInventory.balancePreview")}</Text>
            {[...preview.entries()].map(([key, item]) => {
              const mead = meads.data?.meads.find((row) => row.id === item.target);
              const before = mead?.bottles.find((row) => Math.abs(row.size_liters - item.size) < 0.0000005)?.quantity;
              if (before == null && item.target !== "new" && !mead) return null;
              const balance = before ?? 0;
              const delta = mode === "reconcile" ? 0 : item.next - item.previous;
              return <Text key={key} style={balance + delta < 0 ? styles.error : styles.hint}>
                {item.target === "new" ? newName : mead?.name} · {n.format(item.size)} L · {t("bottlingInventory.balanceLine", {
                  count: balance + delta, before: n.format(balance), after: n.format(balance + delta),
                  delta: delta > 0 ? `+${n.format(delta)}` : n.format(delta)
                })}
              </Text>;
            })}
          </View> : null}
          {outputNeedsConfirmation ? toggle(t(mode === "reconcile" ? "bottlingInventory.confirmReconcile" : "bottlingInventory.confirmOlder"),
            confirmed, () => setConfirmed(!confirmed)) : null}
        </> : null}
      </>}
      <ActionButton label={t(removal ? "mobileBrews.bottling.confirmRemoval" : "bottlingInventory.save")} onPress={() => void saveReview()} disabled={attemptPending ? busy || !online : blocked} primary styles={styles} />
      {attemptPending ? null : <ActionButton label={t("mobileBrews.addEntry.cancel")} onPress={() => { setReview(null); setMessage(""); }} disabled={busy} styles={styles} />}
    </>;
  }

  return <KeyboardAvoidingView style={styles.screen} behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
      <Text style={styles.heading}>{name}</Text>
      {!online ? <Text accessibilityRole="alert" style={styles.error}>{t("mobileBrews.bottling.offline")}</Text> : null}
      {online || review ? review ? renderReview(review) : renderDraft() : null}
      {!review ? <ActionButton label={t("mobileBrews.addEntry.cancel")} onPress={() => router.back()} disabled={busy} styles={styles} /> : null}
      {busy ? <ActivityIndicator accessibilityLabel={t("mobileBrews.addEntry.saving")} color={colors.accent} /> : null}
      {message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{message}</Text> : null}
    </ScrollView>
  </KeyboardAvoidingView>;
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background },
    content: { gap: spacing.lg, padding: spacing.xl },
    group: { gap: spacing.sm },
    card: { borderColor: colors.border, borderWidth: 1, borderRadius: radii.lg, padding: spacing.md, gap: spacing.md },
    options: { gap: spacing.sm },
    heading: { color: colors.text, fontSize: typography.size.action, fontWeight: typography.weight.bold },
    label: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    body: { color: colors.text, fontSize: typography.size.body },
    hint: { color: colors.textMuted, fontSize: typography.size.caption },
    error: { color: colors.error, fontSize: typography.size.body },
    input: { minHeight: 48, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border,
      borderWidth: 1, borderRadius: radii.lg, paddingHorizontal: spacing.md, fontSize: typography.size.body },
    button: { minHeight: 44, justifyContent: "center", borderColor: colors.border, borderWidth: 1,
      borderRadius: radii.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
    selected: { borderColor: colors.accent, borderWidth: 2 },
    primary: { backgroundColor: colors.accent, borderColor: colors.accent, alignItems: "center" },
    primaryText: { color: colors.onAccent, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    disabled: { opacity: 0.5 }
  });
}

type ActionButtonStyles = Record<"button" | "disabled" | "primary", ViewStyle> & Record<"body" | "primaryText", TextStyle>;

function ActionButton({ label, onPress, disabled = false, primary = false, styles }: {
  label: string; onPress: () => void; disabled?: boolean; primary?: boolean; styles: ActionButtonStyles;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} style={[styles.button, primary && styles.primary, disabled && styles.disabled]}>
    <Text style={primary ? styles.primaryText : styles.body}>{label}</Text>
  </Pressable>;
}
