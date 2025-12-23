import { RecipeV2Provider } from "@/components/providers/RecipeProviderV2";
import RecipeBuilder from "@/components/recipeBuilder/RecipeBuilder";
import initTranslations from "@/lib/i18n";

export default async function Home({
  params
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  await initTranslations(locale, ["default", "YeastTable"]);

  return (
    <RecipeV2Provider>
      <RecipeBuilder />
    </RecipeV2Provider>
  );
}
