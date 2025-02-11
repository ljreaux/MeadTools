"use client";

import useCards from "@/hooks/useCards";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { CardWrapper } from "../CardWrapper";
import Ingredients from "./Ingredients";
import VolumeInputs from "../nutrientCalc/VolumeInputs";
import YeastDetails from "../nutrientCalc/YeastDetails";
import AdditionalDetails from "../nutrientCalc/AdditionalDetails";
import NutrientSelector from "../nutrientCalc/NutrientSelector";
import Results from "../nutrientCalc/Results";
import IngredientResults from "./Results";
import Units from "./Units";
import ScaleRecipeForm from "./ScaleRecipeForm";
import Stabilizers from "./Stabilizers";
import Tooltip from "../Tooltips";
import Additives from "./Additives";
import Notes from "./Notes";
import PDF from "./PDF";

import RecipeCalculatorSideBar from "./Sidebar";
import SaveRecipe from "./SaveRecipe";
import ResetButton from "./ResetButton";
import { useRecipe } from "../providers/RecipeProvider";
import { useNutrients } from "../providers/NutrientProvider";
import DesiredBatchDetails from "./DesiredBatchDetails";
import { useTutorial } from "@/hooks/useTutorial";
import { tutorialSteps } from "@/lib/tutorialSteps";

const cardConfig = [
  {
    key: "card 1",
    heading: "recipeBuilder.homeHeading",
    components: [
      <Units key="units" useRecipe={useRecipe} />,
      <DesiredBatchDetails key="batch details" />,
      <Ingredients key="ingredients" useRecipe={useRecipe} />,
      <IngredientResults key="ingredientResults" useRecipe={useRecipe} />,
      <ScaleRecipeForm key="scaleRecipeForm" useRecipe={useRecipe} />,
    ],
  },
  {
    key: "card 2",
    heading: "nutesHeading",
    components: [
      <VolumeInputs key="volumeInputs" disabled useNutrients={useNutrients} />,
      <YeastDetails key="yeastDetails" useNutrients={useNutrients} />,
      <AdditionalDetails key="additionalDetails" useNutrients={useNutrients} />,
    ],
  },
  {
    key: "card 3",
    heading: "nuteResults.label",
    components: [
      <NutrientSelector key="nutrientSelector" useNutrients={useNutrients} />,
      <Results key="results" useNutrients={useNutrients} />,
    ],
  },
  {
    key: "card 4",
    heading: "stabilizersHeading",
    tooltip: {
      body: "tipText.stabilizers",
      link: "https://meadmaking.wiki/en/process/stabilization",
    },
    components: [<Stabilizers key="stabilizers" useRecipe={useRecipe} />],
  },
  {
    key: "card 5",
    heading: "additivesHeading",
    components: [<Additives key="additives" useRecipe={useRecipe} />],
  },
  {
    key: "card 6",
    heading: "notes.title",
    components: [<Notes key="notes" useRecipe={useRecipe} />],
  },
  {
    key: "card 7",
    heading: "PDF.title",
    components: [
      <PDF key="pdf" useRecipe={useRecipe} useNutrients={useNutrients} />,
    ],
  },
];

function RecipeBuilder() {
  const cards = cardConfig.map(({ key, heading, components, tooltip }) => (
    <CardWrapper key={key}>
      <Heading text={heading} toolTipProps={tooltip} />
      {components}
    </CardWrapper>
  ));

  const { card, currentStepIndex, back, next, goTo } = useCards(cards);
  const { t } = useTranslation();
  const { TutorialComponent, sidebarOpen } = useTutorial(tutorialSteps);

  return (
    <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
      <TutorialComponent />
      <RecipeCalculatorSideBar
        goTo={goTo}
        cardNumber={currentStepIndex + 1}
        forceOpen={sidebarOpen}
      >
        <div className="py-2">
          <SaveRecipe />
          <ResetButton />
        </div>
      </RecipeCalculatorSideBar>

      {card}

      <div className="flex py-12 gap-4 w-11/12 max-w-[1000px] items-center justify-center">
        <Button
          variant={"secondary"}
          onClick={back}
          className="w-full"
          disabled={currentStepIndex === 0}
        >
          {t("buttonLabels.back")}
        </Button>

        <Button
          className="w-full"
          variant={"secondary"}
          onClick={next}
          disabled={currentStepIndex === cards.length - 1}
        >
          {t("buttonLabels.next")}
        </Button>
      </div>
    </div>
  );
}

export default RecipeBuilder;

const Heading = ({
  text,
  toolTipProps,
}: {
  text: string;
  toolTipProps?: { body: string; link: string };
}) => {
  const { t } = useTranslation();
  return (
    <h1 className="text-3xl text-center">
      {t(text)}{" "}
      {toolTipProps && (
        <Tooltip {...toolTipProps} body={t(toolTipProps.body)} />
      )}
    </h1>
  );
};
