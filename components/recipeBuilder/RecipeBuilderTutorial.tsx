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

// ✅ V2 recipe builder components
import UnitsV2 from "./UnitsV2";
import DesiredBatchDetailsV2 from "./DesiredBatchDetailsV2";
import IngredientsV2 from "./IngredientsV2";
import IngredientResultsV2 from "./ResultsV2";
import ScaleRecipeFormV2 from "./ScaleRecipeFormV2";
import StabilizersV2 from "./StabilizersV2";
import AdditivesV2 from "./AdditivesV2";
import NotesV2 from "./NotesV2";
import RecipePdf from "./RecipePdf";

// ✅ V2 nutrient components
import VolumeInputsV2 from "../nutrientCalc/VolumeInputsV2";
import YeastDetailsV2 from "../nutrientCalc/YeastDetailsV2";
import NutrientSelectorV2 from "../nutrientCalc/NutrientSelectorV2";
import ResultsV2 from "../nutrientCalc/ResultsV2";
import AdditionalDetailsV2 from "../nutrientCalc/AdditionalDetailsV2";

// ✅ V2 providers
import { useRecipeV2 } from "../providers/RecipeProviderV2";
import { NutrientProviderV2 } from "../providers/NutrientProviderV2";

// ✅ V2 reset + mock save
import ResetButtonV2 from "./ResetButtonV2";
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

const cardConfigV2: CardConfig[] = [
  {
    key: "card-1",
    heading: "recipeBuilder.homeHeading",
    components: [
      <UnitsV2 key="unitsV2" />,
      <DesiredBatchDetailsV2 key="DesiredBatchDetailsV2" />,
      <IngredientsV2 key="ingredientsV2" />,
      <IngredientResultsV2 key="ingredientResultsV2" />,
      <ScaleRecipeFormV2 key="scaleIngredientsFormV2" />
    ]
  },
  {
    key: "card-2",
    heading: "nutesHeading",
    components: [
      // match embedded behavior (same as RecipeBuilderV2)
      <VolumeInputsV2 key="volumeInputsV2" mode="embedded" />,
      <YeastDetailsV2 key="yeastDetailsV2" />
    ]
  },
  {
    key: "card-3",
    heading: "nuteResults.label",
    components: [
      <NutrientSelectorV2 key="nutrientSelectorV2" />,
      <ResultsV2 key="resultsV2" />,
      <AdditionalDetailsV2 key="additionalDetailsV2" />
    ]
  },
  {
    key: "card-4",
    heading: "stabilizersHeading",
    tooltip: {
      body: "tipText.stabilizers",
      link: "https://wiki.meadtools.com/en/process/stabilization"
    },
    components: [<StabilizersV2 key="stabilizersV2" />]
  },
  {
    key: "card-5",
    heading: "additivesHeading",
    components: [<AdditivesV2 key="additivesV2" />]
  },
  {
    key: "card-6",
    heading: "notes.title",
    components: [<NotesV2 key="notesV2" />]
  },
  {
    key: "card-7",
    heading: "PDF.title",
    components: [<RecipePdf key="pdfV2" />]
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

  const cards = cardConfigV2.map(({ key, heading, components, tooltip }) => (
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

  // ✅ hook recipe v2 -> feed nutrients provider in controlled mode (same as RecipeBuilderV2)
  const {
    derived: { nutrientValueForRecipe },
    meta: { setNutrients }
  } = useRecipeV2();

  const resetFlow = useCallback(() => {
    goTo(0);
  }, [goTo]);

  return (
    <NutrientProviderV2
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
            <ResetButtonV2 resetFlow={resetFlow} />
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
    </NutrientProviderV2>
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
