"use client";

import Link from "next/link";
import Image from "next/image";
import { Text } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";

import { ModeToggle } from "../ui/mode-toggle";
import LanguageSwitcher from "../ui/language-switcher";
import AccountLinks from "./AccountLinks";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList
} from "../ui/navigation-menu";

import { HoverHamburgerMenuTrigger } from "../ui/HamburgerMenuTrigger";
import { ListItem } from "./ListItem";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";

import { extraCalculatorLinks, extraLinks, mainCalcs } from "@/lib/navigation";
import { Separator } from "../ui/separator";
import { cn } from "@/lib/utils";
import { useState } from "react";

export default function Navbar() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const [desktopOpen, setDesktopOpen] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <nav className="sm:h-20 h-20 fixed top-0 z-[51] flex items-center justify-between border-b-2 border-background bg-background">
      <div className="relative w-screen h-full gap-2 text-xl text-center justify-between flex text-foreground">
        {/* LEFT: Mobile Sheet + Desktop NavigationMenu */}
        <div className="flex items-center">
          {/* Mobile: Sheet */}
          <div className="sm:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="ml-1">
                  <Text className="h-5 w-5" />
                  <span className="sr-only">{t("openMenu", "Open menu")}</span>
                </Button>
              </SheetTrigger>

              <SheetContent
                side="left"
                className="w-[85vw] max-w-sm p-0 top-20 z-[60]"
              >
                <div className="p-4">
                  <SheetHeader className="text-left">
                    <SheetTitle>{t("menu", "Menu")}</SheetTitle>
                  </SheetHeader>

                  <div className="mt-4 space-y-6 max-h-[80vh] overflow-y-auto pr-2">
                    <MobileSection
                      title={t("calculators.main")}
                      links={mainCalcs}
                      isActive={isActive}
                    />
                    <MobileSection
                      title={t("calculators.extraCalcs.label")}
                      links={extraCalculatorLinks}
                      isActive={isActive}
                    />
                    <MobileSection
                      title={t("additionalLinks.label")}
                      links={extraLinks}
                      isActive={isActive}
                    />
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop: NavigationMenu (click-only) */}
          <div className="hidden sm:block">
            <NavigationMenu
              value={desktopOpen ? "hamburger" : ""}
              onValueChange={(v) => setDesktopOpen(v === "hamburger")}
            >
              <NavigationMenuList>
                <NavigationMenuItem value="hamburger">
                  <HoverHamburgerMenuTrigger
                    className="p-2 sm:px-4"
                    onPointerMove={(e) => e.preventDefault()}
                    onPointerLeave={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDesktopOpen((p) => !p);
                    }}
                    // optional: keyboard convenience
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDesktopOpen((p) => !p);
                      }
                    }}
                  />

                  <NavigationMenuContent
                    className="sm:p-4 p-2 sm:min-w-[600px] min-w-[300px] sm:flex sm:justify-between flex flex-col max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-muted-foreground bg-background"
                    // prevents hover from opening it
                    onPointerEnter={(e) => e.preventDefault()}
                    onPointerMove={(e) => e.preventDefault()}
                  >
                    <div className="hidden sm:flex sm:gap-6">
                      {/* Left column */}
                      <div className="pr-4">
                        <div className="pb-3">
                          <p className="font-bold text-left mb-2">
                            {t("calculators.main")}
                          </p>
                          <ul className="grid grid-cols-2 gap-3 text-start">
                            {mainCalcs.map((link) => (
                              <ListItem
                                key={link.path}
                                title={t(link.label)}
                                href={link.path}
                                className={cn(
                                  isActive(link.path) &&
                                    "bg-accent text-accent-foreground"
                                )}
                                aria-current={
                                  isActive(link.path) ? "page" : undefined
                                }
                              />
                            ))}
                          </ul>
                        </div>

                        <Separator className="my-3" />

                        <div className="mt-3 max-h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-muted-foreground">
                          <p className="font-bold text-left mb-2">
                            {t("additionalLinks.label")}
                          </p>
                          <ul className="grid grid-cols-2 gap-3 text-start">
                            {extraLinks.map((link) => (
                              <ListItem
                                key={link.path}
                                title={t(link.label)}
                                href={link.path}
                                className={cn(
                                  isActive(link.path) &&
                                    "bg-accent text-accent-foreground"
                                )}
                                aria-current={
                                  isActive(link.path) ? "page" : undefined
                                }
                              />
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Vertical separator between columns */}
                      <Separator
                        orientation="vertical"
                        className="h-auto self-stretch"
                      />

                      {/* Right column */}
                      <div className="pl-4">
                        <p className="font-bold text-left mb-2">
                          {t("calculators.extraCalcs.label")}
                        </p>
                        <ul className="grid grid-cols-2 gap-3 text-start">
                          {extraCalculatorLinks.map((link) => (
                            <ListItem
                              key={link.path}
                              title={t(link.label)}
                              href={link.path}
                              className={cn(
                                isActive(link.path) &&
                                  "bg-accent text-accent-foreground"
                              )}
                              aria-current={
                                isActive(link.path) ? "page" : undefined
                              }
                            />
                          ))}
                        </ul>
                      </div>
                    </div>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>

        {/* RIGHT: Utilities + Logo */}
        <div className="flex items-center justify-center h-full">
          <div className="flex gap-4 ml-4 mr-4 items-center justify-center">
            <div className="flex gap-4 items-center">
              <LanguageSwitcher />
              <ModeToggle />
              <AccountLinks />
            </div>
          </div>

          <Link
            className="bg-background w-[3rem] sm:flex sm:w-24 md:w-52 h-full left-0 border-[1px] border-sidebar hover:opacity-80 transition-all"
            href="/"
          >
            <span className="flex flex-col items-center justify-center w-full h-full bg-secondary">
              <Image
                src={"/assets/full-logo.png"}
                alt="MeadTools logo"
                className="hidden md:flex"
                width="300"
                height="50"
              />
              <Image
                src={"/assets/logoOnly.png"}
                alt="MeadTools logo"
                className="md:hidden"
                width="50"
                height="50"
              />
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}

function MobileSection({
  title,
  links,
  isActive
}: {
  title: string;
  links: { path: string; label: string }[];
  isActive: (href: string) => boolean;
}) {
  const { t } = useTranslation();
  return (
    <div>
      <p className="text-sm font-semibold mb-2">{title}</p>

      <div className="flex flex-col gap-1">
        {links.map((l) => (
          <SheetClose asChild key={l.path}>
            <Link
              href={l.path}
              aria-current={isActive(l.path) ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-2 text-sm transition-colors",
                isActive(l.path)
                  ? "bg-accent text-accent-foreground font-medium"
                  : "hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {t(l.label)}
            </Link>
          </SheetClose>
        ))}
      </div>
    </div>
  );
}
