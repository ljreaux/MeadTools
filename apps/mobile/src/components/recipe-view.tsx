import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import { radii, spacing, typography } from "@meadtools/design-tokens";

import { isConnectionError } from "@/api/errors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useSession } from "@/providers/app-providers";

export function RecipeLoadStatus({
  loading = false,
  error,
  message,
  retry
}: {
  loading?: boolean;
  error?: unknown;
  message: string;
  retry?: () => void;
}) {
  const { colors, styles } = useRecipeStyles();
  const { t } = useTranslation();
  const { signOut } = useSession();
  const status = error instanceof MeadToolsApiError ? error.status : null;
  const expired = status === 401;
  const unavailable = status === 403 || status === 404;
  let description = message;
  if (loading) description = t("mobileRecipes.loading");
  else if (expired) description = t("mobileRecipes.sessionExpired");
  else if (unavailable) description = t("mobileRecipes.unavailable");
  else if (isConnectionError(error)) description = t("mobileRecipes.offline");

  return (
    <View style={styles.card}>
      {loading ? <ActivityIndicator color={colors.accent} /> : null}
      <Text accessibilityRole={error ? "alert" : undefined} style={styles.body}>
        {description}
      </Text>
      {expired || (error && retry && !unavailable) ? (
        <Pressable
          accessibilityRole="button"
          onPress={expired ? () => void signOut() : retry}
          style={styles.action}
        >
          <Text style={[styles.heading, { color: colors.accent }]}>
            {t(expired ? "mobileBrews.signInAgain" : "mobileBrews.retry")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** A titled card for one part of a recipe, with an optional item count. */
export function RecipeSection({
  title,
  count,
  children
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  const { styles } = useRecipeStyles();
  const { i18n } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <Text accessibilityRole="header" style={[styles.heading, styles.flexText]}>{title}</Text>
        {count !== undefined ? (
          <Text style={styles.caption}>{new Intl.NumberFormat(i18n.language).format(count)}</Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * One line of a recipe: the item on the left and its amount on the right, so a
 * long list stays one row per item. Wraps below the label when space runs out.
 */
export function RecipeRow({
  label,
  value,
  detail,
  first = false
}: {
  label: string;
  value?: string | null;
  detail?: string | null;
  first?: boolean;
}) {
  const { styles } = useRecipeStyles();
  return (
    <View accessible style={[styles.row, !first && styles.rowDivider]}>
      <View style={styles.rowLabel}>
        <Text style={styles.body}>{label}</Text>
        {detail ? <Text style={styles.caption}>{detail}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
    </View>
  );
}

export type RecipeStat = { key: string; label: string; value: string | null };

/** Headline estimates as a grid of tiles, readable at a glance. */
export function RecipeStatGrid({ stats, unavailable }: { stats: readonly RecipeStat[]; unavailable: string }) {
  const { styles } = useRecipeStyles();
  return (
    <View style={styles.statGrid}>
      {stats.map(({ key, label, value }) => (
        <View
          accessible
          accessibilityLabel={`${label}: ${value ?? unavailable}`}
          key={key}
          style={styles.stat}
        >
          <Text adjustsFontSizeToFit numberOfLines={1} style={styles.statValue}>{value ?? "—"}</Text>
          <Text style={styles.caption}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export function useRecipeStyles() {
  const { colors } = useThemeColors();
  const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { gap: spacing.md, padding: spacing.lg },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.lg,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.lg
    },
    pressed: { opacity: 0.7 },
    sectionHeader: { alignItems: "baseline", flexDirection: "row", gap: spacing.sm },
    flexText: { flex: 1 },
    caption: { color: colors.textMuted, fontSize: typography.size.caption },
    row: {
      alignItems: "flex-start",
      columnGap: spacing.md,
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      paddingVertical: spacing.sm
    },
    rowDivider: { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
    rowLabel: { flexBasis: "55%", flexGrow: 1, flexShrink: 1, gap: 2 },
    rowValue: {
      color: colors.text,
      flexShrink: 0,
      fontSize: typography.size.body,
      fontVariant: ["tabular-nums"],
      fontWeight: typography.weight.bold,
      marginLeft: "auto",
      textAlign: "right"
    },
    statGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    stat: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: StyleSheet.hairlineWidth,
      flexBasis: "30%",
      flexGrow: 1,
      gap: 2,
      minWidth: 96,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm
    },
    statValue: {
      color: colors.text,
      fontSize: typography.size.action + 3,
      fontVariant: ["tabular-nums"],
      fontWeight: typography.weight.bold
    },
    pill: {
      alignSelf: "flex-start",
      borderColor: colors.border,
      borderRadius: radii.round,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.caption,
      overflow: "hidden",
      paddingHorizontal: spacing.sm,
      paddingVertical: 2
    },
    pillPrivate: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
      color: colors.onAccent
    },
    title: {
      color: colors.text,
      fontSize: typography.size.title - 4,
      fontWeight: typography.weight.bold
    },
    heading: {
      color: colors.text,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold
    },
    body: { color: colors.text, fontSize: typography.size.body },
    muted: { color: colors.textMuted, fontSize: typography.size.body },
    action: { alignSelf: "flex-start", minHeight: 48, justifyContent: "center" },
    search: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radii.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: typography.size.body,
      minHeight: 48,
      paddingHorizontal: spacing.md
    }
  });
  return { colors, styles };
}
