"use client";
import React, { useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { useRouter } from "next/navigation";
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
import { Button } from "../ui/button";

function SaveRecipeCopy() {
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
  } = useRecipe();

  const { fullData, yanContributions } = useNutrients();

  const { isLoggedIn, fetchAuthenticatedPost } = useAuth();

  const [checked, setChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Loading state
  const { toast } = useToast();
  const [recipeName, setRecipeName] = useState(recipeNameProps.value);

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
    });
    const nutrientData = JSON.stringify(fullData);
    const yanContribution = JSON.stringify(yanContributions);

    const primaryNotes = notes.primary.map((note) => note.content).flat();
    const secondaryNotes = notes.secondary.map((note) => note.content).flat();
    const advanced = false;
    const body = {
      name: recipeName,
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
        <Button variant={"secondary"} className="ml-auto max-w-max">
          <Save />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("saveCopy")}</DialogTitle>
          {isLoggedIn ? (
            <div className="space-y-4">
              <label>
                {t("recipeForm.subtitle")}
                <Input
                  value={recipeName}
                  onChange={(e) => setRecipeName(e.target.value)}
                />
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

export default SaveRecipeCopy;
