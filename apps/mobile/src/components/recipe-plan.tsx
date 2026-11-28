import { useState } from "react";
import { Pressable, Text, View } from "react-native";
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

import { RecipeRow, RecipeSection, useRecipeStyles } from "@/components/recipe-view";
import { formatCalculatorResult, localizeDecimalText } from "@/tools/calculator-input";

const nutrientKeys = ["fermO", "fermK", "dap", "other"] as const;
const goFermLabels = {
  "Go-Ferm": "nuteResults.gfTypes.gf",
  protect: "nuteResults.gfTypes.gfProtect",
  "sterol-flash": "nuteResults.gfTypes.gfSterol",
  none: "nuteResults.gfTypes.none"
} as const;

function NutrientPlan({ recipe }: { recipe: RecipeDerivedState }) {
  const { t, i18n } = useTranslation();
  const data = calculateEffectiveNutrientData(recipe.nutrientValueForRecipe);
  const nutrients = calculateNutrientDerivedState(data);
  const grams = (value: number) =>
    `${formatCalculatorResult(i18n.language, value, 2)} ${t("units.g")}`;
  const yeastName = [
    data.selected.yeastBrand === "Other" ? "" : data.selected.yeastBrand,
    data.selected.yeastStrain
  ].filter(Boolean).join(" ");

  const nutrientRows = nutrientKeys.filter((key) => data.selected.selectedNutrients[key]);

  return (
    <RecipeSection title={t("mobileRecipes.nutrients")}>
      <View>
        <RecipeRow
          first
          label={t(`nuteSchedules.${data.selected.schedule}`)}
          detail={`${t("PDF.numberOfAdditions")} ${formatCalculatorResult(i18n.language, nutrients.numberOfAdditions, 0)}`}
        />
        {nutrientRows.map((key) => (
          <RecipeRow
            key={key}
            label={key === "other" ? data.settings.other.name.trim() || t("other.label") : t(`nutrients.${key}`)}
            value={`${grams(nutrients.nutrientAdditions.totalGrams[key])} ${t("nuteResults.total")}`}
            detail={`${grams(nutrients.nutrientAdditions.perAddition[key])} ${t("nuteResults.perAddition")}`}
          />
        ))}
        {yeastName ? (
          <RecipeRow
            label={t("PDF.yeast")}
            detail={yeastName}
            value={grams(parseNumber(data.inputs.yeastAmountG))}
          />
        ) : null}
        {nutrients.goFerm.amount > 0 ? (
          <RecipeRow
            label={t(goFermLabels[data.inputs.goFermType])}
            detail={`${t("PDF.with")} ${formatCalculatorResult(i18n.language, nutrients.goFerm.water, 2)} ${t("units.mL")} ${t("water")}`}
            value={grams(nutrients.goFerm.amount)}
          />
        ) : null}
        <RecipeRow
          label={t("PDF.remaining")}
          value={`${formatCalculatorResult(i18n.language, Math.max(0, nutrients.remainingYanPpm), 0)} PPM`}
        />
      </View>
    </RecipeSection>
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
  const { sulfite, campden, sorbate } = calculateRecipeStabilizerResults({
    addingStabilizers: settings.adding,
    phReading: settings.phReading,
    stabilizerType: settings.type,
    totalVolumeL: recipe.totalVolumeL,
    abv: recipe.abv
  });
  const quantity = (value: number) => formatCalculatorResult(i18n.language, value, 3);

  return (
    <RecipeSection title={t("PDF.stabilizers")}>
      <View>
        <RecipeRow
          first
          label={t(`PDF.${settings.type}`)}
          detail={`${t("accountPage.or")} ${quantity(campden)} ${t("campden")}`}
          value={`${quantity(sulfite)} ${t("units.g")}`}
        />
        <RecipeRow label={t("PDF.ksorb")} value={`${quantity(sorbate)} ${t("units.g")}`} />
      </View>
    </RecipeSection>
  );
}

const COLLAPSED_NOTE_LINES = 4;

/** A note that shows its first lines until the reader asks for the rest. */
function RecipeNote({ text, detail }: { text: string; detail: string }) {
  const { t } = useTranslation();
  const { colors, styles } = useRecipeStyles();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  // iOS reports only the visible lines once numberOfLines applies, so measure
  // the full note first and collapse it only after it is known to overflow.
  const lines = overflows && !expanded ? COLLAPSED_NOTE_LINES : undefined;
  const measure = (lineCount: number) => {
    if (!overflows && lineCount > COLLAPSED_NOTE_LINES) setOverflows(true);
  };

  return (
    <View style={{ gap: 2 }}>
      {text ? (
        <Text
          numberOfLines={lines}
          onTextLayout={(event) => measure(event.nativeEvent.lines.length)}
          style={styles.body}
        >
          {text}
        </Text>
      ) : null}
      {detail ? (
        <Text
          numberOfLines={lines}
          onTextLayout={(event) => measure(event.nativeEvent.lines.length)}
          style={text ? styles.muted : styles.body}
        >
          {detail}
        </Text>
      ) : null}
      {overflows ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          hitSlop={8}
          onPress={() => setExpanded((open) => !open)}
          style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center" }}
        >
          <Text style={[styles.heading, { color: colors.accent }]}>
            {t(expanded ? "mobileRecipes.showLess" : "mobileRecipes.showMore")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function RecipeNotes({ title, notes }: { title: string; notes: RecipeDataV2["notes"]["primary"] }) {
  const populated = notes.filter(({ content }) => content.some((part) => part.trim()));
  if (!populated.length) return null;

  return (
    <RecipeSection title={title} count={populated.length > 1 ? populated.length : undefined}>
      {populated.map(({ lineId, content: [text, detail] }) => (
        <RecipeNote key={lineId} text={text.trim()} detail={detail.trim()} />
      ))}
    </RecipeSection>
  );
}

export function RecipePlan({ data, recipe }: { data: RecipeDataV2; recipe: RecipeDerivedState }) {
  const { t, i18n } = useTranslation();
  const additives = data.additives.filter(({ name, amount }) => name.trim() && parseNumber(amount) > 0);

  return (
    <>
      {data.nutrients && recipe.primaryVolumeL > 0 ? <NutrientPlan recipe={recipe} /> : null}
      {data.stabilizers.adding && recipe.totalVolumeL > 0 && parseNumber(data.fg) > 0 ? (
        <StabilizerPlan settings={data.stabilizers} recipe={recipe} />
      ) : null}
      {additives.length > 0 ? (
        <RecipeSection title={t("PDF.additives")} count={additives.length}>
          <View>
            {additives.map(({ lineId, name, amount, unit }, index) => (
              <RecipeRow
                key={lineId}
                first={index === 0}
                label={name.trim()}
                value={[localizeDecimalText(i18n.language, amount),
                  unit !== "units" && unit ? t(`units.${unit}`, { defaultValue: unit }) : ""]
                  .filter(Boolean).join(" ")}
              />
            ))}
          </View>
        </RecipeSection>
      ) : null}
      <RecipeNotes title={t("PDF.primaryNotes")} notes={data.notes.primary} />
      <RecipeNotes title={t("PDF.secondaryNotes")} notes={data.notes.secondary} />
    </>
  );
}
