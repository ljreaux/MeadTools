"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { parseNumber } from "@/lib/utils/validateInput";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import Rating from "@/components/recipes/Rating";

interface Recipe {
  id: number;
  user_id: number;
  name: string;
  recipeData: string; // JSON string containing OG, FG, etc.
  yanFromSource: string | null;
  yanContribution: string;
  nutrientData: string;
  advanced: boolean;
  nuteInfo: string | null;
  primaryNotes: string[] | null;
  secondaryNotes: string[] | null;
  private: boolean;
  public_username: string | null;
  averageRating?: number;
  numberOfRatings?: number;
}

function parseRecipeData(recipeData: string) {
  try {
    const parsedData = JSON.parse(recipeData);
    return {
      OG: parseNumber(parsedData.OG)?.toFixed(3) || "N/A",
      FG: parseNumber(parsedData.FG)?.toFixed(3) || "N/A"
    };
  } catch (error) {
    console.error("Error parsing recipeData:", error);
    return { OG: "N/A", FG: "N/A" };
  }
}

export default function RecipeList({ recipes }: { recipes: Recipe[] }) {
  const searchParams = useSearchParams();
  const pathName = usePathname();
  const { replace } = useRouter();
  const { t } = useTranslation();
  const itemsPerPage = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const filteredRecipes = recipes.filter((recipe) => {
    const searchTerm = searchParams.get("query") ?? "";
    return (
      recipe.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.public_username?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const totalPages = Math.ceil(filteredRecipes.length / itemsPerPage);

  const currentRecipes = filteredRecipes.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="mb-4 flex items-center w-full max-w-[50%] rounded-md relative">
        <Input
          placeholder={t("searchPlaceholder")}
          defaultValue={searchParams.get("query")?.toString()}
          onChange={(e) => {
            const params = new URLSearchParams(searchParams);
            if (e.target.value) {
              params.set("query", e.target.value);
            } else {
              params.delete("query");
            }
            replace(`${pathName}?${params.toString()}`);
            setCurrentPage(1);
          }}
          className="flex-1 pr-8 focus:ring-0 placeholder-ellipsis placeholder:text-muted-foreground"
        />
        <Search className="text-muted-foreground absolute right-2" />
      </div>
      {/* Recipe List */}
      <ul className="space-y-4">
        {currentRecipes.length > 0 ? (
          currentRecipes.map((recipe) => {
            const { OG, FG } = parseRecipeData(recipe.recipeData);
            return (
              <li key={recipe.id}>
                <Link
                  href={`/recipes/${recipe.id}`}
                  className="group block p-4 rounded-lg bg-card transition-colors border border-border shadow-sm hover:bg-muted-foreground"
                >
                  {/* Header row: title + rating (stack on mobile, split on sm+) */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <h2 className="text-xl font-semibold text-card-foreground">
                      {recipe.name}
                    </h2>

                    {/* Rating: smaller, flush-left on mobile, pinned right on sm+ */}
                    <div className="sm:shrink-0  self-start sm:self-auto -ml-1 sm:ml-0 relative z-10">
                      <Rating
                        averageRating={recipe.averageRating ?? 0}
                        numberOfRatings={recipe.numberOfRatings ?? 0}
                      />
                    </div>
                  </div>

                  {recipe.public_username && (
                    <p className="text-muted-foreground text-sm group-hover:text-foreground">
                      {t("byUser", { public_username: recipe.public_username })}
                    </p>
                  )}

                  <p className="text-muted-foreground text-sm group-hover:text-foreground">
                    {t("OG")}: {OG}, {t("FG")}: {FG}
                  </p>
                </Link>
              </li>
            );
          })
        ) : (
          <li>{t("noRecipesFound") || "No recipes found."}</li>
        )}
      </ul>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center">
        <Button
          onClick={handlePrevious}
          disabled={currentPage === 1}
          variant="secondary"
        >
          {t("buttonLabels.back")}
        </Button>
        <span className="text-sm text-muted-foreground">
          {t("numOfPages", { start_page: currentPage, end_page: totalPages })}
        </span>
        <Button
          onClick={handleNext}
          disabled={currentPage === totalPages}
          variant="secondary"
        >
          {t("buttonLabels.next")}
        </Button>
      </div>
    </div>
  );
}
