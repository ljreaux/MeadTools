"use client";
import React, { useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { useRouter } from "next/navigation";
import { useRecipe } from "../providers/RecipeProvider";
import { useNutrients } from "../providers/NutrientProvider";
import { resetRecipe } from "@/lib/utils/resetRecipe";
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

function SaveRecipe() {
  const { t } = useTranslation();
  const router = useRouter();

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
  } = useNutrients();

  const { isLoggedIn, fetchAuthenticatedPost } = useAuth();

  const [checked, setChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state
  const { toast } = useToast();

  const createRecipe = async () => {
    setIsSubmitting(true); // Start loading
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
      yanFromSource: null,
      yanContribution,
      nutrientData,
      advanced,
      nuteInfo: null,
      primaryNotes,
      secondaryNotes,
      private: checked,
    };

    try {
      await fetchAuthenticatedPost("/api/recipes", body);

      resetRecipe();
      toast({
        description: "Recipe created successfully.",
      });
      router.push("/account");
    } catch (error: any) {
      console.error("Error creating recipe:", error.message);
      toast({
        title: "Error",
        description: "There was an error creating your recipe",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false); // End loading
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="joyride-saveRecipe relative group flex flex-col items-center">
          <button className="flex items-center justify-center sm:w-12 sm:h-12 w-8 h-8 bg-background text-foreground rounded-full border border-foreground hover:text-background hover:bg-foreground transition-colors">
            <Save />
          </button>
          <span className="absolute top-1/2 -translate-y-1/2 right-16 whitespace-nowrap px-2 py-1 bg-background text-foreground border border-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {t("recipeForm.submit")}
          </span>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("recipeForm.title")}</DialogTitle>
          {isLoggedIn ? (
            <div className="space-y-4">
              <label>
                {t("recipeForm.subtitle")}
                <Input {...recipeNameProps} />
              </label>
              <label className="grid">
                {t("private")}
                <Switch checked={checked} onCheckedChange={setChecked} />
              </label>
            </div>
          ) : (
            <Link
              href={"/login"}
              className="flex items-center justify-center gap-4 px-8 py-2 my-4 text-lg border border-solid rounded-lg bg-background text-foreground hover:bg-foreground hover:border-background hover:text-background sm:gap-8 group"
            >
              {t("recipeForm.login")}
            </Link>
          )}
        </DialogHeader>
        {isLoggedIn && (
          <DialogFooter>
            <LoadingButton
              onClick={createRecipe}
              loading={isSubmitting}
              variant="secondary"
            >
              {t("SUBMIT")}
            </LoadingButton>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default SaveRecipe;
