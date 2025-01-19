import React from "react";
import PrintableIframe from "../recipeBuilder/PrintableIframe";
import { useRecipe } from "../providers/SavedRecipeProvider";
import { useNutrients } from "../providers/SavedNutrientProvider";
import RecipeView from "../recipeBuilder/RecipeView";
import SaveRecipeCopy from "./SaveRecipeCopy";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { buttonVariants } from "../ui/button";

function PublicRecipe() {
  const { t } = useTranslation();
  const recipeData = useRecipe();
  const nutrientData = useNutrients();
  return (
    <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
      <div className="flex flex-col p-12 py-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1000px] relative">
        <SaveRecipeCopy />
        <h1 className="text-3xl text-center">
          {recipeData.recipeNameProps.value}
        </h1>
        {recipeData.public_username && (
          <p className="w-full text-right">
            {t("byUser", { public_username: recipeData.public_username })}
          </p>
        )}
        <PrintableIframe
          content={
            <RecipeView nutrientData={nutrientData} recipeData={recipeData} />
          }
        />
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
