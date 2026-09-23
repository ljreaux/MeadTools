import type { TFunction, i18n as I18n } from "i18next";
import lodash from "lodash";

import { calcSb } from "@meadtools/core/gravity";
import type { useNutrients } from "@/components/providers/NutrientProvider";
import type { useRecipe } from "@/components/providers/RecipeProvider";
import {
  formatSgAsBrixDisplay,
  formatSgDisplay
} from "@/lib/utils/gravityFormatting";
import { normalizeNumberString, parseNumber } from "@/lib/utils/validateInput";
import { ORDER, type NutrientKey } from "@/types/nutrientData";

type RecipeState = ReturnType<typeof useRecipe>;
type NutrientState = ReturnType<typeof useNutrients>;

type RecipePdfModelInput = {
  recipe: RecipeState;
  nutrients: NutrientState;
  yeast?: any;
  title?: string;
  publicUsername?: string;
  t: TFunction;
  i18n: I18n;
};

type PdfIngredient = {
  id: string;
  name: string;
  weight: string;
  volume: string;
};

type PdfNote = {
  id: string;
  title: string;
  details: string;
};

type PdfAdditive = {
  id: string;
  name: string;
  amount: string;
};

export type RecipePdfModel = {
  title: string;
  byline: string;
  overview: {
    totalVolume: string[];
    yeast: string[];
  };
  metrics: {
    key: string;
    label: string;
    values: string[];
  }[];
  nutrients: {
    protocol: string;
    numberOfAdditions: string;
    perAddition: string[];
    total: string[];
  };
  stabilizers: string[];
  remainingYan: string;
  primaryIngredients: PdfIngredient[];
  secondaryIngredients: PdfIngredient[];
  primaryNotes: PdfNote[];
  secondaryNotes: PdfNote[];
  additives: PdfAdditive[];
  showPageTwo: boolean;
  labels: {
    totalVolume: string;
    yeast: string;
    nutrient: string;
    numberOfAdditions: string;
    amountPerAddition: string;
    total: string;
    stabilizers: string;
    remainingYan: string;
    primaryIngredients: string;
    secondaryIngredients: string;
    weight: string;
    volume: string;
    primaryNotes: string;
    secondaryNotes: string;
    details: string;
    additives: string;
    additiveAmount: string;
  };
};

type NumberFormatOptions = {
  minimum?: number;
  maximum?: number;
  fixed?: boolean;
  fallback?: string;
};

export function formatRecipePdfNumber(
  value: unknown,
  digits: number,
  locale?: string,
  options: NumberFormatOptions = {}
): string {
  const parsed =
    typeof value === "number" ? value : parseNumber(String(value ?? ""));

  if (!Number.isFinite(parsed)) return options.fallback ?? "—";

  const minimum = options.minimum ?? Number.NEGATIVE_INFINITY;
  const maximum = options.maximum ?? Number.POSITIVE_INFINITY;
  const bounded = Math.min(Math.max(parsed, minimum), maximum);

  return normalizeNumberString(bounded, digits, locale, options.fixed);
}

