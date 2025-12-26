"use client";

import { useState, useEffect } from "react";
import Joyride, { CallBackProps, Step } from "react-joyride";

import { useTranslation } from "react-i18next";

type SpecialStepCallbacks = {
  [stepIndex: number]: () => void;
};

interface UseTutorialReturn {
  TutorialComponent: React.FC;
  sidebarOpen: boolean;
}

export function useTutorial(
  steps: Step[],
  specialCallbacks?: SpecialStepCallbacks
): UseTutorialReturn {
  const { t } = useTranslation();
  const sidebarOpen = true;

  const handleJoyrideCallback = (data: CallBackProps): void => {
    const { index } = data;

    if (
      typeof index === "number" &&
      specialCallbacks &&
      specialCallbacks[index]
    ) {
      specialCallbacks[index]();
    }
  };

  const customJoyrideStyles = {
    options: {
      zIndex: 10000,
      primaryColor: "hsl(var(--primary))",
      textColor: "hsl(var(--foreground))",
      width: 500
    },
    tooltip: {
      backgroundColor: "hsl(var(--card))",
      border: "none",
      boxShadow: "none",
      maxWidth: "70vw"
    },
    tooltipContainer: {
      backgroundColor: "transparent",
      borderRadius: "var(--radius)",
      padding: "1rem",
      border: "none",
      boxShadow: "none"
    },
    tooltipContent: {
      backgroundColor: "transparent",
      padding: 0,
      border: "none",
      boxShadow: "none"
    },
    buttonNext: {
      backgroundColor: "hsl(var(--background))",
      color: "hsl(var(--foreground))",
      border: "1px solid hsl(var(--border))",
      padding: "0.5rem 1rem",
      borderRadius: "var(--radius)",
      fontWeight: 500,
      cursor: "pointer"
    },
    buttonBack: {
      backgroundColor: "hsl(var(--background))",
      color: "hsl(var(--foreground))",
      border: "1px solid hsl(var(--border))",
      padding: "0.5rem 1rem",
      borderRadius: "var(--radius)",
      fontWeight: 500,
      cursor: "pointer"
    },
    buttonSkip: {
      backgroundColor: "hsl(var(--background))",
      color: "hsl(var(--foreground))",
      border: "1px solid hsl(var(--border))",
      padding: "0.5rem 1rem",
      borderRadius: "var(--radius)",
      fontWeight: 500,
      cursor: "pointer"
    }
  };

  const TutorialComponent: React.FC = () => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
      setMounted(true);
    }, []);
    if (!mounted) return null;
    return (
      <Joyride
        steps={steps}
        run={true}
        continuous
        scrollOffset={100}
        callback={handleJoyrideCallback}
        styles={customJoyrideStyles}
        disableCloseOnEsc
        disableOverlayClose
        locale={{
          back: t("buttonLabels.back"),
          next: t("buttonLabels.next")
        }}
        hideCloseButton
        disableScrolling={false}
      />
    );
  };

  return {
    TutorialComponent,
    sidebarOpen
  };
}
