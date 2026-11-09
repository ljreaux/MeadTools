import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import {
  STAGE_FLOW,
  stageMoveDecision,
  trackerStage,
  type StagePrerequisite,
  type TrackerStage
} from "@meadtools/brew-domain/stage-flow";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useBrewEntryOutbox, useBrewEntryOutboxRecords } from "@/outbox/entry-outbox-provider";
import {
  buildStageChangeInput,
  effectiveStage,
  hasPendingStageChange,
  stageContextFor
} from "@/outbox/stage-change";
import { useApiClient, useSession } from "@/providers/app-providers";

/** Shared web strings for each prerequisite. */
const PREREQUISITE_KEYS: Record<StagePrerequisite, { label: string; hint: string }> = {
  linkRecipe: { label: "brews.prereq.linkRecipe", hint: "brews.prereq.linkRecipeHardHint" },
  originalGravity: { label: "brews.prereq.originalGravity", hint: "brews.prereq.originalGravityHint" },
  packagingRecorded: { label: "brews.prereq.packagingRecorded", hint: "brews.prereq.packagingRecordedHint" },
  packagedVolume: { label: "brews.prereq.packagedVolume", hint: "brews.prereq.packagedVolumeHint" }
};

export default function ChangeStageScreen() {
  const params = useLocalSearchParams<{ brewId: string; name?: string }>();
  const brewId = params.brewId ?? "";
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t } = useTranslation();
  const apiClient = useApiClient();
  const { session } = useSession();
  const outbox = useBrewEntryOutbox();
  const records = useBrewEntryOutboxRecords(brewId);
  const [saving, setSaving] = useState<TrackerStage | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);

  // Shares the brew detail query, so the cached brew is used while offline.
  const brewQuery = useQuery({
    queryKey: ["brew", session?.id, brewId],
    queryFn: () => apiClient.getBrew(brewId),
    enabled: Boolean(session && brewId)
  });
  const brew = brewQuery.data;

  if (!outbox || !brewId) {
    return (
      <View style={styles.centered}>
        <Text accessibilityRole="alert" style={styles.body}>{t("mobileBrews.changeStage.unavailable")}</Text>
      </View>
    );
  }
  if (!brew) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const current = effectiveStage(brew.stage, records);
  const pending = hasPendingStageChange(records);
  const context = stageContextFor(brew, records);

  async function save(to: TrackerStage) {
    setSaving(to);
    setSaveFailed(false);
    try {
      await outbox!.enqueue(buildStageChangeInput({ brewId, to, from: current, measuredAt: new Date() }));
      router.back();
    } catch {
      setSaveFailed(true);
      setSaving(null);
    }
  }

  function confirm(to: TrackerStage) {
    const stageName = t(`brewStage.${to}`);
    Alert.alert(
      t("mobileBrews.changeStage.confirmTitle", { stage: stageName }),
      t(to === "COMPLETE" ? "mobileBrews.changeStage.confirmCompleteBody" : "mobileBrews.changeStage.confirmBody"),
      [
        { text: t("mobileBrews.changeStage.cancel"), style: "cancel" },
        { text: t("mobileBrews.changeStage.confirm"), onPress: () => void save(to) }
      ]
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      {params.name ? <Text style={styles.brewName}>{params.name}</Text> : null}
      {saveFailed ? (
        <Text accessibilityRole="alert" style={styles.error}>{t("mobileBrews.changeStage.saveFailed")}</Text>
      ) : null}

      <View accessibilityRole="list" style={styles.list}>
        {STAGE_FLOW.map((stage) => {
          const decision = stageMoveDecision(stage, current, context);
          const isCurrent = decision.isNoOp;
          const blocked = !isCurrent && !decision.allowed;
          const needs = decision.unmet.map((item) => t(PREREQUISITE_KEYS[item].label)).join(", ");
          const disabled = isCurrent || blocked || saving !== null;
          return (
            <Pressable
              accessibilityHint={blocked ? t("mobileBrews.changeStage.needs", { items: needs }) : undefined}
              accessibilityRole="button"
              accessibilityState={{ disabled, selected: isCurrent, busy: saving === stage }}
              disabled={disabled}
              key={stage}
              onPress={() => confirm(stage)}
              style={({ pressed }) => [
                styles.row,
                isCurrent && styles.rowCurrent,
                blocked && styles.rowBlocked,
                pressed && styles.pressed
              ]}
            >
              <View style={styles.rowTop}>
                <Text style={[styles.stageName, isCurrent && styles.stageNameCurrent]}>
                  {t(`brewStage.${stage}`)}
                </Text>
                {isCurrent ? (
                  <Text style={[styles.badge, styles.badgeCurrent]}>
                    {t(pending ? "mobileBrews.changeStage.pending" : "mobileBrews.changeStage.current")}
                  </Text>
                ) : saving === stage ? (
                  <ActivityIndicator color={colors.accent} />
                ) : null}
              </View>
              {isCurrent && current !== trackerStage(current) ? (
                <Text style={styles.hint}>{t(`brewStage.${current}`)}</Text>
              ) : null}
              {blocked ? (
                <>
                  <Text style={styles.needs}>{t("mobileBrews.changeStage.needs", { items: needs })}</Text>
                  <Text style={styles.hint}>{t(PREREQUISITE_KEYS[decision.unmet[0]].hint)}</Text>
                </>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint}>{t("mobileBrews.changeStage.equipmentNote")}</Text>
    </ScrollView>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    content: { gap: spacing.lg, padding: spacing.xl, backgroundColor: colors.background, flexGrow: 1 },
    centered: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      padding: spacing.xl,
      backgroundColor: colors.background
    },
    brewName: { color: colors.text, fontSize: typography.size.action, fontWeight: typography.weight.bold },
    body: { color: colors.text, fontSize: typography.size.body, textAlign: "center" },
    list: { gap: spacing.sm },
    row: {
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      backgroundColor: colors.surface,
      gap: spacing.xs,
      minHeight: 56,
      justifyContent: "center",
      padding: spacing.lg
    },
    rowCurrent: { borderColor: colors.accent, borderWidth: 2 },
    rowBlocked: { opacity: 0.7 },
    pressed: { opacity: 0.6 },
    rowTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
    stageName: { color: colors.text, flex: 1, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    stageNameCurrent: { color: colors.text },
    badge: {
      borderRadius: radii.round,
      fontSize: typography.size.caption,
      overflow: "hidden",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs
    },
    badgeCurrent: { backgroundColor: colors.accent, color: colors.onAccent },
    needs: { color: colors.text, fontSize: typography.size.caption, fontWeight: typography.weight.bold },
    hint: { color: colors.textMuted, fontSize: typography.size.caption },
    error: { color: colors.error, fontSize: typography.size.caption, fontWeight: typography.weight.bold }
  });
}
