import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { calculateRecipeDerivedState, type RecipeDerivedState } from "@meadtools/core/derived";
import { parseNumber } from "@meadtools/core/numeric";
import { spacing } from "@meadtools/design-tokens";
import { recipeDataV2Schema, type RecipeDataV2 } from "@meadtools/schemas";

import { RecipeCosts } from "@/components/recipe-costs";
import { RecipeCover } from "@/components/recipe-cover";
import { RecipePdfActions } from "@/components/recipe-pdf-actions";
import { RecipePlan } from "@/components/recipe-plan";
import {
  RecipeLoadStatus,
  RecipeRow,
  RecipeSection,
  RecipeStatGrid,
  useRecipeStyles
} from "@/components/recipe-view";
import { useApiClient, useSession } from "@/providers/app-providers";
import { summarizeDerivedRecipe } from "@/recipes/recipe-summary";
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
          <View style={{ gap: spacing.sm }}>
            <Text accessibilityRole="header" style={styles.title}>
              {ownedRecipe.name.trim() || t("untitledRecipe")}
            </Text>
            <Text style={[styles.pill, ownedRecipe.private && styles.pillPrivate]}>
              {t(ownedRecipe.private ? "brews.visibility.private" : "brews.visibility.public")}
            </Text>
          </View>
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
  const summary = summarizeDerivedRecipe(data, derived);
  const gravity = (value: number | null) =>
    value === null ? null : formatCalculatorResult(i18n.language, value, 3, true);
  const unit = t(`units.${summary.volumeUnit}`, { defaultValue: summary.volumeUnit });

  return (
    <RecipeSection title={t("mobileRecipes.targets")}>
      <RecipeStatGrid
        unavailable={t("mobileRecipes.estimateUnavailable")}
        stats={[
          { key: "og", label: t("mobileRecipes.estimatedOg"), value: gravity(summary.og) },
          { key: "fg", label: t("mobileRecipes.fermentationFg"), value: gravity(summary.fg) },
          {
            key: "abv",
            label: t("mobileRecipes.estimatedAbv"),
            value: summary.abv === null ? null : new Intl.NumberFormat(i18n.language, {
              style: "percent",
              maximumFractionDigits: 2
            }).format(summary.abv / 100)
          },
          { key: "finished", label: t("mobileRecipes.finishedGravity"), value: gravity(summary.finishedGravity) },
          {
            key: "volume",
            label: t("mobileRecipes.bottlingVolume"),
            value: summary.bottlingVolume === null
              ? null
              : `${formatCalculatorResult(i18n.language, summary.bottlingVolume, 3)} ${unit}`
          }
        ]}
      />
    </RecipeSection>
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
  if (ingredients.length === 0) return null;
  // Converted amounts can be stored as 0.1171875; round like the PDF does.
  const formatAmount = (value: string) => {
    const amount = parseNumber(value);
    return Number.isFinite(amount)
      ? formatCalculatorResult(i18n.language, amount, 3)
      : localizeDecimalText(i18n.language, value);
  };

  return (
    <RecipeSection title={title} count={ingredients.length}>
      <View>
        {ingredients.map((ingredient, index) => {
          const { unit, value } = ingredient.amounts[ingredient.amounts.basis];
          const name = ingredient.ref.kind === "catalog"
            ? t(catalogLabelKey(ingredient.name), { defaultValue: ingredient.name })
            : ingredient.name;
          return (
            <RecipeRow
              key={ingredient.lineId}
              first={index === 0}
              label={name || t("mobileRecipes.unnamedIngredient")}
              value={value.trim()
                ? `${formatAmount(value)} ${t(`units.${unit}`, { defaultValue: unit })}`
                : null}
            />
          );
        })}
      </View>
    </RecipeSection>
  );
}
