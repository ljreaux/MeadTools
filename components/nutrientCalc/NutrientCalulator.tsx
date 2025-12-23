"use client";

import useCards from "@/hooks/useCards";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import { CardWrapper } from "../CardWrapper";
import NuteCalcSkeleton from "./NuteCalcSkeleton";
import VolumeInputsV2 from "./VolumeInputsV2";
import YeastDetailsV2 from "./YeastDetailsV2";
import NutrientSelectorV2 from "./NutrientSelectorV2";
import ResultsV2 from "./ResultsV2";
import AdditionalDetailsV2 from "./AdditionalDetailsV2";
import { useNutrientsV2 } from "@/components/providers/NutrientProviderV2";

const cardConfig = [
  {
    key: "card 1",
    heading: "nutesHeading",
    components: [
      <VolumeInputsV2 key="volumeInputs" mode="standalone" />,
      <YeastDetailsV2 key="yeastDetails" />
    ]
  },
  {
    key: "card 2",
    heading: "nuteResults.label",
    components: [
      <NutrientSelectorV2 key="nutrientSelector" />,
      <ResultsV2 key="results" />,
      <AdditionalDetailsV2 key="additionalDetails" />
    ]
  }
];

function NutrientCalculator() {
  const {
    catalog: { loadingYeasts }
  } = useNutrientsV2();
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
