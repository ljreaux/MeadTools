"use client";

import useCards from "@/hooks/useCards";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { CardWrapper } from "../CardWrapper";
import Tooltip from "../Tooltips";
import RecipeCalculatorSideBar from "./Sidebar";
import Ingredients from "./Ingredients";
import { ReactNode, useCallback } from "react";
import Units from "./Units";
import IngredientResults from "./Results";
import DesiredBatchDetails from "./DesiredBatchDetails";
import ScaleRecipeForm from "./ScaleRecipeForm";
import Stabilizers from "./Stabilizers";
import { useLocalRecipeStorage } from "@/hooks/useLocalRecipeStorage";
import Additives from "./Additives";
import Notes from "./Notes";
import ResetButton from "./ResetButton";
import { useRecipe } from "../providers/RecipeProvider";
import { useAccountUnitDefaults } from "@/hooks/useAccountUnitDefaults";
import VolumeInputs from "../nutrientCalc/VolumeInputs";
import YeastDetails from "../nutrientCalc/YeastDetails";
import NutrientSelector from "../nutrientCalc/NutrientSelector";
import Results from "../nutrientCalc/Results";
import AdditionalDetails from "../nutrientCalc/AdditionalDetails";
import { NutrientProvider } from "@/components/providers/NutrientProvider";
import RecipePdf from "./RecipePdf";
import SaveRecipe from "./SaveRecipe";

type CardConfig = {
  key: string;
  heading: string;
  components: ReactNode[];
  tooltip?: {
    body: string;
    link: string;
  };
};

const cardConfig: CardConfig[] = [
  {
    key: "-card-1",
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

const DRAFT_KEY = "meadtools:recipe::draft";

export default function RecipeBuilder() {
  const { didInit, didHydrate } = useLocalRecipeStorage({ key: DRAFT_KEY });
  useAccountUnitDefaults({ didInit, didHydrate });
  const {
    derived: { nutrientValueForRecipe },
    meta: { setNutrients }
  } = useRecipe();

  const { t } = useTranslation();

  const cards = cardConfig.map(({ key, heading, components, tooltip }) => (
    <CardWrapper key={key}>
      <Heading text={heading} toolTipProps={tooltip} />
      {components}
    </CardWrapper>
  ));

  const { card, currentStepIndex, back, next, goTo } = useCards(cards);
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
        <RecipeCalculatorSideBar goTo={goTo} cardNumber={currentStepIndex + 1}>
          <div className="py-2">
            <SaveRecipe />
            <ResetButton resetFlow={resetFlow} />
          </div>
        </RecipeCalculatorSideBar>

        {card}

        <div className="flex py-12 gap-4 w-11/12 max-w-[1200px] items-center justify-center">
          {currentStepIndex === 0 || (
            <Button variant={"secondary"} onClick={back} className="w-full">
              {t("buttonLabels.back")}
            </Button>
          )}

          {currentStepIndex === cards.length - 1 ? (
            <SaveRecipe bottom />
          ) : (
            <Button className="w-full" variant={"secondary"} onClick={next}>
              {t("buttonLabels.next")}
            </Button>
          )}
        </div>
      </div>
    </NutrientProvider>
  );
}

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
