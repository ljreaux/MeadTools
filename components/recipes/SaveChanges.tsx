"use client";

import { useTranslation } from "react-i18next";

import { Save } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

import { Spinner } from "../ui/spinner";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "@/components/ui/tooltip";

import { useSaveRecipe } from "@/hooks/useSaveRecipe";

function SaveChanges({
  privateRecipe,
  bottom,
  emailNotifications,
  name
}: {
  privateRecipe: boolean;
  bottom?: boolean;
  emailNotifications?: boolean;
  name: string;
}) {
  const { t } = useTranslation();

  const { save, isSaving } = useSaveRecipe({
    name,
    privateRecipe,
    emailNotifications
  });
  const icon = isSaving ? <Spinner /> : <Save />;

  return (
    <div
      className={cn("relative flex flex-col items-center", {
        "w-full": bottom
      })}
    >
      {bottom ? (
        <Button
          variant="secondary"
          className="w-full"
          onClick={save}
          disabled={isSaving}
          aria-label={t("changesForm.submit")}
        >
          {icon}
        </Button>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={save}
              disabled={isSaving}
              aria-label={t("changesForm.submit")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-foreground bg-background text-foreground hover:bg-foreground hover:text-background sm:h-12 sm:w-12 disabled:opacity-60"
            >
              {icon}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="whitespace-nowrap">
            {t("changesForm.submit")}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export default SaveChanges;
