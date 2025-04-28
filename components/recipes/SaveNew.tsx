"use client";

import React, { useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useTranslation } from "react-i18next";
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

import { FilePlus } from "lucide-react";
import { LoadingButton } from "../ui/LoadingButton";

function SaveNew() {
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
    providedYan,
    maxGpl,
  } = useNutrients();

  const { fetchAuthenticatedPost } = useAuth();

  const [checked, setChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [recipeName, setRecipeName] = useState("");

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
        <div className="relative group flex flex-col items-center my-2">
          <button className="flex items-center justify-center sm:w-12 sm:h-12 w-8 h-8 bg-background text-foreground rounded-full border border-foreground hover:text-background hover:bg-foreground transition-colors">
            <FilePlus />
          </button>
          <span className="absolute top-1/2 -translate-y-1/2 right-16 whitespace-nowrap px-2 py-1 bg-background text-foreground border border-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity">
            {t("changesForm.saveAs")}
          </span>
        </div>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("changesForm.saveAs")}</DialogTitle>

          <div className="space-y-4">
            <label>
              {t("changesForm.subtitle")}
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
        </DialogHeader>

        <DialogFooter>
          <LoadingButton
            onClick={createRecipe}
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

export default SaveNew;
