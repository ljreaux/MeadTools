import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { MeadToolsApiError } from "@meadtools/api-client";
import { radii } from "@meadtools/design-tokens";

import { useRecipeStyles } from "@/components/recipe-view";
import { useApiClient, useSession } from "@/providers/app-providers";

export function RecipeCover({ recipeId, coverId }: { recipeId: number; coverId?: string }) {
  const api = useApiClient();
  const { session } = useSession();
  const { t } = useTranslation();
  const { colors, styles } = useRecipeStyles();
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const cover = useQuery({
    queryKey: ["recipe-cover", session?.id, recipeId, coverId],
    gcTime: 0,
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      try {
        const image = await api.getRecipeCover(recipeId);
        if (!image) return null;
        const { url } = await api.getRecipeImageAccess(recipeId, image.id);
        return { url, caption: image.caption };
      } catch (error) {
        if (error instanceof MeadToolsApiError && error.status === 404) return null;
        throw error;
      }
    }
  });

  if (cover.isFetching && coverId) {
    return (
      <View style={[coverStyles.banner, coverStyles.loading, { backgroundColor: colors.surface }]}>
        <ActivityIndicator accessibilityLabel={t("coverImages.title")} color={colors.accent} />
      </View>
    );
  }

  const image = cover.data;
  if (cover.isError || (image && image.url === failedUrl)) {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>{t("coverImages.loadError")}</Text>
        <Pressable accessibilityRole="button" style={styles.action} onPress={() => {
          setFailedUrl(null);
          void cover.refetch();
        }}>
          <Text style={[styles.heading, { color: colors.accent }]}>{t("PDF.retry")}</Text>
        </Pressable>
      </View>
    );
  }

  if (!image) return null;
  return (
    <Image
      accessible
      accessibilityLabel={image.caption || t("coverImages.title")}
      source={{ uri: image.url }}
      style={coverStyles.banner}
      contentFit="cover"
      cachePolicy="none"
      onError={() => setFailedUrl(image.url)}
    />
  );
}

const coverStyles = StyleSheet.create({
  banner: { width: "100%", aspectRatio: 16 / 9, borderRadius: radii.lg },
  loading: { alignItems: "center", justifyContent: "center" }
});
