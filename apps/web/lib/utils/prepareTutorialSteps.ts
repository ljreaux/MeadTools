import type { ReactNode } from "react";
import type { Step } from "react-joyride";

interface PrepareTutorialStepsOptions {
  hasNextCard: boolean;
  isMobile: boolean;
  onNextCard: () => void;
  steps: Step[];
  translate: (key: string) => ReactNode;
}

export function prepareTutorialSteps({
  hasNextCard,
  isMobile,
  onNextCard,
  steps,
  translate
}: PrepareTutorialStepsOptions): Step[] {
  return steps.flatMap<Step>((step) => {
    if (step.target === "toNextCard") {
      return hasNextCard
        ? [
            {
              ...step,
              target: "body",
              before: async () => {
                onNextCard();
              }
            } satisfies Step
          ]
        : [];
    }

    return [
      {
        ...step,
        placement:
          isMobile &&
          (step.placement === "left" || step.placement === "right")
            ? "top"
            : (step.placement ?? "bottom"),
        content:
          typeof step.content === "string"
            ? translate(step.content)
            : step.content,
        ...(typeof step.content !== "string" ? { buttons: [] } : {})
      } satisfies Step
    ];
  });
}
