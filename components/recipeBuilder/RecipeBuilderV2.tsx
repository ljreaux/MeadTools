"use client";

import useCards from "@/hooks/useCards";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { CardWrapper } from "../CardWrapper";
import Tooltip from "../Tooltips";
import RecipeCalculatorSideBar from "./Sidebar";

// V2
import IngredientsV2 from "./IngredientsV2";
import { useRecipeV2 } from "@/components/providers/RecipeProviderV2";
import { ReactNode } from "react";

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
    heading: "recipeBuilder.labels.ingredients",
    components: [<IngredientsV2 key="ingredientsV2" />]
  }
];

export default function RecipeBuilderV2() {
  // this forces RecipeProviderV2 to be mounted above this component
  // (useRecipeV2 will throw if it isn't)
  useRecipeV2();

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
