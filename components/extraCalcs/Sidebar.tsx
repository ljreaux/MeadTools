"use client";

import { JSX, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import {
  Beer,
  Percent,
  FlaskConical,
  Thermometer,
  Blend,
  ChevronDown,
  ChevronUp,
  Scale,
  Rainbow,
  Pipette,
  Atom,
  Hexagon
} from "lucide-react";
import { extraCalculatorLinks } from "@/lib/navigation";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

function ExtraCalcsSideBar() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const toggleSidebar = () => setIsOpen((prev) => !prev);

  const icons: JSX.Element[] = [
    <Beer key="beer" />,
    <Percent key="percent" />,
    <Scale key="scale" />,
    <FlaskConical key="flask" />,
    <Atom key="atom" />,
    <Pipette key="pipette" />,
    <Rainbow key="rainbow" />,
    <Thermometer key="thermometer" />,
    <Blend key="blend" />,
    <Hexagon key="hex" />
  ];

  const links = extraCalculatorLinks.map((link, i) => ({
    ...link,
    icon: icons[i],
    label: t(link.label)
  }));

  return (
    <div
      className={`fixed top-28 right-0 transition-transform duration-500 bg-background border border-foreground z-50 px-2 rounded-md ${
        isOpen ? "translate-y-0" : "-translate-y-full"
      }`}
    >
      {/* Toggle Button */}
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
            key={link.path ?? idx}
            link={link.path}
            icon={link.icon}
            label={link.label}
          />
        ))}
      </nav>
    </div>
  );
}

function NavItem({
  link,
  icon,
  label
}: {
  link: string;
  icon: JSX.Element;
  label: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          size="icon"
          variant="outline"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground bg-background text-foreground hover:bg-foreground hover:text-background sm:h-12 sm:w-12"
        >
          <Link href={link}>{icon}</Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left" className="whitespace-nowrap">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export default ExtraCalcsSideBar;
