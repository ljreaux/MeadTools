"use client";

import useCards from "@/hooks/useCards";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { CardWrapper } from "../CardWrapper";
import Tooltip from "../Tooltips";
import RecipeCalculatorSideBar from "./Sidebar";
import { useEffect, useState } from "react";
import IngredientsV2 from "./IngredientsV2";
import { useRecipeV2 } from "@/components/providers/RecipeProviderV2";
import { ReactNode } from "react";
import UnitsV2 from "./UnitsV2";
import IngredientResultsV2 from "./ResultsV2";
import DesiredBatchDetailsV2 from "./DesiredBatchDetailsV2";
import ScaleRecipeFormV2 from "./ScaleRecipeFormV2";
import StabilizersV2 from "./StabilizersV2";

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
    key: "card 4",
    heading: "stabilizersHeading",
    tooltip: {
      body: "tipText.stabilizers",
      link: "https://wiki.meadtools.com/en/process/stabilization"
    },
    components: [<StabilizersV2 key="stabilizers" />]
  }
];

const DRAFT_KEY = "meadtools:recipe:v2:draft";

export default function RecipeBuilderV2() {
  const {
    data: { unitDefaults, ingredients, fg, stabilizers },
    meta: { hydrate }
  } = useRecipeV2();

  const [didInit, setDidInit] = useState(false);

  // read once -> hydrate -> mark init done
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);

      const parsed = JSON.parse(raw ?? "");

      if (
        parsed?.unitDefaults &&
        parsed?.ingredients &&
        typeof parsed?.fg === "string" &&
        parsed?.stabilizers &&
        typeof parsed.stabilizers.adding === "boolean" &&
        typeof parsed.stabilizers.takingPh === "boolean" &&
        typeof parsed.stabilizers.phReading === "string" &&
        (parsed.stabilizers.type === "kmeta" ||
          parsed.stabilizers.type === "nameta")
      ) {
        hydrate(parsed);
      }
    } finally {
      setDidInit(true);
    }
  }, [hydrate]);

  // write on changes, but ONLY after init so we don’t clobber the draft
  useEffect(() => {
    if (!didInit) return;

    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ unitDefaults, ingredients, fg, stabilizers })
      );
    } catch {
      // ignore
    }
  }, [didInit, unitDefaults, ingredients, fg, stabilizers]);

  const { t } = useTranslation();

  const cards = cardConfigV2.map(({ key, heading, components, tooltip }) => (
    <CardWrapper key={key}>
      <Heading text={heading} toolTipProps={tooltip} />
      {components}
    </CardWrapper>
  ));

  const { card, currentStepIndex, back, next, goTo } = useCards(cards);

  return (
    <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
      <RecipeCalculatorSideBar goTo={goTo} cardNumber={currentStepIndex + 1}>
        <div className="py-2">
          {/* <SaveRecipe /> */}
          {/* <ResetButton /> */}
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
