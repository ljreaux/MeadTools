"use client";

import useCards from "@/hooks/useCards";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { CardWrapper } from "../CardWrapper";
import Tooltip from "../Tooltips";
import RecipeCalculatorSideBar from "./Sidebar";
import IngredientsV2 from "./IngredientsV2";
import { ReactNode, useCallback } from "react";
import UnitsV2 from "./UnitsV2";
import IngredientResultsV2 from "./ResultsV2";
import DesiredBatchDetailsV2 from "./DesiredBatchDetailsV2";
import ScaleRecipeFormV2 from "./ScaleRecipeFormV2";
import StabilizersV2 from "./StabilizersV2";
import { useLocalRecipeStorage } from "@/hooks/useLocalRecipeStorage";
import AdditivesV2 from "./AdditivesV2";
import NotesV2 from "./NotesV2";
import ResetButtonV2 from "./ResetButtonV2";
import { useRecipeV2 } from "../providers/RecipeProviderV2";
import { useAccountUnitDefaults } from "@/hooks/useAccountUnitDefaults";
import VolumeInputsV2 from "../nutrientCalc/VolumeInputsV2";
import YeastDetailsV2 from "../nutrientCalc/YeastDetailsV2";
import NutrientSelectorV2 from "../nutrientCalc/NutrientSelectorV2";
import ResultsV2 from "../nutrientCalc/ResultsV2";
import AdditionalDetailsV2 from "../nutrientCalc/AdditionalDetailsV2";
import { NutrientProviderV2 } from "../providers/NutrientProviderV2";
import RecipePdf from "./RecipePDF";

// (Optional) keep your existing Save/Reset UI if you want,
// but if they depend on old providers, comment them out for now.
// import SaveRecipe from "./SaveRecipe";
// import ResetButton from "./ResetButton";

type CardConfig = {
  key: string;
  heading: string;
  components: ReactNode[];
  tooltip?: {
    body: string;
    link: string;
  };
};

const cardConfigV2: CardConfig[] = [
  {
    key: "v2-card-1",
    heading: "recipeBuilder.homeHeading",
    components: [
      <UnitsV2 key="unitsV2" />,
      <DesiredBatchDetailsV2 key="DesiredBatchDetailsV2" />,
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

const DRAFT_KEY = "meadtools:recipe:v2:draft";

export default function RecipeBuilderV2() {
  const { didInit, didHydrate } = useLocalRecipeStorage({ key: DRAFT_KEY });
  useAccountUnitDefaults({ didInit, didHydrate });
  const {
    derived: { nutrientValueForRecipe },
    meta: { setNutrients }
  } = useRecipeV2();

  const { t } = useTranslation();

  const cards = cardConfigV2.map(({ key, heading, components, tooltip }) => (
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
    <NutrientProviderV2
      mode="controlled"
      value={nutrientValueForRecipe}
      onChange={setNutrients}
    >
      <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
        <RecipeCalculatorSideBar goTo={goTo} cardNumber={currentStepIndex + 1}>
          <div className="py-2">
            {/* <SaveRecipe /> */}
            <ResetButtonV2 resetFlow={resetFlow} />
          </div>
        </RecipeCalculatorSideBar>

        {card}

        <div className="flex py-12 gap-4 w-11/12 max-w-[1200px] items-center justify-center">
          {currentStepIndex === 0 || (
            <Button variant="secondary" onClick={back} className="w-full">
              {t("buttonLabels.back")}
            </Button>
          )}

          {currentStepIndex === cards.length - 1 ? null : (
            <Button className="w-full" variant="secondary" onClick={next}>
              {t("buttonLabels.next")}
            </Button>
          )}
        </div>
      </div>
    </NutrientProviderV2>
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
