"use client";

import { JSX, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  Beer,
  CookingPot,
  SmartphoneCharging,
  Pipette,
  Scale,
  NotebookPen,
  FileText,
} from "lucide-react";
import lodash from "lodash";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function RecipeCalculatorSideBar({
  goTo,
  children,
  cardNumber,
  forceOpen,
  showConnectedBrews = false,
}: {
  goTo: (pageNum: number) => void;
  children: JSX.Element;
  cardNumber: number;
  forceOpen?: boolean;
  showConnectedBrews?: boolean;
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(forceOpen || false);

  const toggleSidebar = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    setIsOpen(forceOpen || false);
  }, [forceOpen]);

  const links = [
    {
      label: t("recipeBuilder.homeHeading"),
      pageNumber: 1,
      icon: <CookingPot />,
    },
    {
      label: t("nutesHeading"),
      pageNumber: 2,
      icon: <SmartphoneCharging />,
    },
    {
      label: t("stabilizersHeading"),
      pageNumber: 4,
      icon: <Pipette />,
    },
    {
      label: t("additivesHeading"),
      pageNumber: 5,
      icon: <Scale />,
    },
    {
      label: t("notes.title"),
      pageNumber: 6,
      icon: <NotebookPen />,
    },
    {
      label: t("PDF.title"),
      pageNumber: 7,
      icon: <FileText />,
    },
    ...(showConnectedBrews
      ? [
          {
            label: t("recipes.connectedBrews.title"),
            pageNumber: 8,
            icon: <Beer />,
          },
        ]
      : []),
  ];

  return (
    <div className="joyride-sidebar fixed top-28 right-0 z-50 w-14 sm:w-[4.5rem]">
      {/* Toggle Button (match ExtraCalcsSideBar) */}
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={toggleSidebar}
        className="absolute -top-5 right-0 z-50 flex h-8 w-8 items-center justify-center rounded-md bg-background text-foreground"
        aria-label={isOpen ? "Close Sidebar" : "Open Sidebar"}
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <ChevronUp className="h-5 w-5" />
        ) : (
          <ChevronDown className="h-5 w-5" />
        )}
      </Button>

      {/* The toggle stays in a fixed-width shell when the content is hidden. */}
      <div
        data-slot="calc-sidebar"
        hidden={!isOpen}
        className="rounded-md border border-foreground bg-background px-2"
      >
        <nav className="flex max-h-[calc(100dvh-7rem)] flex-col items-center gap-4 overflow-y-auto py-4">
          {links.map((link, idx) => (
            <NavItem
              key={`${link.pageNumber}-${idx}`}
              icon={link.icon}
              label={link.label}
              isActive={link.pageNumber === cardNumber}
              clickFn={() => goTo(link.pageNumber - 1)}
              tutorialClassName={`joyride-${lodash.camelCase(link.label)}`}
            />
          ))}
          {children}
        </nav>
      </div>
    </div>
  );
}

function NavItem({
  clickFn,
  icon,
  label,
  isActive,
  tutorialClassName,
}: {
  clickFn: () => void;
  icon: JSX.Element;
  label: string;
  isActive: boolean;
  tutorialClassName?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={clickFn}
          aria-label={label}
          data-active={isActive}
          className={`${tutorialClassName} flex h-8 w-8 items-center justify-center rounded-full border border-foreground bg-background text-foreground hover:bg-foreground hover:text-background sm:h-12 sm:w-12 ${
            isActive ? "bg-foreground text-background" : ""
          }`}
        >
          {icon}
        </Button>
      </TooltipTrigger>

      <TooltipContent side="left" className="whitespace-nowrap">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export default RecipeCalculatorSideBar;
