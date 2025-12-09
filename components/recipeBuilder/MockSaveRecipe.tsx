"use client";

import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger
} from "@/components/ui/dialog";

import { Save } from "lucide-react";
import { DialogTitle } from "@radix-ui/react-dialog";
import Link from "next/link";

function MockSaveRecipe() {
  const { t } = useTranslation();

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

          <Link
            href={"/login"}
            className="flex items-center justify-center gap-4 px-8 py-2 my-4 text-lg border border-solid rounded-lg bg-background text-foreground hover:bg-foreground hover:border-background hover:text-background sm:gap-8 group"
          >
            {t("recipeForm.login")}
          </Link>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

export default MockSaveRecipe;
