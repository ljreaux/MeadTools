import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  calculateRecipeStabilizerResults,
  type RecipeDerivedState
} from "@meadtools/core/derived";
import {
  calculateEffectiveNutrientData,
  calculateNutrientDerivedState
} from "@meadtools/core/nutrients";
import { parseNumber } from "@meadtools/core/numeric";
import type { RecipeDataV2 } from "@meadtools/schemas";

import { useRecipeStyles } from "@/components/recipe-view";
import { formatCalculatorResult, localizeDecimalText } from "@/tools/calculator-input";

const nutrientKeys = ["fermO", "fermK", "dap", "other"] as const;
const goFermLabels = {
  "Go-Ferm": "nuteResults.gfTypes.gf",
  protect: "nuteResults.gfTypes.gfProtect",
  "sterol-flash": "nuteResults.gfTypes.gfSterol",
  none: "nuteResults.gfTypes.none"
} as const;

function PlanSection({ title, children }: { title: string; children: ReactNode }) {
  const { styles } = useRecipeStyles();
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
      {children}
    </View>
  );
}

function NutrientPlan({ recipe }: { recipe: RecipeDerivedState }) {
  const { t, i18n } = useTranslation();
  const { styles } = useRecipeStyles();
  const data = calculateEffectiveNutrientData(recipe.nutrientValueForRecipe);
  const nutrients = calculateNutrientDerivedState(data);
  const grams = (value: number) =>
    `${formatCalculatorResult(i18n.language, value, 2)} ${t("units.g")}`;
  const yeastName = [
    data.selected.yeastBrand === "Other" ? "" : data.selected.yeastBrand,
    data.selected.yeastStrain
  ].filter(Boolean).join(" ");

  return (
    <PlanSection title={t("mobileRecipes.nutrients")}>
      <Text style={styles.body}>{t(`nuteSchedules.${data.selected.schedule}`)}</Text>
      <Text style={styles.muted}>
        {t("PDF.numberOfAdditions")} {formatCalculatorResult(i18n.language, nutrients.numberOfAdditions, 0)}
      </Text>
      {nutrientKeys.filter((key) => data.selected.selectedNutrients[key]).map((key) => (
        <View key={key}>
          <Text style={styles.body}>
            {key === "other" ? data.settings.other.name.trim() || t("other.label") : t(`nutrients.${key}`)}
          </Text>
          <Text style={styles.muted}>
            {grams(nutrients.nutrientAdditions.perAddition[key])} {t("nuteResults.perAddition")}
            {" · "}{grams(nutrients.nutrientAdditions.totalGrams[key])} {t("nuteResults.total")}
          </Text>
        </View>
      ))}
      {yeastName ? (
        <Text style={styles.body}>{t("PDF.yeast")} · {grams(parseNumber(data.inputs.yeastAmountG))} {yeastName}</Text>
      ) : null}
      {nutrients.goFerm.amount > 0 ? (
        <Text style={styles.body}>
          {grams(nutrients.goFerm.amount)} {t(goFermLabels[data.inputs.goFermType])} {t("PDF.with")}{" "}
          {formatCalculatorResult(i18n.language, nutrients.goFerm.water, 2)} {t("units.mL")} {t("water")}
        </Text>
      ) : null}
      <Text style={styles.muted}>
        {t("PDF.remaining")} {formatCalculatorResult(i18n.language, Math.max(0, nutrients.remainingYanPpm), 0)} PPM
      </Text>
    </PlanSection>
  );
}

function StabilizerPlan({
  settings,
  recipe
}: {
  settings: RecipeDataV2["stabilizers"];
  recipe: RecipeDerivedState;
}) {
  const { t, i18n } = useTranslation();
  const { styles } = useRecipeStyles();
  const { sulfite, campden, sorbate } = calculateRecipeStabilizerResults({
    addingStabilizers: settings.adding,
    phReading: settings.phReading,
    stabilizerType: settings.type,
    totalVolumeL: recipe.totalVolumeL,
    abv: recipe.abv
  });
  const quantity = (value: number) => formatCalculatorResult(i18n.language, value, 3);

  return (
    <PlanSection title={t("PDF.stabilizers")}>
      <Text style={styles.body}>
        {quantity(sulfite)} {t("units.g")} {t(`PDF.${settings.type}`)} {t("accountPage.or")}{" "}
        {quantity(campden)} {t("campden")}
      </Text>
      <Text style={styles.body}>{quantity(sorbate)} {t("units.g")} {t("PDF.ksorb")}</Text>
    </PlanSection>
  );
}

function RecipeNotes({ title, notes }: { title: string; notes: RecipeDataV2["notes"]["primary"] }) {
  const { styles } = useRecipeStyles();
  const populated = notes.filter(({ content }) => content.some((part) => part.trim()));
  if (!populated.length) return null;

  return (
    <PlanSection title={title}>
      {populated.map(({ lineId, content: [title, detail] }) => (
        <View key={lineId}>
          {title.trim() ? <Text style={styles.body}>{title.trim()}</Text> : null}
          {detail.trim() ? <Text style={title.trim() ? styles.muted : styles.body}>{detail.trim()}</Text> : null}
        </View>
      ))}
    </PlanSection>
  );
}

export function RecipePlan({ data, recipe }: { data: RecipeDataV2; recipe: RecipeDerivedState }) {
  const { t, i18n } = useTranslation();
  const { styles } = useRecipeStyles();
  const additives = data.additives.filter(({ name, amount }) => name.trim() && parseNumber(amount) > 0);

  return (
    <>
      {data.nutrients && recipe.primaryVolumeL > 0 ? <NutrientPlan recipe={recipe} /> : null}
      {data.stabilizers.adding && recipe.totalVolumeL > 0 && parseNumber(data.fg) > 0 ? (
        <StabilizerPlan settings={data.stabilizers} recipe={recipe} />
      ) : null}
      {additives.length > 0 ? (
        <PlanSection title={t("PDF.additives")}>
          {additives.map(({ lineId, name, amount, unit }) => (
            <View key={lineId}>
              <Text style={styles.body}>{name.trim()}</Text>
              <Text style={styles.muted}>
                {[localizeDecimalText(i18n.language, amount),
                  unit !== "units" && unit ? t(`units.${unit}`, { defaultValue: unit }) : ""]
                  .filter(Boolean).join(" ")}
              </Text>
            </View>
          ))}
        </PlanSection>
      ) : null}
      <RecipeNotes title={t("PDF.primaryNotes")} notes={data.notes.primary} />
      <RecipeNotes title={t("PDF.secondaryNotes")} notes={data.notes.secondary} />
    </>
  );
}
