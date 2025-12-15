"use client";

import useCards from "@/hooks/useCards";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { CardWrapper } from "../CardWrapper";

import VolumeInputs from "../nutrientCalc/VolumeInputs";
import YeastDetails from "../nutrientCalc/YeastDetails";
import AdditionalDetails from "../nutrientCalc/AdditionalDetails";
import NutrientSelector from "../nutrientCalc/NutrientSelector";
import Results from "../nutrientCalc/Results";
import RecipeCalculatorSideBar from "../recipeBuilder/Sidebar";
import Units from "../recipeBuilder/Units";
import Ingredients from "../recipeBuilder/Ingredients";
import ScaleRecipeForm from "../recipeBuilder/ScaleRecipeForm";
import Stabilizers from "../recipeBuilder/Stabilizers";
import Additives from "../recipeBuilder/Additives";
import Notes from "../recipeBuilder/Notes";
import PDF from "../recipeBuilder/PDF";
import IngredientResults from "../recipeBuilder/Results";
import { useRecipe } from "../providers/SavedRecipeProvider";
import { useNutrients } from "../providers/SavedNutrientProvider";
import SaveChanges from "./SaveChanges";
import SaveNew from "./SaveNew";
import DeleteRecipe from "./DeleteRecipe";
import { useEffect, useState } from "react";
import CommentsSection from "./comments/CommentsSection";
import RecipeCardHeader from "./RecipeCardHeader";

const cardConfig = [
  {
    key: "card 1",
    heading: "recipeBuilder.homeHeading",
    components: [
      <Units key="units" useRecipe={useRecipe} />,
      <Ingredients key="ingredients" useRecipe={useRecipe} />,
      <IngredientResults key="ingredientResults" useRecipe={useRecipe} />,
      <ScaleRecipeForm key="scaleRecipeForm" useRecipe={useRecipe} />
    ]
  },
  {
    key: "card 2",
    heading: "nutesHeading",
    components: [
      <VolumeInputs key="volumeInputs" disabled useNutrients={useNutrients} />,
      <YeastDetails key="yeastDetails" useNutrients={useNutrients} />
    ]
  },
  {
    key: "card 3",
    heading: "nuteResults.label",
    components: [
      <NutrientSelector key="nutrientSelector" useNutrients={useNutrients} />,
      <Results key="results" useNutrients={useNutrients} />,
      <AdditionalDetails key="additionalDetails" useNutrients={useNutrients} />
    ]
  },
  {
    key: "card 4",
    heading: "stabilizersHeading",
    tooltip: {
      body: "tipText.stabilizers",
      link: "https://wiki.meadtools.com/en/process/stabilization"
    },
    components: [<Stabilizers key="stabilizers" useRecipe={useRecipe} />]
  },
  {
    key: "card 5",
    heading: "additivesHeading",
    components: [<Additives key="additives" useRecipe={useRecipe} />]
  },
  {
    key: "card 6",
    heading: "notes.title",
    components: [<Notes key="notes" useRecipe={useRecipe} />]
  },
  {
    key: "card 7",
    heading: "PDF.title",
    components: [
      <PDF key="pdf" useRecipe={useRecipe} useNutrients={useNutrients} />
    ]
  }
];

function OwnerRecipe({
  pdfRedirect,
  privateRecipe,
  emailNotifications,
  recipeId
}: {
  pdfRedirect: boolean;
  privateRecipe?: boolean;
  emailNotifications?: boolean;
  recipeId: number;
}) {
  const [isPrivate, setIsPrivate] = useState(privateRecipe ?? false);
  const [notify, setNotify] = useState(emailNotifications ?? false);
  const [nameEditable, setNameEditable] = useState(false);
  const recipe = useRecipe();
  const { t } = useTranslation();

  const cards = cardConfig.map(({ key, heading, components, tooltip }) => (
    <CardWrapper key={key}>
      <RecipeCardHeader
        heading={heading}
        tooltip={tooltip}
        recipe={recipe}
        nameEditable={nameEditable}
        setNameEditable={setNameEditable}
        isPrivate={isPrivate}
        setIsPrivate={setIsPrivate}
        notify={notify}
        setNotify={setNotify}
      />

      {components}

      {!privateRecipe && <CommentsSection recipeId={recipeId} />}
    </CardWrapper>
  ));

  const { card, currentStepIndex, back, next, goTo } = useCards(cards);

  useEffect(() => {
    if (pdfRedirect) {
      goTo(cards.length - 1);
    }
  }, [pdfRedirect]);

  return (
    <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
      <RecipeCalculatorSideBar goTo={goTo} cardNumber={currentStepIndex + 1}>
        <div className="py-2">
          <SaveChanges privateRecipe={isPrivate} emailNotifications={notify} />
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
          <SaveChanges privateRecipe={isPrivate} bottom />
        ) : (
          <Button variant="secondary" onClick={next} className="w-full">
            {t("buttonLabels.next")}
          </Button>
        )}
      </div>
    </div>
  );
}

export default OwnerRecipe;
