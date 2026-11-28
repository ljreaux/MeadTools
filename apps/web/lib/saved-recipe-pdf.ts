import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createInstance } from "i18next";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";
import { calculateRecipeDerivedState, calculateRecipeStabilizerResults } from "@meadtools/core/derived";
import { i18nConfig, type SupportedLocale } from "@meadtools/i18n";
import { loadTranslationResource } from "@meadtools/i18n/resources";
import type { RecipeDataV2 } from "@meadtools/schemas";

import {
  createRecipePdfDefinition,
  getRecipePdfFilename
} from "@/components/recipeBuilder/recipePdfDefinition";
import { createRecipePdfModel } from "@/components/recipeBuilder/recipePdfModel";

type SavedRecipePdf = {
  data: RecipeDataV2;
  title: string;
  publicUsername: string;
  locale: SupportedLocale;
  yeast?: Parameters<typeof createRecipePdfModel>[0]["yeast"];
};

pdfMake.addVirtualFileSystem(pdfFonts);

export async function renderSavedRecipePdf({ data, title, publicUsername, locale, yeast }: SavedRecipePdf) {
  const derived = calculateRecipeDerivedState(data);
  const settings = data.stabilizers;
  const doses = calculateRecipeStabilizerResults({
    addingStabilizers: settings.adding,
    phReading: settings.phReading,
    stabilizerType: settings.type,
    totalVolumeL: derived.totalVolumeL,
    abv: derived.abv
  });
  const locales = [...new Set([locale, i18nConfig.defaultLocale])];
  const [resources, logo] = await Promise.all([
    Promise.all(locales.map(async (language) => [
      language, { default: await loadTranslationResource(language, "default") }
    ] as const)),
    readFile(join(process.cwd(), "public", "pdf-logo.png"))
  ]);
  const i18n = createInstance();
  await i18n.init({
    lng: locale,
    fallbackLng: i18nConfig.defaultLocale,
    defaultNS: "default",
    resources: Object.fromEntries(resources)
  });
  const model = createRecipePdfModel({
    recipe: {
      data,
      derived,
      stabilizers: { ...doses, addingStabilizers: settings.adding, stabilizerType: settings.type }
    },
    nutrientData: derived.nutrientValueForRecipe,
    title,
    publicUsername,
    yeast,
    t: i18n.t,
    i18n
  });
  const definition = createRecipePdfDefinition({
    model,
    logoDataUrl: `data:image/png;base64,${logo.toString("base64")}`
  });

  return {
    filename: getRecipePdfFilename(title),
    base64: await pdfMake.createPdf(definition).getBase64()
  };
}
