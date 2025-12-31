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

function PublicRecipe({
  recipe,
  userRating
}: {
  recipe: RecipeWithParsedFields;
  userRating?: number;
}) {
  useRecipeVersionGate(recipe);

  const { t } = useTranslation();
  const { id } = useParams();
  const {
    derived: { nutrientValueForRecipe },
    meta: { setNutrients }
  } = useRecipe();
  return (
    <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
      <div className="flex flex-col p-12 py-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1000px] relative">
        {/* <SaveRecipeCopy /> */}
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
        <RateRecipe userRating={userRating} />
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
        <CommentsSection recipeId={Number(id)} />
        <Link
          href={"/public-recipes"}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("backToList")}
        </Link>
      </div>
    </div>
  );
}

export default PublicRecipe;
