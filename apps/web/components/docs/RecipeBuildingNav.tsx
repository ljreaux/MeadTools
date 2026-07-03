 "use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

export const recipeBuildingLinks = [
  {
    href: "/recipe-building/calculating-gravity",
    label: "Calculating Gravity"
  },
  {
    href: "/recipe-building/calculating-abv",
    label: "Calculating ABV and Delle Units"
  },
  {
    href: "/recipe-building/secondary-ingredients",
    label: "Secondary Ingredients and Dilution"
  },
  {
    href: "/recipe-building/calculating-target-yan",
    label: "Calculating Target YAN"
  },
  {
    href: "/recipe-building/nutrient-schedules-and-amounts",
    label: "Nutrient Schedules and Nutrient Amounts"
  },
  {
    href: "/recipe-building/yeast-amount-and-go-ferm",
    label: "Yeast Amount and Go-Ferm"
  },
  {
    href: "/recipe-building/calculating-stabilizers",
    label: "Calculating Stabilizers"
  },
  {
    href: "/recipe-building/additives-and-unit-conversions",
    label: "Additives and Unit Conversions"
  }
];

export function RecipeBuildingNav({
  currentPath
}: {
  currentPath: string;
}) {
  const navContent = (showHeading = true) => (
    <div className="rounded-2xl border border-border/70 bg-background p-3 shadow-sm">
      {showHeading ? (
        <p className="mb-3 px-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Recipe Builder Docs
        </p>
      ) : null}
      <div className="grid gap-1">
        {recipeBuildingLinks.map((link) => {
          const active = link.href === currentPath;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-xl px-3 py-2.5 text-sm leading-snug transition-colors ${
                active
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="not-prose">
      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button
              variant="secondary"
              className="mb-4 w-full justify-between rounded-xl"
            >
              Browse Recipe Builder Docs
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[88vw] max-w-sm top-20 z-[60] p-4"
          >
            <SheetHeader className="mb-4">
              <SheetTitle>Recipe Builder Docs</SheetTitle>
            </SheetHeader>
            {navContent(false)}
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden lg:block">{navContent()}</div>
    </div>
  );
}

export default RecipeBuildingNav;

export function RecipeBuildingPager({
  currentPath
}: {
  currentPath: string;
}) {
  const index = recipeBuildingLinks.findIndex((link) => link.href === currentPath);
  const prev = index > 0 ? recipeBuildingLinks[index - 1] : null;
  const next =
    index >= 0 && index < recipeBuildingLinks.length - 1
      ? recipeBuildingLinks[index + 1]
      : null;

  if (!prev && !next) return null;

  return (
    <div className="not-prose mt-12">
      <Separator className="mb-6" />
      <div className="grid gap-3 sm:grid-cols-2">
        {prev ? (
          <Link
            href={prev.href}
            className="rounded-2xl border border-border/70 bg-background p-4 shadow-sm transition-colors hover:bg-accent/40"
          >
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Previous
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {prev.label}
            </p>
          </Link>
        ) : (
          <div />
        )}

        {next ? (
          <Link
            href={next.href}
            className="rounded-2xl border border-border/70 bg-background p-4 text-left shadow-sm transition-colors hover:bg-accent/40"
          >
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Next
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {next.label}
            </p>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
