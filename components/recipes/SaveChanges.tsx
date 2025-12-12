"use client";

import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";

import { useRecipe } from "../providers/SavedRecipeProvider";
import { useNutrients } from "../providers/SavedNutrientProvider";
import { useToast } from "@/hooks/use-toast";

import { Save } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

import {
  useUpdateRecipeMutation,
  type UpdateRecipePayload
} from "@/hooks/reactQuery/useRecipeQuery";
import { Spinner } from "../ui/spinner";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

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
  const params = useParams();
  const recipeId = params?.id as string | undefined;

  const { toast } = useToast();
  const updateRecipeMutation = useUpdateRecipeMutation();

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

  const handleSaveClick = () => {
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

    const body: UpdateRecipePayload = {
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
      activityEmailsEnabled: emailNotifications ?? false
    };

    updateRecipeMutation.mutate(
      { id: recipeId, body },
      {
        onSuccess: () => {
          toast({
            description: "Recipe updated successfully."
          });
        },
        onError: (error: any) => {
          console.error("Error updating recipe:", error);
          toast({
            title: "Error",
            description: "There was an error updating your recipe",
            variant: "destructive"
          });
        }
      }
    );
  };

  const isSaving = updateRecipeMutation.isPending;

  const icon = isSaving ? <Spinner /> : <Save />;

  return (
    <div
      className={cn("relative flex flex-col items-center", {
        "w-full": bottom
      })}
    >
      {bottom ? (
        <Button
          variant="secondary"
          className="w-full"
          onClick={handleSaveClick}
          disabled={isSaving}
          aria-label={t("changesForm.submit")}
        >
          {icon}
        </Button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={handleSaveClick}
              disabled={isSaving}
              aria-label={t("changesForm.submit")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground bg-background text-foreground hover:bg-foreground hover:text-background sm:h-12 sm:w-12 disabled:opacity-60"
            >
              {icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="whitespace-nowrap">
            {t("changesForm.submit")}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export default SaveChanges;
