"use client";

import useCards from "@/hooks/useCards";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { CardWrapper } from "../CardWrapper";

import Tooltip from "../Tooltips";
import RecipeCalculatorSideBar from "./Sidebar";

import { useTutorial } from "@/hooks/useTutorial";
import { stepCards } from "@/lib/tutorialSteps";
import { useEffect, useState, useCallback } from "react";
import type { Step } from "react-joyride";

// recipe builder components
import Units from "./Units";
import DesiredBatchDetails from "./DesiredBatchDetails";
import Ingredients from "./Ingredients";
import IngredientResults from "./Results";
import ScaleRecipeForm from "./ScaleRecipeForm";
import Stabilizers from "./Stabilizers";
import Additives from "./Additives";
import Notes from "./Notes";
import RecipePdf from "./RecipePdf";

// nutrient components
import VolumeInputs from "../nutrientCalc/VolumeInputs";
import YeastDetails from "../nutrientCalc/YeastDetails";
import NutrientSelector from "../nutrientCalc/NutrientSelector";
import Results from "../nutrientCalc/Results";
import AdditionalDetails from "../nutrientCalc/AdditionalDetails";

// ✅  providers
import { useRecipe } from "../providers/RecipeProvider";
import { NutrientProvider } from "../providers/NutrientProvider";

// ✅  reset + mock save
import ResetButton from "./ResetButton";
import MockSaveRecipe from "./MockSaveRecipe";
import { RecipeWithParsedFields } from "@/hooks/reactQuery/useRecipeQuery";
import useRecipeVersionGate from "@/hooks/useRecipeVersionGate";

type CardConfig = {
  key: string;
  heading: string;
  components: React.ReactNode[];
  tooltip?: {
    body: string;
    link: string;
  };
};

const cardConfig: CardConfig[] = [
  {
    key: "card-1",
    heading: "recipeBuilder.homeHeading",
    components: [
      <Units key="units" />,
      <DesiredBatchDetails key="DesiredBatchDetails" />,
      <Ingredients key="ingredients" />,
      <IngredientResults key="ingredientResults" />,
      <ScaleRecipeForm key="scaleIngredientsForm" />
    ]
  },
  {
    key: "card-2",
    heading: "nutesHeading",
    components: [
      // match embedded behavior (same as RecipeBuilder)
      <VolumeInputs key="volumeInputs" mode="embedded" />,
      <YeastDetails key="yeastDetails" />
    ]
  },
  {
    key: "card-3",
    heading: "nuteResults.label",
    components: [
      <NutrientSelector key="nutrientSelector" />,
      <Results key="results" />,
      <AdditionalDetails key="additionalDetails" />
    ]
  },
  {
    key: "card-4",
    heading: "stabilizersHeading",
    tooltip: {
      body: "tipText.stabilizers",
      link: "https://wiki.meadtools.com/en/process/stabilization"
    },
    components: [<Stabilizers key="stabilizers" />]
  },
  {
    key: "card-5",
    heading: "additivesHeading",
    components: [<Additives key="additives" />]
  },
  {
    key: "card-6",
    heading: "notes.title",
    components: [<Notes key="notes" />]
  },
  {
    key: "card-7",
    heading: "PDF.title",
    components: [<RecipePdf key="pdf" />]
  }
];

function RecipeBuilderTutorial({ recipe }: { recipe: RecipeWithParsedFields }) {
  useRecipeVersionGate(recipe);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMobile(window.innerWidth < 768);

      const handleResize = () => setIsMobile(window.innerWidth < 768);
      window.addEventListener("resize", handleResize);

      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  const cards = cardConfig.map(({ key, heading, components, tooltip }) => (
    <CardWrapper key={key}>
      <Heading text={heading} toolTipProps={tooltip} />
      {components}
    </CardWrapper>
  ));

  const { card, currentStepIndex, back, next, goTo } = useCards(cards);
  const { t } = useTranslation();

  const [currentTutorialSteps, setCurrentTutorialSteps] = useState<Step[]>([]);

  const transformSteps = (arr: Step[]) =>
    arr.map((step) => ({
      ...step,
      placement:
        isMobile && (step.placement === "left" || step.placement === "right")
          ? "top"
          : step.placement,
      content:
        typeof step.content === "string" ? t(step.content) : step.content,
      hideFooter: typeof step.content !== "string" && true
    }));

  const specialCallbacks = {
    [currentTutorialSteps.length - 1]: () => {
      const isNextStep = !!stepCards[currentStepIndex + 1];
      if (isNextStep) next();
    }
  };

  useEffect(() => {
    const currentSteps = transformSteps(stepCards[currentStepIndex]);
    setCurrentTutorialSteps(currentSteps);
  }, [currentStepIndex, isMobile]);

  const { TutorialComponent, sidebarOpen } = useTutorial(
    currentTutorialSteps,
    specialCallbacks
  );

  // ✅ hook recipe  -> feed nutrients provider in controlled mode (same as RecipeBuilder)
  const {
    derived: { nutrientValueForRecipe },
    meta: { setNutrients }
  } = useRecipe();

  const resetFlow = useCallback(() => {
    goTo(0);
  }, [goTo]);

  return (
    <NutrientProvider
      mode="controlled"
      value={nutrientValueForRecipe}
      onChange={setNutrients}
    >
      <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
        <TutorialComponent />

        <RecipeCalculatorSideBar
          goTo={goTo}
          cardNumber={currentStepIndex + 1}
          forceOpen={sidebarOpen}
        >
          <div className="py-2">
            <MockSaveRecipe />
            <ResetButton resetFlow={resetFlow} />
          </div>
        </RecipeCalculatorSideBar>

        {card}

        <div className="flex py-12 gap-4 w-11/12 max-w-[1000px] items-center justify-center">
          <Button
            variant="secondary"
            onClick={back}
            className="w-full"
            disabled={currentStepIndex === 0}
          >
            {t("buttonLabels.back")}
          </Button>

          <Button
            className="w-full"
            variant="secondary"
            onClick={next}
            disabled={currentStepIndex === cards.length - 1}
          >
            {t("buttonLabels.next")}
          </Button>
        </div>
      </div>
    </NutrientProvider>
  );
}

export default RecipeBuilderTutorial;

const Heading = ({
  text,
  toolTipProps
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
