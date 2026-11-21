import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  canUpdateRecipeSnapshot,
  recipeSnapshotDiffers
} from "@meadtools/brew-domain/recipe-snapshot-diff";
import { colorThemes, radii, spacing, typography } from "@meadtools/design-tokens";

import { isConnectionError } from "@/api/errors";
import { useThemeColors } from "@/hooks/useThemeColors";
import { useApiClient, useSession } from "@/providers/app-providers";

/** The linked recipe as it is now; shared with the snapshot update screen. */
export function useSourceRecipe(recipeId: number | null, enabled: boolean) {
  const apiClient = useApiClient();
  const { session } = useSession();
  return useQuery({
    queryKey: ["recipe", session?.id, recipeId],
    queryFn: () => apiClient.getRecipe(recipeId as number),
    enabled: Boolean(session && recipeId && enabled),
    retry: false,
    staleTime: 0
  });
}

type SnapshotBrew = {
  id: string;
  recipe_id: number | null;
  recipe_snapshot: unknown;
  end_date: string | null;
  stage: string;
};
type Snapshot = { name?: string | null; dataV2?: unknown; snapshottedAt?: string };

/** Snapshot date, whether the linked recipe has changed, and the update action. */
export function RecipeSnapshotStatus({ brew }: { brew: SnapshotBrew }) {
  const { colors } = useThemeColors();
  const styles = createStyles(colors);
  const { t, i18n } = useTranslation();
  const snapshot =
    brew.recipe_snapshot && typeof brew.recipe_snapshot === "object"
      ? (brew.recipe_snapshot as Snapshot)
      : null;
  const canCheck = canUpdateRecipeSnapshot(brew);
  const source = useSourceRecipe(brew.recipe_id, canCheck);

  if (!snapshot) return null;

  const date = snapshot.snapshottedAt
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(snapshot.snapshottedAt)
      )
    : t("brews.snapshot.unknownDate");
  const differs = Boolean(source.data && recipeSnapshotDiffers(snapshot, source.data));

  let status: string | null = null;
  if (canCheck) {
    if (source.isPending) status = t("brews.snapshot.checking");
    else if (source.isError)
      status = isConnectionError(source.error)
        ? t("mobileBrews.snapshot.offline")
        : t("brews.snapshot.unavailable");
    else if (!differs) status = t("brews.snapshot.upToDate");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t("brews.snapshot.title")}</Text>
      <Text style={styles.muted}>{t("brews.snapshot.current", { date })}</Text>
      {status ? <Text style={styles.muted}>{status}</Text> : null}
      {canCheck && differs ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: "/recipe-snapshot", params: { brewId: brew.id } })}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>{t("brews.snapshot.action")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: typeof colorThemes.light) {
  return StyleSheet.create({
    container: {
      borderTopColor: colors.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: spacing.sm,
      marginTop: spacing.sm,
      paddingTop: spacing.md
    },
    heading: {
      color: colors.text,
      fontSize: typography.size.body,
      fontWeight: typography.weight.bold
    },
    muted: { color: colors.textMuted, fontSize: typography.size.caption },
    button: {
      alignItems: "center",
      borderColor: colors.accent,
      borderRadius: radii.md,
      borderWidth: 1,
      justifyContent: "center",
      minHeight: 44,
      paddingHorizontal: spacing.lg
    },
    buttonText: { color: colors.text, fontWeight: typography.weight.bold },
    pressed: { opacity: 0.7 }
  });
}
