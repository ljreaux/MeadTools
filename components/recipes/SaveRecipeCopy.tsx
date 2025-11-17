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
  DialogTrigger
} from "@/components/ui/dialog";

import { Save } from "lucide-react";
import { LoadingButton } from "../ui/LoadingButton";
import { Button } from "../ui/button";
import TooltipHelper from "../Tooltips";
import {
  useCreateRecipeMutation,
  buildRecipePayload
} from "@/hooks/useRecipeQuery";

function SaveRecipeCopy() {
  const { t } = useTranslation();
  const router = useRouter();
  const { toast } = useToast();

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
    stabilizers,
    stabilizerType,
    recipeNameProps
  } = useRecipe();

  const {
    fullData,
    yanContributions,
    otherNutrientName: otherNameState,
    providedYan,
    maxGpl
  } = useNutrients();

  const { isLoggedIn } = useAuth();

  const [checked, setChecked] = useState(false); // private
  const [notify, setNotify] = useState(false); // email notifications
  const [recipeName, setRecipeName] = useState(recipeNameProps.value);

  const createRecipeMutation = useCreateRecipeMutation();

  const createRecipe = async () => {
    const body = buildRecipePayload({
      name: recipeName,
      privateRecipe: checked,
      notify,

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

      notes,
      fullData,
      yanContributions,
      otherNutrientNameValue: otherNameState.value,
      providedYan,
      maxGpl
    });

    try {
      await createRecipeMutation.mutateAsync(body);

      toast({
        description: "Recipe created successfully."
      });
      router.push("/account");
    } catch (error: any) {
      console.error("Error creating recipe:", error?.message ?? error);
      toast({
        title: "Error",
        description: "There was an error creating your recipe",
        variant: "destructive"
      });
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

              {!checked && (
                <label className="grid">
                  <span className="flex items-center gap-1">
                    {t("notify")}
                    <TooltipHelper body={t("tiptext.notify")} />
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
              onClick={createRecipe}
              loading={createRecipeMutation.isPending}
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
