"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { Joyride, type Step } from "react-joyride";

import { useTranslation } from "react-i18next";

interface UseTutorialReturn {
  tutorial: ReactNode;
  sidebarOpen: boolean;
}

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useTutorial(
  steps: Step[],
  tourKey: string | number
): UseTutorialReturn {
  const { t } = useTranslation();
  const sidebarOpen = true;
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot
  );

  const customJoyrideStyles = {
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
    buttonPrimary: {
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

  return {
    tutorial: mounted ? (
      <Joyride
        key={tourKey}
        steps={steps}
        run
        continuous
        options={{
          buttons: ["back", "primary"],
          dismissKeyAction: false,
          overlayClickAction: false,
          primaryColor: "hsl(var(--primary))",
          scrollOffset: 100,
          skipScroll: false,
          textColor: "hsl(var(--foreground))",
          width: 500,
          zIndex: 10000
        }}
        styles={customJoyrideStyles}
        locale={{
          back: t("buttonLabels.back"),
          last: t("buttonLabels.next"),
          next: t("buttonLabels.next")
        }}
      />
    ) : null,
    sidebarOpen
  };
}
