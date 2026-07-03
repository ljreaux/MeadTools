"use client";

import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger
} from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";
import Link from "next/link";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

function MockSaveRecipe() {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <div className="joyride-saveRecipe flex flex-col items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon"
                aria-label={t("recipeForm.submit")}
                className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground bg-background text-foreground hover:bg-foreground hover:text-background sm:h-12 sm:w-12"
              >
                <Save />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="whitespace-nowrap">
              {t("recipeForm.submit")}
            </TooltipContent>
          </Tooltip>
        </div>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("recipeForm.title")}</DialogTitle>

          <Link
            href="/login"
            className="flex items-center justify-center gap-4 px-8 py-2 my-4 text-lg border border-solid rounded-lg bg-background text-foreground hover:bg-foreground hover:border-background hover:text-background sm:gap-8"
          >
            {t("recipeForm.login")}
          </Link>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

export default MockSaveRecipe;
