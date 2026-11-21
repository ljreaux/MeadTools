import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import {
  brewSettingsChanges,
  brewSettingsDraft,
  canChangeBrewVisibility,
  type BrewSettingsDraft
} from "@meadtools/brew-domain/brew-settings";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { isConnectionError } from "@/api/errors";
import { brewDeleteOutboxState } from "@/brews/brew-delete";
import { DateTimeField } from "@/components/date-time-field";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useBrewEntryOutbox, useBrewEntryOutboxRecords } from "@/outbox/entry-outbox-provider";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useApiClient, useSession } from "@/providers/app-providers";

type SaveFailure = "offline" | "session" | "notFound" | "failed";

function failureFor(error: unknown): SaveFailure {
  if (isConnectionError(error)) return "offline";
  if (error instanceof MeadToolsApiError) {
    if (error.status === 401) return "session";
    if (error.status === 404) return "notFound";
  }
  return "failed";
}

export default function BrewSettingsScreen() {
  const params = useLocalSearchParams<{ brewId: string }>();
  const brewId = params.brewId ?? "";
  // A link can reuse this screen for another brew; remounting drops any
  // unsaved edits and errors from the previous one.
  return <BrewSettingsForm brewId={brewId} key={brewId} />;
}

function BrewSettingsForm({ brewId }: { brewId: string }) {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const online = useIsOnline();

  // Shares the brew detail query, so the screen opens from the cached brew.
  const brewQuery = useQuery({
    queryKey: ["brew", session?.id, brewId],
    queryFn: () => apiClient.getBrew(brewId),
    enabled: Boolean(session && brewId)
  });
  const brew = brewQuery.data;

  // Edited fields only; untouched fields follow the saved brew.
  const [edits, setEdits] = useState<Partial<BrewSettingsDraft>>({});
  const draft: BrewSettingsDraft | null = brew ? { ...brewSettingsDraft(brew), ...edits } : null;
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  const inFlight = useRef(false);

  const outbox = useBrewEntryOutbox();
  const outboxState = brewDeleteOutboxState(useBrewEntryOutboxRecords(brewId));
  const [deleteFailure, setDeleteFailure] = useState<SaveFailure | null>(null);
  const remove = useMutation({ mutationFn: () => apiClient.deleteBrew(brewId) });

  const save = useMutation({
    mutationFn: (changes: Parameters<typeof apiClient.updateBrew>[1]) =>
      apiClient.updateBrew(brewId, changes)
  });

  if (!brew || !draft) {
    return (
      <View style={styles.centered}>
        {brewQuery.isError ? (
          <Text accessibilityRole="alert" style={styles.body}>
            {t(isConnectionError(brewQuery.error) ? "mobileBrews.offlineBody" : "mobileBrews.detailError")}
          </Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }

  const result = brewSettingsChanges(brew, draft);
  const hasChanges = result.ok && Object.keys(result.changes).length > 0;
  const busy = save.isPending || remove.isPending;
  const canSave = hasChanges && online && !busy;
  const visibilityEditable = canChangeBrewVisibility(brew);
  const update = (patch: Partial<BrewSettingsDraft>) => {
    setFailure(null);
    setEdits((current) => ({ ...current, ...patch }));
  };

  async function submit() {
    if (!result.ok || !hasChanges || inFlight.current) return;
    inFlight.current = true;
    setFailure(null);
    try {
      await save.mutateAsync(result.changes);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["brew", session?.id, brewId] }),
        queryClient.invalidateQueries({ queryKey: ["brews", session?.id] })
      ]);
      router.back();
    } catch (error) {
      setFailure(failureFor(error));
    } finally {
      inFlight.current = false;
    }
  }

  async function deleteBrew() {
    if (inFlight.current) return;
    inFlight.current = true;
    setDeleteFailure(null);
    try {
      await remove.mutateAsync();
      // Entries that never reached the server would only fail against a deleted brew.
      for (const id of outboxState.unsentIds) await outbox?.discard(id).catch(() => false);
      await queryClient.invalidateQueries({ queryKey: ["brews", session?.id] });
      // Drop the deleted brew's cache once its detail screen has unmounted;
      // removing it while that screen is mounted makes it refetch (a 404).
      InteractionManager.runAfterInteractions(() => {
        queryClient.removeQueries({ queryKey: ["brew", session?.id, brewId] });
      });
      // Close this modal first; the brew list is in the Brews tab's own stack,
      // which only becomes the focused navigator once the modal is gone.
      router.dismiss();
      router.dismissTo("/brews");
    } catch (error) {
      setDeleteFailure(failureFor(error));
    } finally {
      inFlight.current = false;
    }
  }

  function confirmDelete() {
    const name = brew!.name?.trim() || brew!.recipe_name || t("mobileBrews.untitled");
    const unsent = outboxState.unsentIds.length;
    Alert.alert(
      t("brews.delete.title"),
      [
        t("brews.delete.description", { name }),
        unsent > 0 ? t("mobileBrews.delete.unsentEntries", { count: unsent }) : null
      ]
        .filter(Boolean)
        .join("\n\n"),
      [
        { text: t("cancel"), style: "cancel" },
        { text: t("brews.delete.confirm"), style: "destructive", onPress: () => void deleteBrew() }
      ]
    );
  }

  const canDelete = online && !busy && !outboxState.sending;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.field}>
        <Text style={styles.label}>{t("mobileBrews.newBrew.nameLabel")}</Text>
        <TextInput
          accessibilityLabel={t("mobileBrews.newBrew.nameLabel")}
          autoCorrect={false}
          clearButtonMode="while-editing"
          editable={!busy}
          onChangeText={(name) => update({ name })}
          placeholder={brew.recipe_name ?? t("mobileBrews.untitled")}
          placeholderTextColor={colors.placeholder}
          returnKeyType="done"
          style={styles.input}
          value={draft.name}
        />
        <Text style={styles.hint}>{t("mobileBrews.settings.nameHint")}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("mobileBrews.settings.batchLabel")}</Text>
        <TextInput
          accessibilityLabel={t("mobileBrews.settings.batchLabel")}
          editable={!busy}
          inputMode="numeric"
          keyboardType="number-pad"
          onChangeText={(batch) => update({ batch })}
          placeholder="1"
          placeholderTextColor={colors.placeholder}
          returnKeyType="done"
          style={styles.input}
          value={draft.batch}
        />
        {result.ok || result.error !== "batch" ? (
          <Text style={styles.hint}>{t("mobileBrews.settings.batchHint")}</Text>
        ) : (
          <Text accessibilityRole="alert" style={styles.error}>
            {t("mobileBrews.settings.batchInvalid")}
          </Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>{t("mobileBrews.settings.startLabel")}</Text>
        <DateTimeField
          disabled={busy}
          label={t("mobileBrews.settings.startLabel")}
          onChange={(startDate) => update({ startDate })}
          value={draft.startDate}
        />
      </View>

      <View style={styles.card}>
        <SettingSwitch
          description={t("mobileBrews.settings.emailAlertsHint")}
          disabled={busy}
          label={t("emailAlerts.title")}
          onValueChange={(emailAlerts) => update({ emailAlerts })}
          styles={styles}
          value={draft.emailAlerts}
        />
        <View style={styles.divider} />
        <SettingSwitch
          description={
            !visibilityEditable
              ? t("brews.visibility.recipeMustBePublic")
              : draft.public
                ? t("brews.visibility.publicDescription")
                : t("brews.visibility.privateDescription")
          }
          disabled={busy || (!visibilityEditable && !draft.public)}
          label={t("mobileBrews.settings.publicLabel")}
          onValueChange={(value) => update({ public: value })}
          styles={styles}
          value={draft.public}
        />
      </View>

      {!online ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {t("mobileBrews.settings.offline")}
        </Text>
      ) : null}
      {failure ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t(`mobileBrews.settings.errors.${failure}`)}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave, busy }}
        disabled={!canSave}
        onPress={() => void submit()}
        style={({ pressed }) => [
          styles.primaryButton,
          !canSave && styles.buttonDisabled,
          pressed && styles.pressed
        ]}
      >
        {busy ? <ActivityIndicator color={colors.onAccent} /> : null}
        <Text style={styles.primaryButtonText}>
          {save.isPending ? t("mobileBrews.settings.saving") : t("mobileBrews.settings.save")}
        </Text>
      </Pressable>

      <View style={styles.dangerZone}>
        {outboxState.sending ? (
          <Text style={styles.hint}>{t("mobileBrews.delete.sending")}</Text>
        ) : null}
        {deleteFailure ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {t(
              deleteFailure === "offline"
                ? "mobileBrews.delete.errors.offline"
                : deleteFailure === "session"
                  ? "mobileBrews.settings.errors.session"
                  : deleteFailure === "notFound"
                    ? "mobileBrews.settings.errors.notFound"
                    : "brews.delete.error"
            )}
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canDelete, busy: remove.isPending }}
          disabled={!canDelete}
          onPress={confirmDelete}
          style={({ pressed }) => [styles.deleteButton, !canDelete && styles.buttonDisabled, pressed && styles.pressed]}
        >
          {remove.isPending ? <ActivityIndicator color={colors.error} /> : null}
          <Text style={styles.deleteButtonText}>
            {remove.isPending ? t("brews.delete.deleting") : t("brews.delete.confirm")}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/** A labelled switch with an explanation; the whole row toggles it. */
