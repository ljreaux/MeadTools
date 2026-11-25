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
    pressed: { borderColor: colors.accent },
    title: {
      color: colors.text,
      fontSize: typography.size.action,
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
