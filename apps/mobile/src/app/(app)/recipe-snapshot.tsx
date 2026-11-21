import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import {
  recipeSnapshotChanges,
  recipeSnapshotContentKey,
  recipeSnapshotDiffers
} from "@meadtools/brew-domain/recipe-snapshot-diff";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { isConnectionError } from "@/api/errors";
import { useSourceRecipe } from "@/components/recipe-snapshot-status";
import { useIsOnline } from "@/hooks/useIsOnline";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useApiClient, useSession } from "@/providers/app-providers";

type UpdateFailure = "offline" | "session" | "changed" | "failed";

function failureFor(error: unknown): UpdateFailure {
  if (isConnectionError(error)) return "offline";
  if (error instanceof MeadToolsApiError) {
    if (error.status === 401) return "session";
    if (error.status === 409) return "changed";
  }
  return "failed";
}

export default function RecipeSnapshotScreen() {
  const params = useLocalSearchParams<{ brewId: string }>();
  const brewId = params.brewId ?? "";
  return <RecipeSnapshotUpdate brewId={brewId} key={brewId} />;
}

function RecipeSnapshotUpdate({ brewId }: { brewId: string }) {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const { session } = useSession();
  const queryClient = useQueryClient();
  const online = useIsOnline();
  const [failure, setFailure] = useState<UpdateFailure | null>(null);
  const inFlight = useRef(false);

  const brewQuery = useQuery({
    queryKey: ["brew", session?.id, brewId],
    queryFn: () => apiClient.getBrew(brewId),
    enabled: Boolean(session && brewId)
  });
  const brew = brewQuery.data;
  const snapshot = brew?.recipe_snapshot ?? null;
  const source = useSourceRecipe(brew?.recipe_id ?? null, Boolean(brew));

  const update = useMutation({
    mutationFn: () =>
      apiClient.updateBrew(brewId, {
        update_recipe_snapshot: true,
        expected_snapshotted_at: snapshot?.snapshottedAt ?? null,
        expected_recipe_content_key: recipeSnapshotContentKey(source.data!)
      })
  });

  if (!brew || !snapshot || source.isPending) {
    return (
      <View style={styles.centered}>
        {brewQuery.isError || (brew && !snapshot) ? (
          <Text accessibilityRole="alert" style={styles.body}>{t("brews.snapshot.unavailable")}</Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>
    );
  }

  const differs = Boolean(source.data && recipeSnapshotDiffers(snapshot, source.data));
  const changes = source.data ? recipeSnapshotChanges(snapshot, source.data) : [];
  const busy = update.isPending;
  const canUpdate = differs && online && !busy && !source.isFetching;

  async function confirm() {
    if (!canUpdate || inFlight.current) return;
    inFlight.current = true;
    setFailure(null);
    try {
      await update.mutateAsync();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["brew", session?.id, brewId] }),
        queryClient.invalidateQueries({ queryKey: ["brews", session?.id] }),
        queryClient.invalidateQueries({ queryKey: ["recipe", session?.id] })
      ]);
      router.back();
    } catch (error) {
      setFailure(failureFor(error));
      // The recipe or the snapshot may have moved on; show the current differences.
      void source.refetch();
      void brewQuery.refetch();
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Text accessibilityRole="header" style={styles.title}>{t("brews.snapshot.confirmTitle")}</Text>
      <Text style={styles.body}>{t("brews.snapshot.warning")}</Text>
      <Text style={styles.body}>{t("brews.snapshot.entriesRemain")}</Text>

      {source.isError ? (
        <Text accessibilityRole="alert" style={styles.notice}>
          {isConnectionError(source.error) ? t("mobileBrews.snapshot.offline") : t("brews.snapshot.unavailable")}
        </Text>
      ) : !differs ? (
        <Text style={styles.notice}>{t("brews.snapshot.upToDate")}</Text>
      ) : changes.length > 0 ? (
        <View accessibilityRole="list" style={styles.card}>
          <Text style={styles.label}>{t("brews.snapshot.changedSections")}</Text>
          {changes.map((change) => (
            <Text key={change} style={styles.item}>
              {"• "}
              {t(change === "name" ? "brews.snapshot.name" : `brews.snapshot.sections.${change}`)}
            </Text>
          ))}
        </View>
      ) : null}

      {!online ? (
        <Text accessibilityRole="alert" style={styles.notice}>{t("mobileBrews.snapshot.needsConnection")}</Text>
      ) : null}
      {failure ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t(
            failure === "offline"
              ? "mobileBrews.snapshot.errors.offline"
              : failure === "session"
                ? "mobileBrews.snapshot.errors.session"
                : failure === "changed"
                  ? "mobileBrews.snapshot.errors.changed"
                  : "brews.snapshot.failed"
          )}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canUpdate, busy }}
        disabled={!canUpdate}
        onPress={() => void confirm()}
        style={({ pressed }) => [styles.primaryButton, !canUpdate && styles.disabled, pressed && styles.pressed]}
      >
        {busy ? <ActivityIndicator color={colors.onAccent} /> : null}
        <Text style={styles.primaryButtonText}>
          {busy ? t("mobileBrews.settings.saving") : t("brews.snapshot.confirm")}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => router.back()}
        style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}
      >
        <Text style={styles.textButtonLabel}>{t("cancel")}</Text>
      </Pressable>
    </ScrollView>
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
    title: { color: colors.text, fontSize: typography.size.title, fontWeight: typography.weight.bold },
    body: { color: colors.textMuted, fontSize: typography.size.body },
    label: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    item: { color: colors.text, fontSize: typography.size.body },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.lg
    },
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
    primaryButtonText: { color: colors.onAccent, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    disabled: { opacity: 0.5 },
    textButton: { alignSelf: "center", justifyContent: "center", minHeight: 44 },
    textButtonLabel: { color: colors.accent, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    pressed: { opacity: 0.7 }
  });
}
