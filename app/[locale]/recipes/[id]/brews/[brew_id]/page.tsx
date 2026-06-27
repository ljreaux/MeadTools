import { notFound } from "next/navigation";

import { CardWrapper } from "@/components/CardWrapper";
import { BrewViewer } from "@/components/brews/BrewViewer";
import { getPublicBrewForRecipe } from "@/lib/db/brews";

export default async function PublicRecipeBrewPage({
  params
}: {
  params: Promise<{ id: string; brew_id: string }>;
}) {
  const { id, brew_id } = await params;
  const recipeId = Number(id);

  if (!Number.isInteger(recipeId)) {
    notFound();
  }

  const brew = await getPublicBrewForRecipe(recipeId, brew_id);

  if (!brew) {
    notFound();
  }

  return (
    <main className="flex w-full justify-center py-[6rem]">
      <CardWrapper>
        <BrewViewer
          brew={brew}
          backHref={`/recipes/${recipeId}`}
          recipeHref={`/recipes/${recipeId}`}
          backLabelKey="publicBrews.backToRecipe"
        />
      </CardWrapper>
    </main>
  );
}
