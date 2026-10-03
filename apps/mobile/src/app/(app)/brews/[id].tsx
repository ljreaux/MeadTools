import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useTranslation } from "react-i18next";

import { projectBrewView } from "@meadtools/brew-domain";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { useThemeColors } from "@/hooks/useThemeColors";
import { useApiClient, useSession } from "@/providers/app-providers";

export default function BrewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const apiClient = useApiClient();
  const { session } = useSession();
  const brewQuery = useQuery({
    queryKey: ["brew", session?.id, id],
    queryFn: () => apiClient.getBrew(id),
    enabled: Boolean(session && id)
  });
  const brew = brewQuery.data ? projectBrewView(brewQuery.data) : null;

  if (!brew) {
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
              {t("mobileBrews.detailError")}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void brewQuery.refetch()}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>{t("mobileBrews.retry")}</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  const name = brew.name?.trim() || brew.recipe_name || t("mobileBrews.untitled");

  return (
    <ScrollView contentContainerStyle={styles.content} contentInsetAdjustmentBehavior="automatic">
      <Text accessibilityRole="header" style={styles.heading}>
        {name}
      </Text>
      <Text style={styles.stage}>{t(`brewStage.${brew.stage}`)}</Text>
      {brew.recipe_name ? (
        <Text style={styles.muted}>
          {t("mobileBrews.recipe", { name: brew.recipe_name })}
        </Text>
      ) : null}
      {brew.current_volume_liters !== null ? (
        <Text style={styles.muted}>
          {t("mobileBrews.volume", {
            value: new Intl.NumberFormat(i18n.language, {
              maximumFractionDigits: 1
            }).format(brew.current_volume_liters)
          })}
        </Text>
      ) : null}
      <Text style={styles.muted}>
        {t("mobileBrews.entries", { count: brew.entry_count })}
      </Text>
    </ScrollView>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    content: {
      flexGrow: 1,
      gap: spacing.md,
      padding: spacing.xl,
      backgroundColor: colors.background
    },
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
      fontWeight: typography.weight.bold,
      textAlign: "center"
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
    retryButton: {
      borderRadius: radii.md,
      backgroundColor: colors.accent,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md
    },
    retryText: { color: colors.onAccent, fontWeight: typography.weight.bold }
  });
}