function SettingSwitch({
  label,
  description,
  value,
  disabled,
  onValueChange,
  styles
}: {
  label: string;
  description: string;
  value: boolean;
  disabled: boolean;
  onValueChange: (next: boolean) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <Pressable
      accessibilityHint={description}
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={styles.switchRow}
    >
      <View style={styles.switchText}>
        <Text style={[styles.label, disabled && styles.disabledText]}>{label}</Text>
        <Text style={styles.hint}>{description}</Text>
      </View>
      <Switch
        accessibilityElementsHidden
        disabled={disabled}
        importantForAccessibility="no-hide-descendants"
        onValueChange={onValueChange}
        value={value}
      />
    </Pressable>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    content: { gap: spacing.lg, padding: spacing.xl },
    centered: {
      alignItems: "center",
      backgroundColor: colors.background,
      flex: 1,
      justifyContent: "center",
      padding: spacing.xl
    },
    field: { gap: spacing.sm },
    label: {
      color: colors.text,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold
    },
    body: { color: colors.textMuted, fontSize: typography.size.body, textAlign: "center" },
    hint: { color: colors.textMuted, fontSize: typography.size.caption },
    disabledText: { color: colors.textMuted },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.body,
      minHeight: 48,
      paddingHorizontal: spacing.lg
    },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      paddingHorizontal: spacing.lg
    },
    divider: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth },
    switchRow: {
      alignItems: "center",
      flexDirection: "row",
      gap: spacing.md,
      minHeight: 56,
      paddingVertical: spacing.md
    },
    switchText: { flex: 1, gap: spacing.xs },
    notice: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.body,
      padding: spacing.md
    },
    error: { color: colors.error, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.accent,
      borderRadius: radii.md,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing.xl
    },
    primaryButtonText: {
      color: colors.onAccent,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold
    },
    buttonDisabled: { opacity: 0.5 },
    dangerZone: {
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      marginTop: spacing.lg,
      paddingTop: spacing.lg
    },
    deleteButton: {
      alignItems: "center",
      borderColor: colors.error,
      borderRadius: radii.md,
      borderWidth: 1,
      flexDirection: "row",
      gap: spacing.sm,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing.xl
    },
    deleteButtonText: {
      color: colors.error,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold
    },
    pressed: { opacity: 0.7 }
  });
}
