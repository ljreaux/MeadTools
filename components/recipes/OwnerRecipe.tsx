"use client";

import useCards from "@/hooks/useCards";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { CardWrapper } from "../CardWrapper";
import RecipeCalculatorSideBar from "../recipeBuilder/Sidebar";
import SaveChanges from "./SaveChanges";
import SaveNew from "./SaveNew";
import DeleteRecipe from "./DeleteRecipe";
import { useEffect, useRef, useState } from "react";
import CommentsSection from "./comments/CommentsSection";
import RecipeCardHeader from "./RecipeCardHeader";
import Units from "../recipeBuilder/Units";
import Ingredients from "../recipeBuilder/Ingredients";
import IngredientResults from "../recipeBuilder/Results";
import ScaleRecipeForm from "../recipeBuilder/ScaleRecipeForm";
import VolumeInputs from "../nutrientCalc/VolumeInputs";
import YeastDetails from "../nutrientCalc/YeastDetails";
import NutrientSelector from "../nutrientCalc/NutrientSelector";
import Results from "../nutrientCalc/Results";
import AdditionalDetails from "../nutrientCalc/AdditionalDetails";
import Stabilizers from "../recipeBuilder/Stabilizers";
import Additives from "../recipeBuilder/Additives";
import Notes from "../recipeBuilder/Notes";
import RecipePdf from "../recipeBuilder/RecipePdf";
import useRecipeVersionGate from "@/hooks/useRecipeVersionGate";
import { RecipeWithParsedFields } from "@/hooks/reactQuery/useRecipeQuery";
import { NutrientProvider } from "../providers/NutrientProvider";
import { useRecipe } from "../providers/RecipeProvider";
import { useBanner } from "../ui/banner";

const cardConfig = [
  {
    key: "card-1",
    heading: "recipeBuilder.homeHeading",
    components: [
      <Units key="units" />,
      <Ingredients key="ingredients" />,
      <IngredientResults key="ingredientResults" />,
      <ScaleRecipeForm key="scaleIngredientsForm" />
    ]
  },
  {
    key: "card 2",
    heading: "nutesHeading",
    components: [
      <VolumeInputs key="volumeInputs" mode="embedded" />,
      <YeastDetails key="yeastDetails" />
    ]
  },
  {
    key: "card 3",
    heading: "nuteResults.label",
    components: [
      <NutrientSelector key="nutrientSelector" />,
      <Results key="results" />,
      <AdditionalDetails key="additionalDetails" />
    ]
  },
  {
    key: "card 4",
    heading: "stabilizersHeading",
    tooltip: {
      body: "tipText.stabilizers",
      link: "https://wiki.meadtools.com/en/process/stabilization"
    },
    components: [<Stabilizers key="stabilizers" />]
  },
  {
    key: "card 5",
    heading: "additivesHeading",
    components: [<Additives key="additives" />]
  },
  {
    key: "card 6",
    heading: "notes.title",
    components: [<Notes key="notes" />]
  },
  {
    key: "card 7",
    heading: "PDF.title",
    components: [<RecipePdf key="pdf" />]
  }
];

function OwnerRecipe({
  pdfRedirect,
  recipe
}: {
  pdfRedirect: boolean;
  recipe: RecipeWithParsedFields;
}) {
  useRecipeVersionGate(recipe);
  const [isPrivate, setIsPrivate] = useState(recipe.private ?? false);
  const [notify, setNotify] = useState(recipe.emailNotifications ?? false);
  const [nameEditable, setNameEditable] = useState(false);
  const [recipeName, setRecipeName] = useState(recipe.name);
  const { t } = useTranslation();

  const cards = cardConfig.map(({ key, heading, components, tooltip }) => (
    <CardWrapper key={key}>
      <RecipeCardHeader
        heading={heading}
        tooltip={tooltip}
        recipe={recipe}
        recipeNameProps={{
          recipeName,
          setRecipeName: (v) => {
            setRecipeName(v);
            markDirty();
          }
        }}
        nameEditable={nameEditable}
        setNameEditable={setNameEditable}
        isPrivate={isPrivate}
        setIsPrivate={(v) => {
          setIsPrivate(v);
          markDirty();
        }}
        notify={notify}
        setNotify={(v) => {
          setNotify(v);
          markDirty();
        }}
      />

      {components}

      {!recipe.private && <CommentsSection recipeId={recipe.id} />}
    </CardWrapper>
  ));

  const { card, currentStepIndex, back, next, goTo } = useCards(cards);
  const {
    derived: { nutrientValueForRecipe },
    meta: { setNutrients, isDirty, markDirty }
  } = useRecipe();

  useEffect(() => {
    if (pdfRedirect) {
      goTo(cards.length - 1);
    }
  }, [pdfRedirect]);

  const { showBanner, requestDismiss } = useBanner();
  const bannerIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (isDirty) {
      // already showing
      if (bannerIdRef.current) return;

      const id = showBanner({
        variant: "warning",
        dismissible: true,
        duration: 0, // not timed
        title: "Unsaved changes",
        description: "You’ve made changes to this recipe. Don’t forget to save."
      });

      bannerIdRef.current = id;
      return;
    }

    // isDirty === false -> dismiss if present
    if (bannerIdRef.current) {
      requestDismiss(bannerIdRef.current);
      bannerIdRef.current = null;
    }
  }, [isDirty, showBanner, requestDismiss]);

  return (
    <NutrientProvider
      mode="controlled"
      value={nutrientValueForRecipe}
      onChange={setNutrients}
    >
      <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
        <RecipeCalculatorSideBar goTo={goTo} cardNumber={currentStepIndex + 1}>
          <div className="py-2">
            <SaveChanges
              privateRecipe={isPrivate}
              emailNotifications={notify}
              name={recipeName}
            />
            <SaveNew />
            <DeleteRecipe />
          </div>
        </RecipeCalculatorSideBar>
        {card}

        <div className="flex py-12 gap-4 w-11/12 max-w-[1200px] items-center justify-center">
          {currentStepIndex === 0 || (
            <Button variant="secondary" onClick={back} className="w-full">
              {t("buttonLabels.back")}
            </Button>
          )}

          {currentStepIndex === cards.length - 1 ? (
            <SaveChanges privateRecipe={isPrivate} name={recipeName} bottom />
          ) : (
            <Button variant="secondary" onClick={next} className="w-full">
              {t("buttonLabels.next")}
            </Button>
          )}
        </div>
      </div>
    </NutrientProvider>
  );
}

export default OwnerRecipe;
