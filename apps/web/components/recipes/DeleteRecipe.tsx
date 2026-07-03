"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTrigger
} from "../ui/alert-dialog";
import { buttonVariants, Button } from "../ui/button";
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogTitle
} from "@radix-ui/react-alert-dialog";
import { Trash } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useParams, useRouter } from "next/navigation";
import { useDeleteRecipe } from "@/hooks/reactQuery/useDeleteRecipe";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

export default function DeleteRecipe() {
  const { t } = useTranslation();
  const deleteRecipeMutation = useDeleteRecipe();
  const router = useRouter();
  const params = useParams();
  const recipeId = params?.id;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <div className="relative flex flex-col items-center my-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                aria-label={t("accountPage.deleteRecipe")}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground bg-destructive text-foreground hover:bg-foreground hover:text-destructive sm:h-12 sm:w-12"
              >
                <Trash />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="whitespace-nowrap">
              {t("accountPage.deleteRecipe")}
            </TooltipContent>
          </Tooltip>
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

          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            onClick={() => {
              if (recipeId && typeof recipeId === "string") {
                deleteRecipeMutation.mutate(Number(recipeId));
                router.push("/account");
              }
            }}
          >
            {t("desktop.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
