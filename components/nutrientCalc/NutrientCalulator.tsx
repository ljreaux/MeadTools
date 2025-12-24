"use client";

import useCards from "@/hooks/useCards";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import { CardWrapper } from "../CardWrapper";
import NuteCalcSkeleton from "./NuteCalcSkeleton";
import VolumeInputs from "./VolumeInputs";
import YeastDetails from "./YeastDetails";
import NutrientSelector from "./NutrientSelector";
import Results from "./Results";
import AdditionalDetails from "./AdditionalDetails";
import { useNutrients } from "@/components/providers/NutrientProvider";

const cardConfig = [
  {
    key: "card 1",
    heading: "nutesHeading",
    components: [
      <VolumeInputs key="volumeInputs" mode="standalone" />,
      <YeastDetails key="yeastDetails" />
    ]
  },
  {
    key: "card 2",
    heading: "nuteResults.label",
    components: [
      <NutrientSelector key="nutrientSelector" />,
      <Results key="results" />,
      <AdditionalDetails key="additionalDetails" />
    ]
  }
];

function NutrientCalculator() {
  const {
    catalog: { loadingYeasts }
  } = useNutrients();
  const cards = cardConfig.map(({ key, heading, components }) => (
    <CardWrapper key={key}>
      <Heading text={heading} />
      {components}
    </CardWrapper>
  ));

  const { card, currentStepIndex, back, next } = useCards(cards);
  const { t } = useTranslation();

  if (loadingYeasts) {
    return <NuteCalcSkeleton />;
  }

  return (
    <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
      {card}
      <div className="flex py-12 gap-4 w-11/12 max-w-[1200px] items-center justify-center">
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

export default NutrientCalculator;

const Heading = ({ text }: { text: string }) => {
  const { t } = useTranslation();
  return <h1 className="text-3xl text-center">{t(text)}</h1>;
};
