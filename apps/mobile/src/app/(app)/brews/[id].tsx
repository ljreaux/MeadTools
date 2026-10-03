import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import { projectBrewOverview, projectBrewView } from "@meadtools/brew-domain";
import { toBrix } from "@meadtools/core/gravity";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useThemeColors } from "@/hooks/useThemeColors";
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
  const hideStaleBrew =
    brewQuery.isError &&
    apiError !== null &&
    [401, 403, 404].includes(apiError.status);
  const brew = useMemo(
    () => brewQuery.data && !hideStaleBrew ? projectBrewView(brewQuery.data) : null,
    [brewQuery.data, hideStaleBrew]
  );
  const overview = useMemo(() => brew ? projectBrewOverview(brew) : null, [brew]);
  const number = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });

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
    const isConnectionError = brewQuery.error instanceof TypeError;
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
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.header}>
        <Text accessibilityRole="header" style={styles.heading}>{name}</Text>
        <Text style={styles.stage}>{t(`brewStage.${brew.stage}`)}</Text>
        {started ? <Text style={styles.muted}>{t("mobileBrews.started", { date: started })}</Text> : null}
        {brew.batch_number !== null ? (
          <Text style={styles.muted}>{t("mobileBrews.batch", { number: brew.batch_number })}</Text>
        ) : null}
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
    </ScrollView>
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
    retryButton: {
      borderRadius: radii.md,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md
    },
    retryText: { color: colors.onAccent, fontWeight: typography.weight.bold }
  });
}
