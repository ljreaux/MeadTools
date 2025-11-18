"use client";

import React, { useState } from "react";
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
  DialogTrigger
} from "@/components/ui/dialog";

import { FilePlus } from "lucide-react";
import { LoadingButton } from "../ui/LoadingButton";
import TooltipHelper from "../Tooltips";
import {
  useCreateRecipeMutation,
  buildRecipePayload
} from "@/hooks/useRecipeQuery";

function SaveNew() {
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

  const [checked, setChecked] = useState(false); // private
  const [notify, setNotify] = useState(false); // email notifications
  const [recipeName, setRecipeName] = useState(recipeNameProps.value);

  const createRecipeMutation = useCreateRecipeMutation();

  const createRecipe = async () => {
    const body = buildRecipePayload({
      name: recipeName,
      privateRecipe: checked,
      emailNotifications: notify,

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
        </DialogHeader>

        <DialogFooter>
          <LoadingButton
            onClick={createRecipe}
            loading={createRecipeMutation.isPending}
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
