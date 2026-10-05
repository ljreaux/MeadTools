import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import {
  isActiveBrew,
  projectBrewViewListItem,
  type BrewViewListItem
} from "@meadtools/brew-domain";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useApiClient, useSession } from "@/providers/app-providers";

export default function BrewsScreen() {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const apiClient = useApiClient();
  const { session, signOut } = useSession();
  const brewsQuery = useQuery({
    queryKey: ["brews", session?.id],
    queryFn: () => apiClient.listBrews(),
    enabled: Boolean(session),
    select: (brews) => brews.map(projectBrewViewListItem).filter(isActiveBrew)
  });
  const isSessionError =
    brewsQuery.error instanceof MeadToolsApiError &&
    brewsQuery.error.status === 401;
  const isConnectionError = brewsQuery.error instanceof TypeError;
  const brews = isSessionError ? [] : (brewsQuery.data ?? []);

  function renderStatus() {
    if (brewsQuery.isPending) {
      return (
        <View style={styles.status}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.statusBody}>{t("mobileBrews.loading")}</Text>
        </View>
      );
    }

    if (brewsQuery.isError) {
      return (
        <View
          accessibilityRole="alert"
          style={[styles.status, brews.length > 0 && styles.statusBanner]}
        >
          <Text style={styles.statusTitle}>
            {t(
              isSessionError
                ? "mobileBrews.sessionExpiredTitle"
                : isConnectionError
                  ? "mobileBrews.offlineTitle"
                  : "mobileBrews.errorTitle"
            )}
          </Text>
          <Text style={styles.statusBody}>
            {t(
              isSessionError
                ? "mobileBrews.sessionExpiredBody"
                : isConnectionError
                  ? "mobileBrews.offlineBody"
                  : "mobileBrews.errorBody"
            )}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void (isSessionError ? signOut() : brewsQuery.refetch())}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>
              {t(isSessionError ? "mobileBrews.signInAgain" : "mobileBrews.retry")}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.status}>
        <Text style={styles.statusTitle}>{t("mobileBrews.emptyTitle")}</Text>
        <Text style={styles.statusBody}>{t("mobileBrews.emptyBody")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void brewsQuery.refetch()}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>{t("mobileBrews.refresh")}</Text>
        </Pressable>
      </View>
    );
  }

  function renderBrew({ item: brew }: { item: BrewViewListItem }) {
    const name = brew.name?.trim() || brew.recipe_name || t("mobileBrews.untitled");
    const volume = brew.current_volume_liters;

    return (
      <Link asChild href={{ pathname: "/brews/[id]", params: { id: brew.id } }}>
        <Pressable
          accessibilityLabel={t("mobileBrews.openBrew", { name })}
          accessibilityRole="link"
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={styles.cardHeading}>
            <Text numberOfLines={2} style={styles.brewName}>
              {name}
            </Text>
            <Text style={styles.stage}>{t(`brewStage.${brew.stage}`)}</Text>
          </View>
          {brew.recipe_name && brew.recipe_name !== name ? (
            <Text numberOfLines={1} style={styles.detailText}>
              {brew.recipe_name}
            </Text>
          ) : null}
          <View style={styles.metadata}>
            {volume !== null ? (
              <Text style={styles.detailText}>
                {t("mobileBrews.volume", {
                  value: new Intl.NumberFormat(i18n.language, {
                    maximumFractionDigits: 1
                  }).format(volume)
                })}
              </Text>
            ) : null}
            <Text style={styles.detailText}>
              {t("mobileBrews.entries", { count: brew.entry_count })}
            </Text>
          </View>
        </Pressable>
      </Link>
    );
  }

  return (
    <FlatList
      contentContainerStyle={[styles.content, brews.length === 0 && styles.emptyContent]}
      contentInsetAdjustmentBehavior="automatic"
      data={brews}
      keyExtractor={(brew) => brew.id}
      ListEmptyComponent={renderStatus}
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <View>
              <Text accessibilityRole="header" style={styles.heading}>
                {t("brews.label")}
              </Text>
              {!brewsQuery.isPending && !brewsQuery.isError ? (
                <Text style={styles.count}>
                  {t("mobileBrews.activeCount", { count: brews.length })}
                </Text>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => void signOut()}
              style={styles.signOutButton}
            >
              <Text style={styles.signOutText}>{t("account.logout")}</Text>
            </Pressable>
          </View>
          {brews.length > 0 && brewsQuery.isError ? renderStatus() : null}
        </View>
      }
      onRefresh={() => void brewsQuery.refetch()}
      refreshing={brewsQuery.isRefetching}
      renderItem={renderBrew}
      style={styles.list}
    />
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    list: { backgroundColor: colors.background },
    content: {
      gap: spacing.md,
      padding: spacing.xl
    },
    emptyContent: { flexGrow: 1 },
    header: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.md,
      marginBottom: spacing.md
    },
    heading: {
      color: colors.text,
      fontSize: typography.size.title,
      fontWeight: typography.weight.bold
    },
    count: {
      color: colors.textMuted,
      fontSize: typography.size.caption,
      marginTop: spacing.xs
    },
    signOutButton: {
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    signOutText: { color: colors.text, fontSize: typography.size.caption },
    card: {
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      backgroundColor: colors.surface,
      gap: spacing.sm,
      padding: spacing.lg
    },
    cardPressed: { opacity: 0.7 },
    cardHeading: {
      alignItems: "flex-start",
      flexDirection: "row",
      justifyContent: "space-between",
      gap: spacing.md
    },
    brewName: {
      color: colors.text,
      flex: 1,
      fontSize: typography.size.action,
      fontWeight: typography.weight.bold
    },
    stage: {
      color: colors.onAccent,
      backgroundColor: colors.accent,
      borderRadius: radii.round,
      fontSize: typography.size.caption,
      overflow: "hidden",
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs
    },
    metadata: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
    detailText: { color: colors.textMuted, fontSize: typography.size.caption },
    status: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      gap: spacing.md,
      paddingVertical: spacing.xxl
    },
    statusBanner: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      flex: 0,
      marginBottom: spacing.md,
      padding: spacing.lg
    },
    statusTitle: {
      color: colors.text,
      fontSize: typography.size.action,
      fontWeight: typography.weight.bold,
      textAlign: "center"
    },
    statusBody: {
      color: colors.textMuted,
      fontSize: typography.size.body,
      textAlign: "center"
    },
    retryButton: {
      borderRadius: radii.md,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md
    },
    retryText: { color: colors.onAccent, fontWeight: typography.weight.bold }
  });
}
