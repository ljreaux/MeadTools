"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleSlash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CardWrapper } from "@/components/CardWrapper";
import { Button } from "@/components/ui/button";

export default function PublicBrewNotFound() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const segments = pathname.split("/").filter(Boolean);
  const recipesIndex = segments.lastIndexOf("recipes");
  const recipeId = segments[recipesIndex + 1];
  const recipeHref = /^\d+$/.test(recipeId ?? "")
    ? `/recipes/${recipeId}`
    : null;

  return (
    <main className="flex w-full justify-center py-[6rem]">
      <CardWrapper>
        <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
          <CircleSlash2 className="size-10 text-muted-foreground" />
          <div className="max-w-lg space-y-2">
            <h1 className="text-2xl font-semibold sm:text-3xl">
              {t("publicBrews.unavailableTitle", "Brew unavailable")}
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              {t(
                "publicBrews.unavailableDescription",
                "This brew is private, was removed, or the link is no longer valid."
              )}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {recipeHref ? (
              <Button asChild>
                <Link href={recipeHref}>
                  {t("publicBrews.backToRecipe", "Back to recipe")}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant={recipeHref ? "secondary" : "default"}>
              <Link href="/public-recipes">
                {t("publicRecipes.title", "Public Recipes")}
              </Link>
            </Button>
          </div>
        </div>
      </CardWrapper>
    </main>
  );
}
