import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import {
  projectBrewOverview,
  projectBrewTimeline,
  projectBrewView,
  type BrewTimelineItem
} from "@meadtools/brew-domain";
import { toBrix } from "@meadtools/core/gravity";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { isConnectionError as isConnectionFailure } from "@/api/errors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { DevOutboxPanel } from "@/outbox/dev-outbox-panel";
import { useBrewEntryOutbox, useBrewEntryOutboxRecords } from "@/outbox/entry-outbox-provider";
import { effectiveStage, hasPendingStageChange } from "@/outbox/stage-change";
import {
  mergeTimelineWithOutbox,
  type DeliveryTone,
  type TimelineRow
} from "@/outbox/timeline-delivery";
import { useApiClient, useSession } from "@/providers/app-providers";

export default function BrewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const apiClient = useApiClient();
  const { session, signOut } = useSession();
  const brewQuery = useQuery({
    queryKey: ["brew", session?.id, id],
    queryFn: () => apiClient.getBrew(id),
    enabled: Boolean(session && id)
  });
  const apiError = brewQuery.error instanceof MeadToolsApiError ? brewQuery.error : null;
  const isConnectionError = isConnectionFailure(brewQuery.error);
  const hideStaleBrew =
    brewQuery.isError &&
    apiError !== null &&
    [401, 403, 404].includes(apiError.status);
  const brew = useMemo(
    () => brewQuery.data && !hideStaleBrew ? projectBrewView(brewQuery.data) : null,
    [brewQuery.data, hideStaleBrew]
  );
  const overview = useMemo(() => brew ? projectBrewOverview(brew) : null, [brew]);
  const timeline = useMemo(() => brew ? projectBrewTimeline(brew) : [], [brew]);
  const outbox = useBrewEntryOutbox();
  const outboxRecords = useBrewEntryOutboxRecords(id);
  const currentStage = brew ? effectiveStage(brew.stage, outboxRecords) : null;
  const stagePending = hasPendingStageChange(outboxRecords);
  const rows = useMemo(
    () => mergeTimelineWithOutbox(timeline, outboxRecords, brew?.stage ?? null),
    [brew?.stage, outboxRecords, timeline]
  );
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const timelineNumber = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 });

  function formatGravity(value: number | null, unit: "SG" | "BRIX") {
    if (value === null) return t("mobileBrews.notRecorded");
    if (unit === "BRIX") return `${number.format(toBrix(value))} °Bx`;
    return `${new Intl.NumberFormat(i18n.language, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3
    }).format(value)} SG`;
  }

  function metric(label: string, value: string) {
    return (
      <View style={styles.metric}>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    );
  }

  function formatTimelineDetail(item: BrewTimelineItem): string | null {
    const detail = item.detail;
    if (!detail) return null;
    switch (detail.kind) {
      case "gravity":
        return `${t(`mobileBrews.timeline.roles.${detail.role}`)}: ${formatGravity(detail.value, brew?.gravity_unit_preference ?? "SG")}`;
      case "temperature":
        return `${timelineNumber.format(detail.value)} °${detail.unit}`;
      case "ph":
        return `pH ${timelineNumber.format(detail.value)}`;
      case "volume":
        return `${timelineNumber.format(detail.value)} ${detail.unit}${detail.packages !== null
          ? ` · ${t("mobileBrews.timeline.packages", { count: detail.packages })}` : ""}`;
      case "addition": {
        const amount = detail.amount === null ? null :
          `${timelineNumber.format(detail.amount)}${detail.unit ? ` ${detail.unit}` : ""}`;
        return [detail.name, amount].filter(Boolean).join(" · ") || null;
      }
      case "stage":
        return detail.to
          ? `${detail.from ? `${t(`brewStage.${detail.from}`)} → ` : ""}${t(`brewStage.${detail.to}`)}`
          : null;
    }
  }

  function toneColor(tone: DeliveryTone) {
    switch (tone) {
      case "pending": return colors.textMuted;
      case "warning": return colors.warning;
      case "error": return colors.error;
      case "success": return colors.success;
    }
  }

  function confirmDiscard(clientEntryId: string) {
    Alert.alert(
      t("mobileBrews.delivery.discardTitle"),
      t("mobileBrews.delivery.discardBody"),
      [
        { text: t("mobileBrews.delivery.discardCancel"), style: "cancel" },
        {
          text: t("mobileBrews.delivery.discard"),
          style: "destructive",
          onPress: () => void outbox?.discard(clientEntryId)
        }
      ]
    );
  }

  function renderDelivery(row: Extract<TimelineRow, { kind: "local" }>) {
    const { delivery, record } = row;
    return (
      <View style={styles.delivery}>
        <View accessibilityLiveRegion="polite" style={styles.deliveryStatus}>
          {delivery.busy ? (
            <ActivityIndicator color={colors.textMuted} size="small" />
          ) : (
            <View style={[styles.deliveryDot, { backgroundColor: toneColor(delivery.tone) }]} />
          )}
          <Text style={styles.deliveryText}>
            {t(`mobileBrews.delivery.status.${delivery.message}`)}
          </Text>
        </View>
        {delivery.canRetry || delivery.canDiscard ? (
          <View style={styles.deliveryActions}>
            {delivery.canRetry ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void outbox?.retry(record.clientEntryId)}
                style={({ pressed }) => [styles.deliveryButton, pressed && styles.pressed]}
              >
                <Text style={styles.deliveryButtonText}>{t("mobileBrews.delivery.retry")}</Text>
              </Pressable>
            ) : null}
            {delivery.canDiscard ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => confirmDiscard(record.clientEntryId)}
                style={({ pressed }) => [styles.deliveryButton, pressed && styles.pressed]}
              >
                <Text style={styles.deliveryButtonText}>{t("mobileBrews.delivery.discard")}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    );
  }

  function renderTimelineRow({ item: row }: { item: TimelineRow }) {
    const item: BrewTimelineItem = row.item;
    const date = new Date(item.datetime);
    const timestamp = Number.isNaN(date.getTime())
      ? t("mobileBrews.timeline.dateUnavailable")
      : new Intl.DateTimeFormat(i18n.language, {
          dateStyle: "medium", timeStyle: "short"
        }).format(date);
    const typeKey = `mobileBrews.timeline.types.${item.type}`;
    const typeLabel = t(typeKey, { defaultValue: t("mobileBrews.timeline.activity") });
    const detail = formatTimelineDetail(item);
    const showTitle = item.title && !detail && item.title !== typeLabel;

    const pressable = row.kind !== "local" && Boolean(outbox) && Boolean(brew);
    const content = (
      <>
        {/* Screen readers read an entry's summary as one item. Pressable rows
            already group their content; local rows keep their delivery
            buttons reachable outside the summary. */}
        <View accessible={!pressable} style={styles.timelineSummary}>
          <View style={styles.timelineTop}>
            <Text style={styles.timelineType}>{typeLabel}</Text>
            <Text style={styles.timelineDate}>{timestamp}</Text>
          </View>
          {item.stage ? <Text style={styles.timelineStage}>{t(`brewStage.${item.stage}`)}</Text> : null}
          {detail ? <Text style={styles.timelineDetail}>{detail}</Text> : null}
          {showTitle ? <Text style={styles.timelineDetail}>{item.title}</Text> : null}
          {item.note ? <Text style={styles.timelineNote}>{item.note}</Text> : null}
        </View>
        {row.kind === "local" ? renderDelivery(row) : null}
      </>
    );
    if (!pressable || !brew) {
      return <View style={[styles.timelineRow, row.kind === "local" && styles.timelineRowLocal]}>{content}</View>;
    }
    // Saved entries open the online edit screen.
    return (
      <Pressable
        accessibilityHint={t("mobileBrews.editEntry.openHint")}
        accessibilityRole="button"
        onPress={() => {
          const params = { brewId: brew.id, entryId: item.id };
          if (item.type === "PACKAGING") router.push({ pathname: "/bottling", params });
          else router.push({ pathname: "/edit-entry", params });
        }}
        style={({ pressed }) => [styles.timelineRow, pressed && styles.pressed]}
      >
        {content}
      </Pressable>
    );
  }

  if (!brew || !overview) {
    const status = apiError?.status ?? null;
    const errorBody = apiError?.body ?? null;
    const isMissingUser =
      status === 404 &&
      errorBody !== null &&
      typeof errorBody === "object" &&
      "error" in errorBody &&
      errorBody.error === "User not found";
    const isSessionError = status === 401 || status === 403 || isMissingUser;
    const isNotFound = !id || (status === 404 && !isMissingUser);
    const titleKey = isSessionError
      ? "mobileBrews.sessionExpiredTitle"
      : isNotFound
        ? "mobileBrews.notFoundTitle"
        : isConnectionError
          ? "mobileBrews.offlineTitle"
          : "mobileBrews.detailError";
    const bodyKey = isSessionError
      ? "mobileBrews.sessionExpiredBody"
      : isNotFound
        ? "mobileBrews.notFoundBody"
        : isConnectionError
          ? "mobileBrews.offlineBody"
          : "mobileBrews.errorBody";
    return (
      <View style={styles.status}>
        {brewQuery.isPending && brewQuery.isFetching ? (
          <>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.muted}>{t("mobileBrews.detailLoading")}</Text>
          </>
        ) : (
          <>
            <Text accessibilityRole="alert" style={styles.heading}>
              {t(titleKey)}
            </Text>
            <Text style={styles.statusBody}>{t(bodyKey)}</Text>
            {!isNotFound ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void (isSessionError ? signOut() : brewQuery.refetch())}
                style={styles.retryButton}
              >
                <Text style={styles.retryText}>
                  {t(isSessionError ? "mobileBrews.signInAgain" : "mobileBrews.retry")}
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    );
  }

  const name = brew.name?.trim() || overview.recipeName || t("mobileBrews.untitled");
  const date = new Date(brew.start_date);
  const started = Number.isNaN(date.getTime())
    ? null
    : new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(date);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={renderTimelineRow}
      ItemSeparatorComponent={TimelineSeparator}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      onRefresh={() => void brewQuery.refetch()}
      refreshing={brewQuery.isRefetching}
      ListHeaderComponent={<View style={styles.timelineHeader}>
      {brewQuery.isError ? (
        <View accessibilityRole="alert" style={styles.errorBanner}>
          <Text style={styles.sectionHeading}>
            {t(isConnectionError ? "mobileBrews.offlineTitle" : "mobileBrews.detailError")}
          </Text>
          <Text style={styles.statusBody}>
            {t(isConnectionError ? "mobileBrews.offlineBody" : "mobileBrews.errorBody")}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void brewQuery.refetch()}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>{t("mobileBrews.retry")}</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.heading}>{name}</Text>
        <View style={styles.stageRow}>
          <Text style={styles.stage}>{t(`brewStage.${currentStage}`)}</Text>
          {stagePending ? (
            <Text style={styles.muted}>{t("mobileBrews.changeStage.pending")}</Text>
          ) : null}
        </View>
        {started ? <Text style={styles.muted}>{t("mobileBrews.started", { date: started })}</Text> : null}
        {brew.batch_number !== null ? (
          <Text style={styles.muted}>{t("mobileBrews.batch", { number: brew.batch_number })}</Text>
        ) : null}
        {outbox && currentStage !== "COMPLETE" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({
              pathname: "/add-entry",
              params: { brewId: brew.id, name, unit: brew.gravity_unit_preference, stage: currentStage }
            })}
            style={({ pressed }) => [styles.recordButton, pressed && styles.pressed]}
          >
            <Text style={styles.recordButtonText}>{t("mobileBrews.addEntry.action")}</Text>
          </Pressable>
        ) : null}
        {outbox && currentStage !== "COMPLETE" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({
              pathname: "/add-entry", params: { brewId: brew.id, name, stage: currentStage, type: "ADDITION", planned: "1" }
            })}
            style={({ pressed }) => [styles.stageButton, pressed && styles.pressed]}
          >
            <Text style={styles.stageButtonText}>{t("mobileBrews.plannedAdditions.title")}</Text>
          </Pressable>
        ) : null}
        {currentStage !== "COMPLETE" ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/bottling", params: { brewId: brew.id } })}
            style={({ pressed }) => [styles.stageButton, pressed && styles.pressed]}
          >
            <Text style={styles.stageButtonText}>{t("mobileBrews.bottling.action")}</Text>
          </Pressable>
        ) : null}
        {outbox ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: "/change-stage", params: { brewId: brew.id, name } })}
            style={({ pressed }) => [styles.stageButton, pressed && styles.pressed]}
          >
            <Text style={styles.stageButtonText}>{t("mobileBrews.changeStage.action")}</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/brew-settings", params: { brewId: brew.id } })}
          style={({ pressed }) => [styles.stageButton, pressed && styles.pressed]}
        >
          <Text style={styles.stageButtonText}>{t("mobileBrews.settings.action")}</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionHeading}>{t("mobileBrews.overview")}</Text>
        <View style={styles.metricGrid}>
          {metric(
            t("mobileBrews.currentVolume"),
            overview.currentVolumeLiters === null
              ? t("mobileBrews.notRecorded")
              : t("mobileBrews.volume", { value: number.format(overview.currentVolumeLiters) })
          )}
          {metric(t("mobileBrews.latestGravity"), formatGravity(overview.latestGravity, brew.gravity_unit_preference))}
          {metric(
            t("mobileBrews.targetVolume"),
            overview.targetVolumeLiters === null
              ? t("mobileBrews.notRecorded")
              : t("mobileBrews.volume", { value: number.format(overview.targetVolumeLiters) })
          )}
          {metric(t("mobileBrews.targetOg"), formatGravity(overview.targetOg, brew.gravity_unit_preference))}
          {metric(t("mobileBrews.targetFg"), formatGravity(overview.targetFg, brew.gravity_unit_preference))}
        </View>
      </View>

      <View style={styles.card}>
        <Text accessibilityRole="header" style={styles.sectionHeading}>{t("brews.recipe")}</Text>
        <Text style={styles.recipeName}>{overview.recipeName ?? t("noRecipe")}</Text>
        {overview.ingredients.length > 0 ? (
          <>
            <Text style={styles.sectionHeading}>{t("mobileBrews.ingredients")}</Text>
            {overview.ingredients.map((ingredient) => (
              <View key={ingredient.id} style={styles.ingredientRow}>
                <Text style={styles.ingredientName}>{ingredient.name}</Text>
                <Text style={styles.muted}>{ingredient.amount} {ingredient.unit}</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.muted}>{t("mobileBrews.recipeDetailsUnavailable")}</Text>
        )}
      </View>
      {__DEV__ ? (
        <DevOutboxPanel
          brewId={brew.id}
          serverEntryIds={brew.entries.map((entry) => entry.id)}
        />
      ) : null}
      <Text accessibilityRole="header" style={styles.sectionHeading}>{t("mobileBrews.timeline.heading")}</Text>
      </View>}
      ListEmptyComponent={
        <View style={styles.card}>
          <Text style={styles.muted}>{t("mobileBrews.timeline.empty")}</Text>
        </View>
      }
    />
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    content: {
      gap: spacing.lg,
      padding: spacing.xl,
      backgroundColor: colors.background
    },
    header: { gap: spacing.sm, marginBottom: spacing.sm },
    status: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      gap: spacing.md,
      padding: spacing.xl,
      backgroundColor: colors.background
    },
    heading: {
      color: colors.text,
      fontSize: typography.size.title,
      fontWeight: typography.weight.bold
    },
    statusBody: { color: colors.textMuted, fontSize: typography.size.body, textAlign: "center" },
    errorBanner: {
      alignItems: "center",
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.md,
      padding: spacing.lg
    },
    stage: {
      alignSelf: "flex-start",
      color: colors.onAccent,
      backgroundColor: colors.accent,
      borderRadius: radii.round,
      overflow: "hidden",
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    muted: { color: colors.textMuted, fontSize: typography.size.body },
    card: {
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      backgroundColor: colors.surface,
      gap: spacing.md,
      padding: spacing.lg
    },
    sectionHeading: { color: colors.text, fontSize: typography.size.action, fontWeight: typography.weight.bold },
    metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    metric: { minWidth: "45%", flexGrow: 1, gap: spacing.xs },
    metricLabel: { color: colors.textMuted, fontSize: typography.size.caption },
    metricValue: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    recipeName: { color: colors.text, fontSize: typography.size.body },
    ingredientRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
    ingredientName: { color: colors.text, flex: 1, fontSize: typography.size.body },
    timelineHeader: { gap: spacing.lg, marginBottom: spacing.lg },
    timelineRow: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.lg
    },
    timelineSummary: { gap: spacing.xs },
    timelineTop: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: spacing.sm },
    timelineType: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    timelineDate: { color: colors.textMuted, fontSize: typography.size.caption },
    timelineStage: { color: colors.textMuted, fontSize: typography.size.caption },
    timelineDetail: { color: colors.text, fontSize: typography.size.body },
    timelineNote: { color: colors.textMuted, fontSize: typography.size.body },
    retryButton: {
      borderRadius: radii.md,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md
    },
    retryText: { color: colors.onAccent, fontWeight: typography.weight.bold },
    pressed: { opacity: 0.7 },
    recordButton: {
      alignItems: "center",
      borderRadius: radii.lg,
      backgroundColor: colors.accent,
      justifyContent: "center",
      marginTop: spacing.sm,
      minHeight: 48,
      paddingHorizontal: spacing.xl
    },
    recordButtonText: { color: colors.onAccent, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    stageRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    stageButton: {
      alignItems: "center",
      borderColor: colors.accent,
      borderRadius: radii.lg,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 48,
      paddingHorizontal: spacing.xl
    },
    stageButtonText: { color: colors.text, fontSize: typography.size.body, fontWeight: typography.weight.bold },
    timelineRowLocal: { borderStyle: "dashed" },
    delivery: { gap: spacing.sm, marginTop: spacing.xs },
    deliveryStatus: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
    deliveryDot: { borderRadius: radii.round, height: 10, width: 10 },
    deliveryText: { color: colors.text, flex: 1, fontSize: typography.size.caption, fontWeight: typography.weight.bold },
    deliveryActions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    deliveryButton: {
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      minHeight: 40,
      justifyContent: "center",
      paddingHorizontal: spacing.md
    },
    deliveryButtonText: { color: colors.text, fontSize: typography.size.caption, fontWeight: typography.weight.bold }
  });
}

const separatorStyles = StyleSheet.create({ timeline: { height: spacing.sm } });

// A stable component type, so separators are not remounted on every render.
function TimelineSeparator() {
  return <View style={separatorStyles.timeline} />;
}
