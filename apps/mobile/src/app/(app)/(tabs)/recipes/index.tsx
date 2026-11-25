import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "expo-router";
import { FlatList, Pressable, Text, TextInput } from "react-native";
import { useTranslation } from "react-i18next";

import { RecipeLoadStatus, useRecipeStyles } from "@/components/recipe-view";
import { useApiClient, useSession } from "@/providers/app-providers";

export default function RecipesScreen() {
  const { t, i18n } = useTranslation();
  const { colors, styles } = useRecipeStyles();
  const apiClient = useApiClient();
  const { session } = useSession();
  const [search, setSearch] = useState("");
  const recipes = useQuery({
    queryKey: ["recipes", session?.id],
    queryFn: () => apiClient.listRecipes(),
    enabled: Boolean(session)
  });

  const searchLabel = t("mobileRecipes.search");
  const term = search.trim().toLocaleLowerCase(i18n.language);
  const matches = recipes.isError ? [] : (recipes.data ?? []).filter((recipe) => {
    const name = recipe.name.trim() || t("untitledRecipe");
    return name.toLocaleLowerCase(i18n.language).includes(term);
  });

  return (
    <FlatList
      data={matches}
      keyExtractor={(recipe) => String(recipe.id)}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshing={recipes.isRefetching}
      onRefresh={() => void recipes.refetch()}
      ListHeaderComponent={recipes.data?.length && !recipes.isError ? (
        <TextInput
          accessibilityLabel={searchLabel}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setSearch}
          placeholder={searchLabel}
          placeholderTextColor={colors.placeholder}
          returnKeyType="search"
          style={styles.search}
          value={search}
        />
      ) : null}
      ListEmptyComponent={
        <RecipeLoadStatus
          loading={recipes.isPending}
          error={recipes.error}
          message={t(
            recipes.isError ? "mobileRecipes.listError" :
              recipes.data?.length ? "mobileRecipes.noMatches" : "mobileRecipes.empty"
          )}
          retry={() => void recipes.refetch()}
        />
      }
      renderItem={({ item }) => (
        <Link asChild href={{ pathname: "/recipes/[id]", params: { id: String(item.id) } }}>
          <Pressable
            accessibilityRole="link"
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <Text style={styles.heading}>{item.name.trim() || t("untitledRecipe")}</Text>
            <Text style={styles.muted}>{t(item.private ? "brews.visibility.private" : "brews.visibility.public")}</Text>
          </Pressable>
        </Link>
      )}
    />
  );
}