export function createRecipePdfModel({
  recipe,
  nutrients,
  yeast,
  title,
  publicUsername,
  t,
  i18n
}: RecipePdfModelInput): RecipePdfModel {
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const unitDefaults = recipe.data.unitDefaults;
  const isMetric =
    unitDefaults.weight === "kg" ||
    unitDefaults.weight === "g" ||
    unitDefaults.volume === "L" ||
    unitDefaults.volume === "mL";

  const formatQuantity = (value: unknown, digits = 3) =>
    formatRecipePdfNumber(value, digits, locale, { minimum: 0 });
  const formatDose = (value: unknown) => formatQuantity(value, 2);
  const formatGravity = (value: unknown) => {
    const parsed =
      typeof value === "number" ? value : parseNumber(String(value ?? ""));
    return formatSgDisplay(parsed, locale);
  };
  const formatBrix = (value: unknown) => {
    const parsed =
      typeof value === "number" ? value : parseNumber(String(value ?? ""));
    return formatSgAsBrixDisplay(parsed, t("BRIX"), locale);
  };

  const toTemperature = (fahrenheit?: unknown) => {
    const parsed =
      typeof fahrenheit === "number"
        ? fahrenheit
        : parseNumber(String(fahrenheit ?? ""));
    if (!Number.isFinite(parsed)) return undefined;
    return Math.round(isMetric ? (parsed - 32) * (5 / 9) : parsed);
  };

  const lowTemp = toTemperature(yeast?.low_temp);
  const highTemp = toTemperature(yeast?.high_temp);
  const temperatureRange =
    lowTemp != null && highTemp != null
      ? `${t("PDF.tempRange")} ${lowTemp}-${highTemp}°${isMetric ? "C" : "F"}`
      : "";

  const yeastName = yeast?.name ?? nutrients.data.selected.yeastStrain;
  const yeastBrand =
    nutrients.data.selected.yeastBrand &&
    nutrients.data.selected.yeastBrand !== "Other"
      ? nutrients.data.selected.yeastBrand
      : "";
  const yeastDescription = [yeastBrand, yeastName].filter(Boolean).join(" ");

  const goFermKeys: Record<string, string> = {
    "Go-Ferm": "nuteResults.gfTypes.gf",
    protect: "nuteResults.gfTypes.gfProtect",
    "sterol-flash": "nuteResults.gfTypes.gfSterol",
    none: "nuteResults.gfTypes.none"
  };
  const goFermType = nutrients.data.inputs.goFermType;
  const goFermLabel = t(goFermKeys[goFermType] ?? goFermType);

  const ingredientRows = (recipe.data.ingredients ?? [])
    .filter(
      (line) =>
        parseNumber(line.amounts.weight.value) > 0 ||
        parseNumber(line.amounts.volume.value) > 0
    )
    .map((line): PdfIngredient & { secondary: boolean } => {
      const translationKey = lodash.camelCase(line.name);
      const displayName = i18n.exists(translationKey)
        ? t(translationKey)
        : line.name;

      return {
        id: line.lineId,
        secondary: line.secondary,
        name: displayName,
        weight: `${formatQuantity(line.amounts.weight.value)} ${
          line.amounts.weight.unit
        }`,
        volume: `${formatQuantity(line.amounts.volume.value)} ${
          line.amounts.volume.unit
        }`
      };
    });

  const toNotes = (
    notes: typeof recipe.data.notes.primary
  ): PdfNote[] =>
    (notes ?? [])
      .filter((note) => note.content[0]?.trim() || note.content[1]?.trim())
      .map((note) => ({
        id: note.lineId,
        title: note.content[0]?.trim() ?? "",
        details: note.content[1]?.trim() ?? ""
      }));

  const additives = (recipe.data.additives ?? [])
    .filter(
      (additive) =>
        parseNumber(additive.amount) > 0 && additive.name.trim().length > 0
    )
    .map(
      (additive): PdfAdditive => ({
        id: additive.lineId,
        name: additive.name.trim(),
        amount: `${formatQuantity(additive.amount)} ${
          additive.unit !== "units" ? additive.unit : ""
        }`.trim()
      })
    );

  const enabledNutrients = nutrients.data.selected.selectedNutrients;
  const perAddition = nutrients.derived.nutrientAdditions.perAddition;
  const totalGrams = nutrients.derived.nutrientAdditions.totalGrams;
  const otherName =
    nutrients.data.settings.other?.name?.trim() || t("other.label");
  const nutrientSuffix: Record<NutrientKey, string> = {
    fermO: "g Fermaid O",
    fermK: "g Fermaid K",
    dap: "g DAP",
    other: `g ${otherName}`
  };
  const nutrientRows = ORDER.filter((key) => enabledNutrients[key]).map(
    (key) => ({
      per: `${formatDose(perAddition[key])}${nutrientSuffix[key]}`,
      total: `${formatDose(totalGrams[key])}${nutrientSuffix[key]}`
    })
  );

  const stabilizers = recipe.stabilizers.addingStabilizers
    ? [
        `${formatQuantity(recipe.stabilizers.sulfite)}g ${t(
          `PDF.${recipe.stabilizers.stabilizerType}`
        )} ${t("accountPage.or")} ${formatQuantity(
          recipe.stabilizers.campden
        )} ${t("campden")}`,
        `${formatQuantity(recipe.stabilizers.sorbate)}g ${t("PDF.ksorb")}`
      ]
    : [];

  const estimatedFg = parseNumber(recipe.data.fg);
  const estimatedOg = recipe.derived.ogPrimary;
  const backsweetenedFg = recipe.derived.backsweetenedFg;
  const primaryIngredients = ingredientRows.filter((line) => !line.secondary);
  const secondaryIngredients = ingredientRows.filter((line) => line.secondary);
  const primaryNotes = toNotes(recipe.data.notes?.primary ?? []);
  const secondaryNotes = toNotes(recipe.data.notes?.secondary ?? []);

  return {
    title: title?.trim() || t("PDF.pageTitle"),
    byline: t("byUser", { public_username: publicUsername ?? "Anonymous" }),
    overview: {
      totalVolume: [
        `${formatQuantity(recipe.derived.totalVolume)} ${unitDefaults.volume}`,
        nutrients.derived.goFerm.amount > 0
          ? `${formatQuantity(
              nutrients.derived.goFerm.amount,
              2
            )}g ${goFermLabel} ${t("PDF.with")} ${formatQuantity(
              nutrients.derived.goFerm.water,
              2
            )}ml ${t("water")}`
          : ""
      ],
      yeast: [
        `${formatDose(nutrients.data.inputs.yeastAmountG || "0")}g ${t(
          "PDF.of"
        )} ${yeastDescription}`.trim(),
        temperatureRange
      ]
    },
    metrics: [
      {
        key: "estimated-og",
        label: t("PDF.estimatedOG"),
        values: [formatGravity(estimatedOg), formatBrix(estimatedOg)]
      },
      {
        key: "estimated-fg",
        label: t("PDF.estimatedFG"),
        values: [formatGravity(estimatedFg), formatBrix(estimatedFg)]
      },
      {
        key: "backsweetened-fg",
        label: t("recipeBuilder.resultsLabels.backFG"),
        values: [
          formatGravity(backsweetenedFg),
          formatBrix(backsweetenedFg)
        ]
      },
      {
        key: "tolerance",
        label: t("PDF.tolerance"),
        values: [
          yeast?.tolerance != null
            ? `${formatRecipePdfNumber(yeast.tolerance, 1, locale, {
                minimum: 0,
                maximum: 100
              })}%`
            : "—",
          `${t("PDF.sugarBreak")} ${formatGravity(calcSb(estimatedOg))}`
        ]
      },
      {
        key: "expected-abv",
        label: t("PDF.expectedABV"),
        values: [
          `${formatRecipePdfNumber(recipe.derived.abv, 2, locale, {
            minimum: 0,
            maximum: 100
          })}%`,
          `${formatRecipePdfNumber(recipe.derived.delle, 0, locale, {
            minimum: 0
          })} ${t("DU")}`
        ]
      }
    ],
    nutrients: {
      protocol: t(`nuteSchedules.${nutrients.data.selected.schedule}`),
      numberOfAdditions: formatRecipePdfNumber(
        nutrients.data.inputs.numberOfAdditions || "1",
        0,
        locale,
        { minimum: 1 }
      ),
      perAddition: nutrientRows.map((row) => row.per),
      total: nutrientRows.map((row) => row.total)
    },
    stabilizers,
    remainingYan: `${formatRecipePdfNumber(
      nutrients.derived.remainingYanPpm,
      0,
      locale,
      { minimum: 0 }
    )} PPM`,
    primaryIngredients,
    secondaryIngredients,
    primaryNotes,
    secondaryNotes,
    additives,
    showPageTwo:
      secondaryIngredients.length > 0 ||
      additives.length > 0 ||
      secondaryNotes.length > 0,
    labels: {
      totalVolume: t("PDF.totalVolume"),
      yeast: t("PDF.yeast"),
      nutrient: t("PDF.nutrient"),
      numberOfAdditions: t("PDF.numberOfAdditions"),
      amountPerAddition: t("PDF.amount"),
      total: t("PDF.total"),
      stabilizers: t("PDF.stabilizers"),
      remainingYan: t("PDF.remaining"),
      primaryIngredients: t("PDF.primary"),
      secondaryIngredients: t("PDF.secondary"),
      weight: t("PDF.weight"),
      volume: t("PDF.volume"),
      primaryNotes: t("PDF.primaryNotes"),
      secondaryNotes: t("PDF.secondaryNotes"),
      details: t("PDF.details"),
      additives: t("PDF.additives"),
      additiveAmount: t("PDF.addAmount")
    }
  };
}
