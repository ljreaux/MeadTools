import { memo, useCallback, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { AccountRecipeResponse } from "@meadtools/api-contract/contracts";
import { spacing } from "@meadtools/design-tokens";

import { Segmented } from "@/components/calculator-ui";
import { RecipeLoadStatus, useRecipeStyles } from "@/components/recipe-view";
import { useApiClient, useSession } from "@/providers/app-providers";
import {
  queryRecipeList,
  RECIPE_SORTS,
  summarizeRecipe,
  type RecipeSort
} from "@/recipes/recipe-summary";
import { formatCalculatorResult } from "@/tools/calculator-input";

export default function RecipesScreen() {
  const { t, i18n } = useTranslation();
  const { colors, styles } = useRecipeStyles();
  const apiClient = useApiClient();
  const { session } = useSession();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RecipeSort>("newest");
  const listRef = useRef<FlatList<AccountRecipeResponse>>(null);
  const recipes = useQuery({
    queryKey: ["recipes", session?.id],
    queryFn: () => apiClient.listRecipes(),
    enabled: Boolean(session)
  });

  const searchLabel = t("mobileRecipes.search");
  const fallbackName = t("untitledRecipe");
  const allRecipes = recipes.isError ? undefined : recipes.data;
  const total = allRecipes?.length ?? 0;
  const matches = useMemo(
    () => queryRecipeList(allRecipes ?? [], { search, sort, locale: i18n.language, fallbackName }),
    [allRecipes, search, sort, i18n.language, fallbackName]
  );
  const narrowed = search.trim() !== "";
  // New results start at the top instead of wherever a long list was scrolled.
  const changeQuery = (update: () => void) => {
    update();
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };
  const renderItem = useCallback(
    ({ item }: { item: AccountRecipeResponse }) => <RecipeListRow recipe={item} />,
    []
  );

  return (
    <FlatList
      ref={listRef}
      data={matches}
      keyExtractor={(recipe) => String(recipe.id)}
      contentContainerStyle={[styles.content, listStyles.content]}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshing={recipes.isRefetching}
      onRefresh={() => void recipes.refetch()}
      // Long recipe lists keep search and sort in reach while scrolling.
      stickyHeaderIndices={total ? [0] : undefined}
      // Android's default clipping detaches every row beneath a sticky header,
      // leaving the list blank.
      removeClippedSubviews={false}
      initialNumToRender={12}
      windowSize={9}
      ListHeaderComponent={total ? (
        <View style={[listStyles.controls, { backgroundColor: colors.background }]}>
          <TextInput
            accessibilityLabel={searchLabel}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            onChangeText={(value) => changeQuery(() => setSearch(value))}
            placeholder={searchLabel}
            placeholderTextColor={colors.placeholder}
            returnKeyType="search"
            style={styles.search}
            value={search}
          />
          <View style={listStyles.toolbar}>
            <Text accessibilityLiveRegion="polite" style={[styles.caption, listStyles.count]}>
              {narrowed
                ? t("mobileRecipes.searchCount", { shown: matches.length, total })
                : t("mobileRecipes.count", { count: total })}
            </Text>
            <View style={listStyles.sort}>
              <Segmented
                compact
                label={t("mobileRecipes.sort")}
                onChange={(value) => changeQuery(() => setSort(value))}
                optionLabel={(option) => t(`mobileRecipes.sorts.${option}`)}
                options={RECIPE_SORTS}
                value={sort}
              />
            </View>
          </View>
        </View>
      ) : null}
      ListEmptyComponent={
        total && narrowed ? (
          <View style={styles.card}>
            <Text style={styles.body}>{t("mobileRecipes.noMatches")}</Text>
            <Pressable accessibilityRole="button" onPress={() => changeQuery(() => setSearch(""))} style={styles.action}>
              <Text style={[styles.heading, { color: colors.accent }]}>{t("mobileRecipes.clearSearch")}</Text>
            </Pressable>
          </View>
        ) : (
          <RecipeLoadStatus
            loading={recipes.isPending}
            error={recipes.error}
            message={t(recipes.isError ? "mobileRecipes.listError" : "mobileRecipes.empty")}
            retry={() => void recipes.refetch()}
          />
        )
      }
      renderItem={renderItem}
    />
  );
}

const RecipeListRow = memo(function RecipeListRow({ recipe }: { recipe: AccountRecipeResponse }) {
  const { t, i18n } = useTranslation();
  const { colors, styles } = useRecipeStyles();
  const summary = summarizeRecipe(recipe.dataV2);
  const metadata = summary ? [
    summary.og !== null
      ? t("mobileRecipes.rowOg", { value: formatCalculatorResult(i18n.language, summary.og, 3, true) })
      : null,
    summary.abv !== null
      ? t("mobileRecipes.rowAbv", {
        value: new Intl.NumberFormat(i18n.language, { style: "percent", maximumFractionDigits: 1 })
          .format(summary.abv / 100)
      })
      : null,
    summary.bottlingVolume !== null
      ? `${formatCalculatorResult(i18n.language, summary.bottlingVolume, 2)} ${
        t(`units.${summary.volumeUnit}`, { defaultValue: summary.volumeUnit })
      }`
      : null
  ].filter(Boolean).join(" · ") : "";

  return (
    // A style function on a Pressable inside <Link asChild> is dropped, so
    // navigate directly to keep the card style and press feedback.
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push({ pathname: "/recipes/[id]", params: { id: String(recipe.id) } })}
      style={({ pressed }) => [styles.card, listStyles.row, pressed && styles.pressed]}
    >
      <View style={listStyles.rowText}>
        <Text numberOfLines={2} style={styles.heading}>{recipe.name.trim() || t("untitledRecipe")}</Text>
        {metadata ? <Text numberOfLines={1} style={styles.caption}>{metadata}</Text> : null}
      </View>
      {/* Only the exception is badged, so a long list is not a column of "Public". */}
      {recipe.private ? (
        <Text style={[styles.pill, styles.pillPrivate]}>{t("brews.visibility.private")}</Text>
      ) : null}
      <Text importantForAccessibility="no" style={[styles.heading, { color: colors.textMuted }]}>›</Text>
    </Pressable>
  );
});

const listStyles = StyleSheet.create({
  content: { gap: spacing.sm, paddingTop: 0 },
  controls: { gap: spacing.sm, paddingBottom: spacing.sm, paddingTop: spacing.lg },
  toolbar: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  count: { flexGrow: 1 },
  sort: { flexBasis: 160, flexGrow: 0 },
  row: { alignItems: "center", flexDirection: "row", gap: spacing.md, paddingVertical: spacing.md },
  rowText: { flex: 1, gap: spacing.xs }
});
