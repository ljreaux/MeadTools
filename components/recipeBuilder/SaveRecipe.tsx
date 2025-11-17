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
  DialogTrigger
} from "@/components/ui/dialog";

import { Save } from "lucide-react";
import { LoadingButton } from "../ui/LoadingButton";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
import Tooltip from "../Tooltips";
import {
  getLastActivityEmailAt,
  useCreateRecipeMutation
} from "@/hooks/useRecipeQuery";

function SaveRecipe({ bottom }: { bottom?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();
  const { isLoggedIn } = useAuth();

  const createRecipeMutation = useCreateRecipeMutation();

  const [checked, setChecked] = useState(false); // private toggle
  const [notify, setNotify] = useState(false); // email notify toggle

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

  const handleCreateRecipe = () => {
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
      private: checked,
      lastActivityEmailAt: getLastActivityEmailAt(checked, notify)
    };

    createRecipeMutation.mutate(body, {
      onSuccess: () => {
        resetRecipe();
        toast({
          description: "Recipe created successfully."
        });
        router.push("/account");
      },
      onError: (error: any) => {
        console.error("Error creating recipe:", error?.message ?? error);
        toast({
          title: "Error",
          description: "There was an error creating your recipe",
          variant: "destructive"
        });
      }
    });
  };

  const isSubmitting = createRecipeMutation.isPending;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div
          className={cn(
            "joyride-saveRecipe relative group flex flex-col items-center",
            { "w-full": bottom }
          )}
        >
          {bottom ? (
            <Button variant="secondary" className="w-full">
              <Save />
            </Button>
          ) : (
            <>
              <button
                className="flex items-center justify-center sm:w-12 sm:h-12 w-8 h-8 bg-background text-foreground rounded-full border border-foreground hover:text-background hover:bg-foreground transition-colors"
                type="button"
              >
                <Save />
              </button>
              <span className="absolute top-1/2 -translate-y-1/2 right-16 whitespace-nowrap px-2 py-1 bg-background text-foreground border border-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity">
                {t("recipeForm.submit")}
              </span>
            </>
          )}
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
              {!checked && (
                <label className="grid">
                  <span className="flex items-center">
                    {t("notify")}
                    <Tooltip body={t("tiptext.notify")} />
                  </span>
                  <Switch checked={notify} onCheckedChange={setNotify} />
                </label>
              )}
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
              onClick={handleCreateRecipe}
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
