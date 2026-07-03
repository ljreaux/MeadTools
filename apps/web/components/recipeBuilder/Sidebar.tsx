"use client";

import { JSX, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  CookingPot,
  SmartphoneCharging,
  Pipette,
  Scale,
  NotebookPen,
  FileText
} from "lucide-react";
import lodash from "lodash";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

function RecipeCalculatorSideBar({
  goTo,
  children,
  cardNumber,
  forceOpen
}: {
  goTo: (pageNum: number) => void;
  children: JSX.Element;
  cardNumber: number;
  forceOpen?: boolean;
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
      icon: <CookingPot />
    },
    {
      label: t("nutesHeading"),
      pageNumber: 2,
      icon: <SmartphoneCharging />
    },
    {
      label: t("stabilizersHeading"),
      pageNumber: 4,
      icon: <Pipette />
    },
    {
      label: t("additivesHeading"),
      pageNumber: 5,
      icon: <Scale />
    },
    {
      label: t("notes.title"),
      pageNumber: 6,
      icon: <NotebookPen />
    },
    {
      label: t("PDF.title"),
      pageNumber: 7,
      icon: <FileText />
    }
  ];

  return (
    <div
      className={`joyride-sidebar fixed top-28 right-0 transition-transform duration-500 bg-background border border-foreground z-50 px-2 rounded-md ${
        isOpen ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      {/* Toggle Button (match ExtraCalcsSideBar) */}
      <Button
        type="button"
        size="icon"
        variant="secondary"
        onClick={toggleSidebar}
        className="absolute -top-5 right-0 z-50 flex h-8 w-8 items-center justify-center rounded-md bg-background text-foreground"
        aria-label={isOpen ? "Close Sidebar" : "Open Sidebar"}
      >
        {isOpen ? (
          <ChevronUp className="h-5 w-5" />
        ) : (
          <ChevronDown className="h-5 w-5" />
        )}
      </Button>

      {/* Sidebar Content */}
      <nav
        className={`flex flex-col items-center gap-4 py-4 ${
          isOpen ? "" : "hidden"
        }`}
      >
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
  );
}

function NavItem({
  clickFn,
  icon,
  label,
  isActive,
  tutorialClassName
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
