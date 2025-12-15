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
  SheetTrigger
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "../ui/separator";

const Nav = () => {
  const { t } = useTranslation();
  const pathname = usePathname();

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

  const getActiveKey = () => {
    // exact match for home
    if (pathname === baseRoute) return "home";
    if (pathname.includes("logs")) return "brews";
    // prefix match for nested pages
    const match = navLinks.find(
      (l) => l.to !== baseRoute && pathname?.startsWith(l.to)
    );

    return match?.key ?? "home";
  };

  const activeKey = getActiveKey();

  return (
    <div className="w-full">
      {/* Mobile: pinned to top-left of the layout container */}
      <div className="sm:hidden absolute left-3 top-3 z-[51]">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t("menu", "Menu")}>
              <Text className="h-5 w-5" />
            </Button>
          </SheetTrigger>

          {/* keep this > navbar z (yours is 51; bump if needed) */}
          <SheetContent side="left" className="w-72 pt-10 z-[51]">
            <div className="grid gap-1">
              {navLinks.map((l) => (
                <SheetClose asChild key={l.key}>
                  <Link
                    href={l.to}
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

      {/* Desktop: tabs (styling + active state from route) */}
      <div className="hidden sm:flex">
        <Tabs value={activeKey}>
          <TabsList>
            {navLinks.map((l) => (
              <TabsTrigger key={l.key} value={l.key} asChild>
                <Link href={l.to}>{t(l.name)}</Link>
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
