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
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -top-5 right-0 flex items-center justify-center w-8 h-8 bg-background text-foreground border border-foreground rounded-md z-50"
        aria-label={isOpen ? "Close Sidebar" : "Open Sidebar"}
      >
        {isOpen ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </button>

      {/* Sidebar Content */}
      <nav
        className={`flex flex-col items-center gap-4 py-4 ${
          isOpen ? "" : "hidden"
        }`}
      >
        {links.map((link, idx) => (
          <NavItem
            key={idx}
            icon={link.icon}
            label={link.label}
            isActive={link.pageNumber === cardNumber} // Match active state
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
    <div
      className={`${tutorialClassName} relative group flex flex-col items-center`}
    >
      {/* Icon Link */}
      <button
        onClick={clickFn}
        className={`flex items-center justify-center sm:w-12 sm:h-12 w-8 h-8 rounded-full border border-foreground transition-colors ${
          isActive
            ? "bg-foreground text-background"
            : "bg-background text-foreground hover:text-background hover:bg-foreground"
        }`}
      >
        {icon}
      </button>

      {/* Hover Label */}
      <span className="absolute top-1/2 -translate-y-1/2 right-16 whitespace-nowrap px-2 py-1 bg-background text-foreground border border-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity">
        {label}
      </span>
    </div>
  );
}

export default RecipeCalculatorSideBar;
