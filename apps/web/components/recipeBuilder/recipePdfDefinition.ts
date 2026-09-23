import type {
  Content,
  Size,
  TableCell,
  TDocumentDefinitions
} from "pdfmake/interfaces";

import type { RecipePdfModel } from "./recipePdfModel";
import {
  RECIPE_PDF_COLUMN_WIDTHS,
  toPercentageWidths
} from "./recipePdfLayout";

type RecipePdfDefinitionInput = {
  model: RecipePdfModel;
  logoDataUrl: string;
};

const HEADER_COLOR = "#808080";
const TEXT_COLOR = "#1f2937";

function headerCell(text: string): TableCell {
  return {
    text,
    bold: true,
    color: TEXT_COLOR,
    fillColor: HEADER_COLOR,
    margin: [3, 3, 3, 3]
  };
}

function bodyCell(value: string | string[]): TableCell {
  const lines = (Array.isArray(value) ? value : [value]).filter(Boolean);

  return {
    stack: lines.map((text) => ({ text, margin: [0, 0, 0, 2] })),
    margin: [3, 3, 3, 1]
  };
}

function recipeTable(
  headers: string[],
  rows: TableCell[][],
  widths: Size[] | "*" | "auto" = "*"
): Content {
  return {
    table: {
      headerRows: 1,
      widths,
      body: [headers.map(headerCell), ...rows]
    },
    margin: [0, 8, 0, 0]
  };
}

function ingredientTable(
  model: RecipePdfModel,
  label: string,
  ingredients: RecipePdfModel["primaryIngredients"]
): Content {
  return recipeTable(
    [label, model.labels.weight, model.labels.volume],
    ingredients.map((ingredient, index) => [
      bodyCell(`${index + 1}. ${ingredient.name}`),
      bodyCell(ingredient.weight),
      bodyCell(ingredient.volume)
    ]),
    toPercentageWidths(RECIPE_PDF_COLUMN_WIDTHS.ingredients)
  );
}

function notesTable(
  model: RecipePdfModel,
  label: string,
  notes: RecipePdfModel["primaryNotes"]
): Content {
  return recipeTable(
    [label, model.labels.details],
    notes.map((note, index) => [
      bodyCell(`${index + 1}. ${note.title}`),
      bodyCell(note.details)
    ]),
    toPercentageWidths(RECIPE_PDF_COLUMN_WIDTHS.notes)
  );
}

export function createRecipePdfDefinition({
  model,
  logoDataUrl
}: RecipePdfDefinitionInput): TDocumentDefinitions {
  const content: Content[] = [
    {
      image: logoDataUrl,
      width: 204,
      alignment: "center"
    },
    {
      text: model.title,
      alignment: "center",
      fontSize: 24,
      color: "#1a202c",
      margin: [0, 4, 0, 0]
    },
    {
      text: model.byline,
      alignment: "center",
      fontSize: 11,
      color: "#4a5568"
    },
    recipeTable(
      [model.labels.totalVolume, model.labels.yeast],
      [[bodyCell(model.overview.totalVolume), bodyCell(model.overview.yeast)]],
      toPercentageWidths(RECIPE_PDF_COLUMN_WIDTHS.overview)
    ),
    recipeTable(
      model.metrics.map((metric) => metric.label),
      [model.metrics.map((metric) => bodyCell(metric.values))],
      toPercentageWidths(RECIPE_PDF_COLUMN_WIDTHS.metrics)
    ),
    recipeTable(
      [
        model.labels.nutrient,
        model.labels.numberOfAdditions,
        model.labels.amountPerAddition,
        model.labels.total
      ],
      [
        [
          bodyCell(model.nutrients.protocol),
          bodyCell(model.nutrients.numberOfAdditions),
          bodyCell(model.nutrients.perAddition),
          bodyCell(model.nutrients.total)
        ]
      ],
      toPercentageWidths(RECIPE_PDF_COLUMN_WIDTHS.nutrients)
    )
  ];

  const stabilizerHeaders = model.stabilizers.length
    ? [model.labels.stabilizers, model.labels.remainingYan]
    : [model.labels.remainingYan];
  const stabilizerCells = model.stabilizers.length
    ? [bodyCell(model.stabilizers), bodyCell(model.remainingYan)]
    : [bodyCell(model.remainingYan)];

  content.push(
    recipeTable(
      stabilizerHeaders,
      [stabilizerCells],
      model.stabilizers.length
        ? toPercentageWidths(RECIPE_PDF_COLUMN_WIDTHS.split)
        : ["100%"]
    ),
    ingredientTable(
      model,
      model.labels.primaryIngredients,
      model.primaryIngredients
    )
  );

  if (model.primaryNotes.length) {
    content.push(
      notesTable(model, model.labels.primaryNotes, model.primaryNotes)
    );
  }

  if (model.showPageTwo) {
    content.push(
      { text: "", pageBreak: "before" },
      {
        image: logoDataUrl,
        width: 204,
        alignment: "center",
        margin: [0, 0, 0, 8]
      }
    );

    if (model.secondaryIngredients.length) {
      content.push(
        ingredientTable(
          model,
          model.labels.secondaryIngredients,
          model.secondaryIngredients
        )
      );
    }

    if (model.additives.length) {
      content.push(
        recipeTable(
          [model.labels.additives, model.labels.additiveAmount],
          model.additives.map((additive, index) => [
            bodyCell(`${index + 1}. ${additive.name}`),
            bodyCell(additive.amount)
          ]),
          toPercentageWidths(RECIPE_PDF_COLUMN_WIDTHS.additives)
        )
      );
    }

    if (model.secondaryNotes.length) {
      content.push(
        notesTable(model, model.labels.secondaryNotes, model.secondaryNotes)
      );
    }
  }

  return {
    pageSize: "LETTER",
    pageMargins: [36, 30, 36, 36],
    content,
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
      color: TEXT_COLOR
    },
    info: {
      title: model.title,
      author: "MeadTools",
      subject: "Recipe PDF"
    }
  };
}

export function getRecipePdfFilename(title?: string): string {
  const normalized = (title?.trim() || "meadtools-recipe")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return `${normalized || "meadtools-recipe"}.pdf`;
}
