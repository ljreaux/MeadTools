"use client";

import useCards from "@/hooks/useCards";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { CardWrapper } from "../CardWrapper";
import RecipeCalculatorSideBar from "../recipeBuilder/Sidebar";
import SaveChanges from "./SaveChanges";
import SaveNew from "./SaveNew";
import DeleteRecipe from "./DeleteRecipe";
import { useEffect, useState } from "react";
import CommentsSection from "./comments/CommentsSection";
import RecipeCardHeader from "./RecipeCardHeader";
import UnitsV2 from "../recipeBuilder/UnitsV2";
import IngredientsV2 from "../recipeBuilder/IngredientsV2";
import IngredientResultsV2 from "../recipeBuilder/ResultsV2";
import ScaleRecipeFormV2 from "../recipeBuilder/ScaleRecipeFormV2";
import VolumeInputsV2 from "../nutrientCalc/VolumeInputsV2";
import YeastDetailsV2 from "../nutrientCalc/YeastDetailsV2";
import NutrientSelectorV2 from "../nutrientCalc/NutrientSelectorV2";
import ResultsV2 from "../nutrientCalc/ResultsV2";
import AdditionalDetailsV2 from "../nutrientCalc/AdditionalDetailsV2";
import StabilizersV2 from "../recipeBuilder/StabilizersV2";
import AdditivesV2 from "../recipeBuilder/AdditivesV2";
import NotesV2 from "../recipeBuilder/NotesV2";
import RecipePdf from "../recipeBuilder/RecipePdf";
import useRecipeVersionGate from "@/hooks/useRecipeVersionGate";
import { RecipeWithParsedFields } from "@/hooks/reactQuery/useRecipeQuery";
import { NutrientProviderV2 } from "../providers/NutrientProviderV2";
import { useRecipeV2 } from "../providers/RecipeProviderV2";

const cardConfig = [
  {
    key: "v2-card-1",
    heading: "recipeBuilder.homeHeading",
    components: [
      <UnitsV2 key="unitsV2" />,
      <IngredientsV2 key="ingredientsV2" />,
      <IngredientResultsV2 key="ingredientResultsV2" />,
      <ScaleRecipeFormV2 key="scaleIngredientsForm" />
    ]
  },
  {
    key: "card 2",
    heading: "nutesHeading",
    components: [
      <VolumeInputsV2 key="volumeInputs" mode="embedded" />,
      <YeastDetailsV2 key="yeastDetails" />
    ]
  },
  {
    key: "card 3",
    heading: "nuteResults.label",
    components: [
      <NutrientSelectorV2 key="nutrientSelector" />,
      <ResultsV2 key="results" />,
      <AdditionalDetailsV2 key="additionalDetails" />
    ]
  },
  {
    key: "card 4",
    heading: "stabilizersHeading",
    tooltip: {
      body: "tipText.stabilizers",
      link: "https://wiki.meadtools.com/en/process/stabilization"
    },
    components: [<StabilizersV2 key="stabilizers" />]
  },
  {
    key: "card 5",
    heading: "additivesHeading",
    components: [<AdditivesV2 key="additives" />]
  },
  {
    key: "card 6",
    heading: "notes.title",
    components: [<NotesV2 key="notes" />]
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
        recipeNameProps={{ recipeName, setRecipeName }}
        nameEditable={nameEditable}
        setNameEditable={setNameEditable}
        isPrivate={isPrivate}
        setIsPrivate={setIsPrivate}
        notify={notify}
        setNotify={setNotify}
      />

      {components}

      {!recipe.private && <CommentsSection recipeId={recipe.id} />}
    </CardWrapper>
  ));

  const { card, currentStepIndex, back, next, goTo } = useCards(cards);
  const {
    derived: { nutrientValueForRecipe },
    meta: { setNutrients }
  } = useRecipeV2();

  useEffect(() => {
    if (pdfRedirect) {
      goTo(cards.length - 1);
    }
  }, [pdfRedirect]);

  return (
    <NutrientProviderV2
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
    </NutrientProviderV2>
  );
}

export default OwnerRecipe;
