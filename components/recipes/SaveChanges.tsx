"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "next/navigation";

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

import { useRecipeV2 } from "@/components/providers/RecipeProviderV2";
import type { RecipeDataV2 } from "@/types/recipeDataV2";

function SaveChanges({
  privateRecipe,
  bottom,
  emailNotifications,
  name
}: {
  privateRecipe: boolean;
  bottom?: boolean;
  emailNotifications?: boolean;
  name: string;
}) {
  const { t } = useTranslation();
  const params = useParams();
  const recipeId = params?.id as string | undefined;

  const { toast } = useToast();
  const updateRecipeMutation = useUpdateRecipeMutation();

  const {
    data: {
      unitDefaults,
      ingredients,
      fg,
      stabilizers,
      additives,
      notes,
      nutrients
    }
  } = useRecipeV2();

  // Build payload exactly like localStorage format
  const dataV2: RecipeDataV2 = useMemo(
    () => ({
      version: 2,
      unitDefaults,
      ingredients,
      fg,
      additives,
      stabilizers,
      notes,
      nutrients,
      flags: {
        private: privateRecipe
      }
    }),
    [
      unitDefaults,
      ingredients,
      fg,
      additives,
      stabilizers,
      notes,
      nutrients,
      privateRecipe
    ]
  );

  const handleSaveClick = () => {
    if (!recipeId) {
      toast({
        title: "Error",
        description: "Recipe ID is missing.",
        variant: "destructive"
      });
      return;
    }

    const body: UpdateRecipePayload = {
      name,
      private: privateRecipe,
      activityEmailsEnabled: emailNotifications ?? false,
      dataV2
    };

    updateRecipeMutation.mutate(
      { id: recipeId, body },
      {
        onSuccess: () => {
          toast({ description: "Recipe updated successfully." });
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
