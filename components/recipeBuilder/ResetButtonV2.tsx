"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger
} from "../ui/alert-dialog";
import { Button } from "../ui/button";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle
} from "@radix-ui/react-alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Trash } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

import { useRecipeV2 } from "../providers/RecipeProviderV2";

type ResetButtonV2Props = {
  resetFlow: () => void;
};

export default function ResetButtonV2({ resetFlow }: ResetButtonV2Props) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const recipe = useRecipeV2();

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <div className="joyride-deleteRecipe flex flex-col items-center my-2">
          <UiTooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                aria-label={t("recipeBuilder.reset")}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground bg-destructive text-foreground hover:bg-foreground hover:text-destructive sm:h-12 sm:w-12"
              >
                <Trash />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="whitespace-nowrap">
              {t("recipeBuilder.reset")}
            </TooltipContent>
          </UiTooltip>
        </div>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("desktop.confirm")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("confirm.subtitle")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>

          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={() => {
                recipe.meta.reset(); // provider reset
                resetFlow(); // builder reset (step/page)

                toast({
                  title: t("recipeBuilder.reset"),
                  description: t(
                    "recipeBuilder.resetDone",
                    "Recipe has been reset."
                  )
                });
              }}
            >
              {t("reset")}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
