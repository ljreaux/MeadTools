import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { calculateRecipeDerivedState, type RecipeDerivedState } from "@meadtools/core/derived";
import { parseNumber } from "@meadtools/core/numeric";
import { recipeDataV2Schema, type RecipeDataV2 } from "@meadtools/schemas";

import { RecipeCosts } from "@/components/recipe-costs";
import { RecipeCover } from "@/components/recipe-cover";
import { RecipePdfActions } from "@/components/recipe-pdf-actions";
import { RecipePlan } from "@/components/recipe-plan";
import { RecipeLoadStatus, useRecipeStyles } from "@/components/recipe-view";
import { useApiClient, useSession } from "@/providers/app-providers";
import {
  catalogLabelKey,
  formatCalculatorResult,
  localizeDecimalText
} from "@/tools/calculator-input";

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { styles } = useRecipeStyles();
  const apiClient = useApiClient();
  const { session } = useSession();
  const recipeId = typeof id === "string" && /^\d+$/.test(id) ? Number(id) : NaN;
  const validId = Number.isSafeInteger(recipeId) && recipeId > 0;
  const recipe = useQuery({
    queryKey: ["recipe", session?.id, recipeId],
    queryFn: () => apiClient.getRecipe(recipeId),
    enabled: Boolean(session) && validId
  });
  const ownedRecipe = !recipe.isError && recipe.data?.user_id === session?.id
    ? recipe.data
    : null;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      style={styles.screen}
    >
      {ownedRecipe ? (
        <>
          <Text accessibilityRole="header" style={styles.title}>
            {ownedRecipe.name.trim() || t("untitledRecipe")}
          </Text>
          <Text style={styles.muted}>
            {t(ownedRecipe.private ? "brews.visibility.private" : "brews.visibility.public")}
          </Text>
          {ownedRecipe.cover_image_id !== null ? (
            <RecipeCover
              key={`${ownedRecipe.id}:${ownedRecipe.cover_image_id ?? ""}`}
              recipeId={ownedRecipe.id}
              coverId={ownedRecipe.cover_image_id}
            />
          ) : null}
          <RecipeContents storedData={ownedRecipe.dataV2} recipeId={ownedRecipe.id} />
        </>
      ) : (
        <RecipeLoadStatus
          loading={validId && recipe.isPending}
          error={recipe.error}
          message={t(recipe.isError ? "mobileRecipes.detailError" : "mobileRecipes.unavailable")}
          retry={() => void recipe.refetch()}
        />
      )}
    </ScrollView>
  );
}

function RecipeContents({ storedData, recipeId }: { storedData: unknown; recipeId: number }) {
  const { t } = useTranslation();
  const { styles } = useRecipeStyles();
  const parsed = recipeDataV2Schema.safeParse(storedData);
  if (!parsed.success) {
    return (
      <Text style={styles.body}>
        {t(storedData === null ? "legacyRecipeMessage" : "mobileRecipes.detailError")}
      </Text>
    );
  }

  const data = parsed.data;
  const derived = calculateRecipeDerivedState(data);
  return (
    <>
      <RecipePdfActions recipeId={recipeId} />
      <RecipeTargets data={data} derived={derived} />
      <RecipeListSection
        title={t("PDF.primary")}
        ingredients={data.ingredients.filter((line) => !line.secondary)}
      />
      <RecipeListSection
        title={t("PDF.secondary")}
        ingredients={data.ingredients.filter((line) => line.secondary)}
      />
      <RecipePlan data={data} recipe={derived} />
      <RecipeCosts recipeId={recipeId} />
    </>
  );
}

function RecipeTargets({ data, derived }: { data: RecipeDataV2; derived: RecipeDerivedState }) {
  const { t, i18n } = useTranslation();
  const { styles } = useRecipeStyles();
  const fg = parseNumber(data.fg);
  const hasPrimaryVolume = Number.isFinite(derived.primaryVolumeL) && derived.primaryVolumeL > 0;
  const hasFinishedVolume = Number.isFinite(derived.bottlingVolume) && derived.bottlingVolume > 0;
  const formatGravity = (value: number) =>
    Number.isFinite(value) && value > 0 ? formatCalculatorResult(i18n.language, value, 3, true) : null;
  const abv = hasPrimaryVolume && fg > 0 && Number.isFinite(derived.abv)
    ? new Intl.NumberFormat(i18n.language, { style: "percent", maximumFractionDigits: 2 })
      .format(derived.abv / 100)
    : null;
  const unit = t(`units.${derived.volumeUnit}`, { defaultValue: derived.volumeUnit });
  const bottlingVolume = hasFinishedVolume
    ? `${formatCalculatorResult(i18n.language, derived.bottlingVolume, 3)} ${unit}`
    : null;
  const values = [
    ["estimatedOg", hasPrimaryVolume ? formatGravity(derived.ogPrimary) : null],
    ["fermentationFg", formatGravity(fg)],
    ["finishedGravity", hasFinishedVolume && fg > 0 ? formatGravity(derived.backsweetenedFg) : null],
    ["estimatedAbv", abv],
    ["bottlingVolume", bottlingVolume]
  ] as const;

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>{t("mobileRecipes.targets")}</Text>
      {values.map(([key, value]) => (
        <View key={key}>
          <Text style={styles.muted}>{t(`mobileRecipes.${key}`)}</Text>
          <Text style={styles.body}>{value ?? t("mobileRecipes.estimateUnavailable")}</Text>
        </View>
      ))}
    </View>
  );
}

function RecipeListSection({
  title,
  ingredients
}: {
  title: string;
  ingredients: RecipeDataV2["ingredients"];
}) {
  const { t, i18n } = useTranslation();
  const { styles } = useRecipeStyles();
  if (ingredients.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
      {ingredients.map((ingredient) => {
        const { unit, value } = ingredient.amounts[ingredient.amounts.basis];
        const name = ingredient.ref.kind === "catalog"
          ? t(catalogLabelKey(ingredient.name), { defaultValue: ingredient.name })
          : ingredient.name;
        return (
          <View key={ingredient.lineId}>
            <Text style={styles.body}>{name || t("mobileRecipes.unnamedIngredient")}</Text>
            {value.trim() ? (
              <Text style={styles.muted}>
                {localizeDecimalText(i18n.language, value)} {t(`units.${unit}`, { defaultValue: unit })}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}
