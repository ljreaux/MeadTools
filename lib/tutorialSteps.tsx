import FinalTutorialComponent from "@/components/recipeBuilder/FinalTutorialComponent";
import { Step } from "react-joyride";
const cardOneSteps: Step[] = [
  {
    target: "body",
    content: "tutorial.cardOne.step1",
    placement: "center",
    disableBeacon: true
  },
  {
    target: ".joyride-sidebar",
    content: "tutorial.cardOne.step2",
    placement: "left"
  },
  {
    target: ".joyride-recipePdf",
    content: "tutorial.cardOne.step3",
    placement: "left"
  },
  {
    target: ".joyride-saveRecipe",
    content: "tutorial.cardOne.step4",
    placement: "left"
  },
  {
    target: ".joyride-deleteRecipe",
    content: "tutorial.cardOne.step5",
    placement: "left"
  },
  {
    target: ".joyride-units",
    content: "tutorial.cardOne.step6",
    placement: "bottom"
  },
  {
    target: ".joyride-initialDetails",
    content: "tutorial.cardOne.step7",
    placement: "bottom"
  },
  {
    target: ".joyride-ingredient-1",
    content: "tutorial.cardOne.step8",
    placement: "bottom"
  },
  {
    target: ".joyride-secondary-4",
    content: "tutorial.cardOne.step9",
    placement: "right"
  },
  {
    target: ".joyride-fillToNext-4",
    content: "tutorial.cardOne.step10",
    placement: "bottom-end"
  },
  {
    target: ".joyride-recipeBuilderResults",
    content: "tutorial.cardOne.step11",
    placement: "top"
  },
  {
    target: ".joyride-scaleRecipe",
    content: "tutorial.cardOne.step12",
    placement: "top"
  },
  {
    target: "toNextCard",
    content: ""
  }
];

const cardTwoSteps: Step[] = [
  {
    target: "body",
    content: "tutorial.cardTwo.step1",
    placement: "center",
    disableBeacon: true
  },
  {
    target: ".joyride-nutrientInputs",
    content: "tutorial.cardTwo.step2"
  },
  {
    target: ".joyride-offset",
    content: "tutorial.cardTwo.step3",
    placement: "left"
  },
  {
    target: ".joyride-yeastDetails",
    content: "tutorial.cardTwo.step4",
    placement: "left"
  },
  {
    target: ".joyride-goFerm",
    content: "tutorial.cardTwo.step5",
    placement: "top"
  },
  {
    target: "toNextCard",
    content: "",
    placement: "center",
    disableBeacon: true
  }
];
const cardThreeSteps: Step[] = [
  {
    target: "body",
    content: "tutorial.cardThree.step1",
    placement: "center",
    disableBeacon: true
  },
  {
    target: ".joyride-nutrientSwitches",
    content: "tutorial.cardThree.step2",
    placement: "top"
  },
  {
    target: ".joyride-nutrientSettings",
    content: "tutorial.cardThree.step3",
    placement: "right"
  },
  {
    target: ".joyride-numOfAdditions",
    content: "tutorial.cardThree.step4",
    placement: "top"
  },
  {
    target: ".joyride-nuteResults",
    content: "tutorial.cardThree.step5",
    placement: "top"
  },
  {
    target: ".joyride-warning",
    content: "tutorial.cardThree.step6",
    placement: "top"
  },
  {
    target: ".joyride-goFerm",
    content: "tutorial.cardThree.step7",
    placement: "bottom"
  },
  {
    target: "toNextCard",
    content: "",
    placement: "top",
    disableBeacon: true
  }
];
const cardFourSteps: Step[] = [
  {
    target: ".joyride-stabilizersCard",
    content: "tutorial.cardFour.step1",
    placement: "bottom",
    disableBeacon: true
  },
  {
    target: "toNextCard",
    content: "",
    placement: "center",
    disableBeacon: true
  }
];
const cardFiveSteps: Step[] = [
  {
    target: "body",
    content: "tutorial.cardFive.step1",
    placement: "center",
    disableBeacon: true
  },
  {
    target: ".joyride-additiveLine",
    content: "tutorial.cardFive.step2",
    placement: "bottom"
  },
  {
    target: "toNextCard",
    content: "",
    placement: "center",
    disableBeacon: true
  }
];
const cardSixSteps: Step[] = [
  {
    target: ".joyride-notesCard",
    content: "tutorial.cardSix.step1",
    placement: "bottom",
    disableBeacon: true
  },
  {
    target: "toNextCard",
    content: "",
    placement: "center",
    disableBeacon: true
  }
];
const cardSevenSteps: Step[] = [
  {
    target: "body",
    content: "tutorial.cardSeven.step1",
    placement: "center",
    disableBeacon: true
  },
  {
    target: ".joyride-downloadPdf",
    content: "tutorial.cardSeven.step2",
    placement: "bottom",
    disableBeacon: true
  },
  {
    target: ".joyride-saveRecipe",
    content: "tutorial.cardSeven.step3"
  },
  {
    target: "body",
    placement: "center",
    disableBeacon: true,
    content: <FinalTutorialComponent />
  },
  {
    target: "toNextCard",
    content: "",
    placement: "center",
    disableBeacon: true
  }
];

export const stepCards = [
  cardOneSteps,
  cardTwoSteps,
  cardThreeSteps,
  cardFourSteps,
  cardFiveSteps,
  cardSixSteps,
  cardSevenSteps
];
