"use client";

import { useAuth } from "../providers/AuthProvider";
import { useTranslation } from "react-i18next";

import { useParams } from "next/navigation";
import { useRecipe } from "../providers/SavedRecipeProvider";
import { useNutrients } from "../providers/SavedNutrientProvider";
import { useToast } from "@/hooks/use-toast";

import { Save } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

function SaveChanges({
  privateRecipe,
  bottom,
  emailNotifications
}: {
  privateRecipe: boolean;
  bottom?: boolean;
  emailNotifications?: boolean;
}) {
  const { t } = useTranslation();
  const params = useParams(); // Get URL parameters
  const recipeId = params?.id; // Extract recipeId from URL

  const setLastActivityEmailAt = (privateRecipe: boolean, notify?: boolean) => {
    // If the user is opting OUT → store NULL
    if (privateRecipe || !notify) return null;

    // If opting IN → set to yesterday to allow immediate notification
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    return yesterday;
  };

  const {
    ingredients,
    OG,
    volume,
    ABV,
    FG,
    offset,
    units,
    additives,
    sorbate,
    sulfite,
    campden,
    notes,
    recipeNameProps,
    stabilizers,
    stabilizerType
  } = useRecipe();

  const {
    fullData,
    yanContributions,
    otherNutrientName: otherNameState,
    providedYan,
    maxGpl
  } = useNutrients();

  const { fetchAuthenticatedPatch } = useAuth();

  const { toast } = useToast();

  const updateRecipe = async () => {
    if (!recipeId) {
      toast({
        title: "Error",
        description: "Recipe ID is missing.",
        variant: "destructive"
      });
      return;
    }

    const recipeData = JSON.stringify({
      ingredients,
      OG,
      volume,
      ABV,
      FG,
      offset,
      units,
      additives,
      sorbate,
      sulfite,
      campden,
      stabilizers,
      stabilizerType
    });

    const otherNutrientName =
      otherNameState.value.length > 0 ? otherNameState.value : undefined;

    const nutrientData = JSON.stringify({
      ...fullData,
      otherNutrientName
    });
    const yanContribution = JSON.stringify(yanContributions);

    const primaryNotes = notes.primary.map((note) => note.content).flat();
    const secondaryNotes = notes.secondary.map((note) => note.content).flat();
    const advanced = false;

    const body = {
      name: recipeNameProps.value,
      recipeData,
      yanFromSource: JSON.stringify(providedYan),
      yanContribution,
      nutrientData,
      advanced,
      nuteInfo: JSON.stringify(maxGpl),
      primaryNotes,
      secondaryNotes,
      private: privateRecipe,
      lastActivityEmailAt: setLastActivityEmailAt(
        privateRecipe,
        emailNotifications
      )
    };
    try {
      await fetchAuthenticatedPatch(`/api/recipes/${recipeId}`, body);

      toast({
        description: "Recipe updated successfully."
      });
    } catch (error: any) {
      console.error("Error updating recipe:", error.message);
      toast({
        title: "Error",
        description: "There was an error updating your recipe",
        variant: "destructive"
      });
    }
  };

  return (
    <div
      className={cn("relative group flex flex-col items-center", {
        "w-full": bottom
      })}
    >
      {bottom ? (
        <Button variant={"secondary"} className="w-full" onClick={updateRecipe}>
          <Save />
        </Button>
      ) : (
        <>
          <button
            className="flex items-center justify-center sm:w-12 sm:h-12 w-8 h-8 bg-background text-foreground rounded-full border border-foreground hover:text-background hover:bg-foreground transition-colors"
            onClick={updateRecipe}
          >
            <Save />
          </button>
          <span className="absolute top-1/2 -translate-y-1/2 right-16 whitespace-nowrap px-2 py-1 bg-background text-foreground border border-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {t("changesForm.submit")}
          </span>
        </>
      )}
    </div>
  );
}

export default SaveChanges;
