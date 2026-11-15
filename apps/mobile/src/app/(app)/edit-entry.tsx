import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { type ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import {
  additionEditUnits,
  buildEntryUpdate,
  canDeleteEntry,
  editKind,
  initialEditFields,
  needsStockReview,
  type EditFields
} from "@/entries/entry-edit";
import { inventoryErrorCode } from "@/entries/inventory-deduction";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useThemeColors } from "@/hooks/useThemeColors";
import { VOLUME_UNITS } from "@/outbox/entry-forms";
import { useApiClient, useSession } from "@/providers/app-providers";

/** Server codes that mean the change needs the web's stock review. */
const WEB_REVIEW_CODES = new Set(["SELECTION_REQUIRED", "RECONCILIATION_REQUIRED", "STALE_USAGE", "STALE_STOCK"]);

export default function EditEntryScreen() {
  const params = useLocalSearchParams<{ brewId: string; entryId: string }>();
  const brewId = params.brewId ?? "";
  const entryId = params.entryId ?? "";
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const apiClient = useApiClient();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const online = useIsOnline();

  const brewKey = ["brew", session?.id, brewId];
  const brewQuery = useQuery({
    queryKey: brewKey,
    queryFn: () => apiClient.getBrew(brewId),
    enabled: Boolean(session && brewId)
  });
  const entry = brewQuery.data?.entries.find((item) => item.id === entryId);

  const [fields, setFields] = useState<EditFields | null>(null);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [message, setMessage] = useState<{ text: string; hint?: string } | null>(null);
  const [fieldError, setFieldError] = useState<{ field: string; text: string } | null>(null);

  if (!entry) {
    return (
      <View style={styles.centered}>
        {brewQuery.isPending ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Text accessibilityRole="alert" style={styles.body}>{t("mobileBrews.editEntry.notFound")}</Text>
        )}
      </View>
    );
  }

  const initial = initialEditFields(entry);
  const current = fields ?? initial;
  const kind = editKind(entry);
  const set = (patch: Partial<EditFields>) => {
    setFields({ ...current, ...patch });
    setFieldError(null);
    setMessage(null);
  };

  function describeFailure(error: unknown) {
    const code = inventoryErrorCode(error);
    if (code) {
      return {
        text: t(`inventory.errors.${code}`, { defaultValue: t("mobileBrews.editEntry.errors.failed") }),
        hint: WEB_REVIEW_CODES.has(code) ? t("mobileBrews.editEntry.webReview") : undefined
      };
    }
    if (error instanceof MeadToolsApiError && error.status === 404) {
      return { text: t("mobileBrews.editEntry.notFound") };
    }
    return { text: t("mobileBrews.editEntry.errors.failed") };
  }

  async function refreshAndClose(inventory?: { status?: string }) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: brewKey }),
      queryClient.invalidateQueries({ queryKey: ["brews", session?.id] }),
      queryClient.invalidateQueries({ queryKey: ["inventory", session?.id] })
    ]);
    // Like the web: a tracked entry changed while tracking is unavailable keeps
    // its recorded stock use, and that stock now needs review.
    if (needsStockReview(inventory)) Alert.alert(t("brewInventory.reconciliation"));
    router.back();
  }

  async function save() {
    if (!entry || busy) return;
    const result = buildEntryUpdate(entry, initial, current);
    if (!result.ok) {
      setFieldError({
        field: result.field,
        text: result.field === "name"
          ? t("mobileBrews.addEntry.errors.nameRequired")
          : result.field === "note"
            ? t("mobileBrews.addEntry.errors.textRequired")
            : t(`mobileBrews.editEntry.errors.${result.error}`)
      });
      return;
    }
    if (!result.changed) {
      router.back();
      return;
    }
    setBusy("save");
    try {
      const response = await apiClient.updateBrewEntry(brewId, entryId, result.body);
      await refreshAndClose(response.inventory);
    } catch (error) {
      setMessage(describeFailure(error));
      setBusy(null);
    }
  }

  function confirmDelete() {
    Alert.alert(t("mobileBrews.editEntry.deleteTitle"), t("mobileBrews.editEntry.deleteBody"), [
      { text: t("mobileBrews.editEntry.deleteKeep"), style: "cancel" },
      { text: t("mobileBrews.editEntry.delete"), style: "destructive", onPress: () => void remove() }
    ]);
  }

  async function remove() {
    setBusy("delete");
    try {
      const response = await apiClient.deleteBrewEntry(brewId, entryId);
      await refreshAndClose(response.inventory);
    } catch (error) {
      setMessage(describeFailure(error));
      setBusy(null);
    }
  }

  function field(label: string, children: ReactNode, error?: string | null, hint?: string | null) {
    return (
      <View style={styles.field}>
        <Text style={styles.label}>{label}</Text>
        {children}
        {error ? (
          <Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.error}>{error}</Text>
        ) : hint ? (
          <Text style={styles.hint}>{hint}</Text>
        ) : null}
      </View>
    );
  }

  function input(label: string, value: string, onChange: (text: string) => void, options: { numeric?: boolean; multiline?: boolean; invalid?: boolean } = {}) {
    return (
      <TextInput
        accessibilityLabel={label}
        editable={!busy}
        inputMode={options.numeric ? "decimal" : undefined}
        keyboardType={options.numeric ? "decimal-pad" : undefined}
        multiline={options.multiline}
        onChangeText={onChange}
        style={[styles.input, options.multiline && styles.noteInput, options.invalid && styles.inputInvalid]}
        textAlignVertical={options.multiline ? "top" : undefined}
        value={value}
      />
    );
  }

  function chips(label: string, options: readonly string[], value: string, onChange: (next: string) => void) {
    return (
      <ScrollView
        accessibilityLabel={label}
        accessibilityRole="radiogroup"
        contentContainerStyle={styles.chips}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}
      >
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option}
              onPress={() => onChange(option)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {t(`units.${option}`, { defaultValue: option })}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    );
  }

  const valueError = fieldError?.field === "value" ? fieldError.text : null;
  const date = new Date(entry.datetime);
  const when = Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(date);

  return (
    <KeyboardAvoidingView behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.type}>
            {t(`mobileBrews.timeline.types.${entry.type}`, { defaultValue: t("mobileBrews.timeline.activity") })}
          </Text>
          {when ? <Text style={styles.hint}>{when}</Text> : null}
        </View>

        {!online ? (
          <Text accessibilityRole="alert" style={styles.banner}>{t("mobileBrews.editEntry.offline")}</Text>
        ) : null}

        {kind === "gravity" ? field(
          t("mobileBrews.addEntry.gravity.readingLabel"),
          input(t("mobileBrews.addEntry.gravity.readingLabel"), current.valueText, (valueText) => set({ valueText }), { numeric: true, invalid: Boolean(valueError) }),
          valueError,
          t("mobileBrews.editEntry.gravitySg")
        ) : null}

        {kind === "temperature" ? (
          <>
            {field(t("mobileBrews.addEntry.temperature.label"),
              input(t("mobileBrews.addEntry.temperature.label"), current.valueText, (valueText) => set({ valueText }), { numeric: true, invalid: Boolean(valueError) }),
              valueError)}
            {field(t("mobileBrews.addEntry.unitLabel"), chips(t("mobileBrews.addEntry.unitLabel"), ["F", "C"], current.unit, (unit) => set({ unit })))}
          </>
        ) : null}

        {kind === "ph" ? field(t("mobileBrews.addEntry.ph.label"),
          input(t("mobileBrews.addEntry.ph.label"), current.valueText, (valueText) => set({ valueText }), { numeric: true, invalid: Boolean(valueError) }),
          valueError) : null}

        {kind === "volume" ? (
          <>
            {field(t("mobileBrews.addEntry.volume.label"),
              input(t("mobileBrews.addEntry.volume.label"), current.valueText, (valueText) => set({ valueText }), { numeric: true, invalid: Boolean(valueError) }),
              valueError)}
            {field(t("mobileBrews.addEntry.unitLabel"), chips(t("mobileBrews.addEntry.unitLabel"), VOLUME_UNITS, current.unit, (unit) => set({ unit })))}
          </>
        ) : null}

        {kind === "addition" ? (
          <>
            {field(t("mobileBrews.addEntry.addition.nameLabel"),
              input(t("mobileBrews.addEntry.addition.nameLabel"), current.name, (name) => set({ name }), { invalid: fieldError?.field === "name" }),
              fieldError?.field === "name" ? fieldError.text : null)}
            {field(t("mobileBrews.addEntry.addition.amountLabel"),
              input(t("mobileBrews.addEntry.addition.amountLabel"), current.valueText, (valueText) => set({ valueText }), { numeric: true, invalid: Boolean(valueError) }),
              valueError)}
            {field(t("mobileBrews.addEntry.unitLabel"), chips(t("mobileBrews.addEntry.unitLabel"), additionEditUnits(initial.unit), current.unit, (unit) => set({ unit })))}
          </>
        ) : null}

        {kind === "text" && entry.type === "NOTE" ? field(t("mobileBrews.addEntry.text.titleLabel"),
          input(t("mobileBrews.addEntry.text.titleLabel"), current.title, (title) => set({ title }))) : null}

        {field(
          kind === "text" ? t("mobileBrews.addEntry.text.noteLabel") : t("mobileBrews.addEntry.noteLabel"),
          input(t("mobileBrews.addEntry.noteLabel"), current.note, (note) => set({ note }), { multiline: true, invalid: fieldError?.field === "note" }),
          fieldError?.field === "note" ? fieldError.text : null,
          kind === "noteOnly" ? t("mobileBrews.editEntry.noteOnly") : null
        )}

        {message ? (
          <View accessibilityLiveRegion="polite" style={styles.messageBox}>
            <Text accessibilityRole="alert" style={styles.error}>{message.text}</Text>
            {message.hint ? <Text style={styles.hint}>{message.hint}</Text> : null}
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: busy === "save", disabled: !online || busy !== null }}
          disabled={!online || busy !== null}
          onPress={() => void save()}
          style={({ pressed }) => [styles.button, (!online || busy !== null) && styles.disabled, pressed && styles.pressed]}
        >
          {busy === "save" ? <ActivityIndicator color={colors.onAccent} /> : (
            <Text style={styles.buttonText}>{t("mobileBrews.editEntry.save")}</Text>
          )}
        </Pressable>

        {canDeleteEntry(entry) ? (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ busy: busy === "delete", disabled: !online || busy !== null }}
            disabled={!online || busy !== null}
            onPress={confirmDelete}
            style={({ pressed }) => [styles.deleteButton, (!online || busy !== null) && styles.disabled, pressed && styles.pressed]}
          >
            {busy === "delete" ? <ActivityIndicator color={colors.error} /> : (
              <Text style={styles.deleteText}>{t("mobileBrews.editEntry.delete")}</Text>
            )}
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>{t("mobileBrews.editEntry.cancel")}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { gap: spacing.lg, padding: spacing.xl },
    centered: { alignItems: "center", flex: 1, justifyContent: "center", padding: spacing.xl, backgroundColor: colors.background },
    body: { color: colors.text, fontSize: typography.size.body, textAlign: "center" },
    type: { color: colors.text, fontSize: typography.size.action, fontWeight: typography.weight.bold },
    banner: {
      borderColor: colors.warning,
      borderRadius: radii.lg,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.caption,
      fontWeight: typography.weight.bold,
      padding: spacing.md
    },
    field: { gap: spacing.sm },
    label: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    input: {
      minHeight: 52,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      color: colors.text,
      fontSize: typography.size.body,
      paddingHorizontal: spacing.lg
    },
    noteInput: { minHeight: 96, paddingTop: spacing.md },
    inputInvalid: { borderColor: colors.error, borderWidth: 2 },
    chips: { gap: spacing.sm, paddingVertical: spacing.xs },
    chip: {
      borderColor: colors.border,
      borderRadius: radii.round,
      borderWidth: 1,
      backgroundColor: colors.surface,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: spacing.lg
    },
    chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    chipTextSelected: { color: colors.onAccent },
    hint: { color: colors.textMuted, fontSize: typography.size.caption },
    error: { color: colors.error, fontSize: typography.size.caption, fontWeight: typography.weight.bold },
    messageBox: { gap: spacing.xs },
    button: {
      minHeight: 52,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radii.lg,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl
    },
    buttonText: { color: colors.onAccent, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    deleteButton: {
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderColor: colors.error,
      borderRadius: radii.lg,
      borderWidth: 1
    },
    deleteText: { color: colors.error, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.8 },
    secondaryButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
    secondaryText: { color: colors.text, fontSize: typography.size.body }
  });
}
