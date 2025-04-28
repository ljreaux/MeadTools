"use client";

import React, { useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useTranslation } from "react-i18next";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { useRouter, useParams } from "next/navigation";
import { useRecipe } from "../providers/SavedRecipeProvider";
import { useNutrients } from "../providers/SavedNutrientProvider";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Save } from "lucide-react";
import { LoadingButton } from "../ui/LoadingButton";

function SaveChanges() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams(); // Get URL parameters
  const recipeId = params?.id; // Extract recipeId from URL

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
    stabilizerType,
  } = useRecipe();

  const {
    fullData,
    yanContributions,
    otherNutrientName: otherNameState,
    providedYan,
    maxGpl,
  } = useNutrients();

  const { fetchAuthenticatedPatch } = useAuth();

  const [checked, setChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const updateRecipe = async () => {
    if (!recipeId) {
      toast({
        title: "Error",
        description: "Recipe ID is missing.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
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
      stabilizerType,
    });

    const otherNutrientName =
      otherNameState.value.length > 0 ? otherNameState.value : undefined;

    const nutrientData = JSON.stringify({
      ...fullData,
      otherNutrientName,
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
      private: checked,
    };
    try {
      await fetchAuthenticatedPatch(`/api/recipes/${recipeId}`, body);

      toast({
        description: "Recipe updated successfully.",
      });
      router.push("/account");
    } catch (error: any) {
      console.error("Error updating recipe:", error.message);
      toast({
        title: "Error",
        description: "There was an error updating your recipe",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="relative group flex flex-col items-center">
          <button className="flex items-center justify-center sm:w-12 sm:h-12 w-8 h-8 bg-background text-foreground rounded-full border border-foreground hover:text-background hover:bg-foreground transition-colors">
            <Save />
          </button>
          <span className="absolute top-1/2 -translate-y-1/2 right-16 whitespace-nowrap px-2 py-1 bg-background text-foreground border border-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {t("changesForm.submit")}
          </span>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("changesForm.submit")}</DialogTitle>

          <div className="space-y-4">
            <label>
              {t("changesForm.subtitle")}
              <Input {...recipeNameProps} />
            </label>
            <label className="grid">
              {t("private")}
              <Switch checked={checked} onCheckedChange={setChecked} />
            </label>
          </div>
        </DialogHeader>

        <DialogFooter>
          <LoadingButton
            onClick={updateRecipe}
            loading={isSubmitting}
            variant="secondary"
          >
            {t("SUBMIT")}
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SaveChanges;
