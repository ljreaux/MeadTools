import { useTranslation } from "react-i18next";
import Link from "next/link";
import { buttonVariants } from "../ui/button";
import Rating from "./Rating";

import CommentsSection from "./comments/CommentsSection";
import { useParams } from "next/navigation";
import RecipePdf from "../recipeBuilder/RecipePdf";
import { NutrientProvider } from "../providers/NutrientProvider";
import { RecipeWithParsedFields } from "@/hooks/reactQuery/useRecipeQuery";
import RateRecipe from "./RateRecipe";
import useRecipeVersionGate from "@/hooks/useRecipeVersionGate";
import { useRecipe } from "../providers/RecipeProvider";
import SaveRecipeCopy from "./SaveRecipeCopy";
import { cn } from "@/lib/utils";
import { usePublicRecipeBrews } from "@/hooks/reactQuery/usePublicRecipeBrews";

export type RecipeViewCapabilities = {
  canSaveCopy: boolean;
  canRate: boolean;
  canComment: boolean;
};

const PUBLIC_RECIPE_CAPABILITIES: RecipeViewCapabilities = {
  canSaveCopy: true,
  canRate: true,
  canComment: true
};

function PublicRecipe({
  recipe,
  userRating,
  capabilities = PUBLIC_RECIPE_CAPABILITIES,
  embedded = false,
  backHref = "/public-recipes"
}: {
  recipe: RecipeWithParsedFields;
  userRating?: number;
  capabilities?: RecipeViewCapabilities;
  embedded?: boolean;
  backHref?: string;
}) {
  useRecipeVersionGate(recipe);

  const { t } = useTranslation();
  const { id } = useParams();
  const { data: publicBrews = [] } = usePublicRecipeBrews(id as string);
  const {
    derived: { nutrientValueForRecipe },
    meta: { setNutrients }
  } = useRecipe();
  return (
    <div
      className={cn(
        "w-full",
        !embedded && "flex flex-col items-center justify-center py-[6rem]"
      )}
    >
      <div
        className={cn(
          "relative flex w-full max-w-[1000px] flex-col gap-4",
          !embedded && "w-11/12 rounded-xl bg-background p-8 sm:p-12"
        )}
      >
        {capabilities.canSaveCopy ? <SaveRecipeCopy /> : null}
        <h1 className="text-3xl text-center">{recipe.name}</h1>

        <p className="w-full text-right">
          {t("byUser", {
            public_username: recipe.public_username ?? "Anonymous"
          })}
        </p>

        <Rating
          averageRating={recipe.averageRating ?? 0}
          numberOfRatings={recipe.numberOfRatings ?? 0}
        />
        {capabilities.canRate ? <RateRecipe userRating={userRating} /> : null}
        <NutrientProvider
          mode="controlled"
          value={nutrientValueForRecipe}
          onChange={setNutrients}
        >
          <RecipePdf
            publicUsername={recipe.public_username ?? ""}
            title={recipe.name}
          />
        </NutrientProvider>
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3">
            <h2 className="text-lg font-semibold">
              {t("publicBrews.title", "Public brews")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "publicBrews.description",
                "Brewers have shared these batches from this recipe."
              )}
            </p>
          </div>
          {publicBrews.length ? (
            <div className="divide-y divide-border">
              {publicBrews.map((brew) => (
                <div
                  key={brew.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {brew.name || brew.id}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t(`brewStage.${brew.stage}`, brew.stage)}
                      {brew.owner?.displayName
                        ? ` · ${t("byUser", {
                            public_username: brew.owner.displayName
                          })}`
                        : ""}
                    </div>
                  </div>
                  <Link
                    href={`/recipes/${recipe.id}/brews/${brew.id}`}
                    className={buttonVariants({
                      variant: "secondary",
                      size: "sm"
                    })}
                  >
                    {t("publicBrews.viewBrew", "View brew")}
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t(
                "publicBrews.empty",
                "No public brews have been shared for this recipe yet."
              )}
            </p>
          )}
        </section>
        {capabilities.canComment ? (
          <CommentsSection recipeId={Number(id)} />
        ) : null}
        <Link
          href={backHref}
          className={buttonVariants({ variant: "secondary" })}
        >
          {embedded
            ? t("admin.recipes.back", "Back to recipes")
            : t("backToList")}
        </Link>
      </div>
    </div>
  );
}

export default PublicRecipe;
