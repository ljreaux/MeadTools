"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { Text } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "../ui/separator";

function stripLocalePrefix(pathname: string, supported: string[]) {
  // supports /de/... /en/... etc
  const seg = pathname.split("/")[1];
  if (seg && supported.includes(seg)) {
    return pathname.replace(`/${seg}`, "") || "/";
  }
  return pathname;
}

function getLocalePrefix(locale: string, defaultLocale = "en") {
  return locale && locale !== defaultLocale ? `/${locale}` : "";
}

const Nav = () => {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();

  const supportedLngsRaw = i18n.options?.supportedLngs;

  const supportedLngs: string[] = Array.isArray(supportedLngsRaw)
    ? supportedLngsRaw.filter((l) => l && l !== "cimode")
    : [];

  const locale = i18n.resolvedLanguage || "en";
  const localePrefix = getLocalePrefix(locale, "en");

  // routes WITHOUT locale prefix (for matching)
  const baseRoute = "/account/hydrometer";

  const navLinks = [
    { key: "home", name: "iSpindelDashboard.nav.home", to: baseRoute },
    {
      key: "device",
      name: "iSpindelDashboard.nav.device",
      to: `${baseRoute}/devices`
    },
    {
      key: "brews",
      name: "iSpindelDashboard.nav.brews",
      to: `${baseRoute}/brews`
    },
    {
      key: "setup",
      name: "iSpindelDashboard.nav.setup",
      to: `${baseRoute}/setup`
    }
  ] as const;

  const pathnameNoLocale = stripLocalePrefix(pathname ?? "/", supportedLngs);

  const getActiveKey = () => {
    if (pathnameNoLocale === baseRoute) return "home";
    if (pathnameNoLocale.includes("logs")) return "brews";

    const match = navLinks.find(
      (l) => l.to !== baseRoute && pathnameNoLocale.startsWith(l.to)
    );

    return match?.key ?? "home";
  };

  const activeKey = getActiveKey();

  // build hrefs WITH locale prefix
  const hrefFor = (to: string) => `${localePrefix}${to}`;

  return (
    <div className="w-full">
      {/* Mobile */}
      <div className="sm:hidden absolute left-3 top-3 z-[51]">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("menu", "Menu")}>
              <Text className="h-5 w-5" />
            </Button>
          </SheetTrigger>

          <SheetContent side="left" className="w-72 pt-10 z-[51]">
            <SheetHeader>
              <SheetTitle>
                {t("iSpindelDashboard.nav.menu", "Wireless Hydrometer Menu")}
              </SheetTitle>
            </SheetHeader>

            <div className="grid gap-1">
              {navLinks.map((l) => (
                <SheetClose asChild key={l.key}>
                  <Link
                    href={hrefFor(l.to)}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm",
                      "hover:bg-accent hover:text-accent-foreground",
                      activeKey === l.key && "bg-accent text-accent-foreground"
                    )}
                  >
                    {t(l.name)}
                  </Link>
                </SheetClose>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex">
        <Tabs value={activeKey}>
          <TabsList>
            {navLinks.map((l) => (
              <TabsTrigger key={l.key} value={l.key} asChild>
                <Link href={hrefFor(l.to)}>{t(l.name)}</Link>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <Separator className="sm:block hidden w-full my-4" />
    </div>
  );
};

export default Nav;
