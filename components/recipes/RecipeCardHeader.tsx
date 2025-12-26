"use client";

import { Switch } from "../ui/switch";
import { Separator } from "../ui/separator";
import { Pencil, PencilOff } from "lucide-react";
import Tooltip from "../Tooltips";
import Rating from "./Rating";
import { useTranslation } from "react-i18next";

import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton
} from "../ui/input-group";
import { cn } from "@/lib/utils";
import { RecipeWithParsedFields } from "@/hooks/reactQuery/useRecipeQuery";

export default function RecipeCardHeader({
  heading,
  tooltip,
  recipe,
  nameEditable,
  setNameEditable,
  isPrivate,
  setIsPrivate,
  notify,
  setNotify,
  recipeNameProps
}: {
  heading: string;
  tooltip?: { body: string; link: string };
  recipe: RecipeWithParsedFields;
  nameEditable: boolean;
  setNameEditable: (v: boolean) => void;
  isPrivate: boolean;
  setIsPrivate: (v: boolean) => void;
  notify: boolean;
  setNotify: (v: boolean) => void;
  recipeNameProps: {
    recipeName: string;
    setRecipeName: (v: string) => void;
  };
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Step heading */}
      <div className="text-center">
        <h1 className="text-3xl">
          {t(heading)}{" "}
          {tooltip && <Tooltip {...tooltip} body={t(tooltip.body)} />}
        </h1>
      </div>

      {/* Recipe name row (InputGroup) */}

      <InputGroup className="w-full h-12">
        <InputGroupInput
          value={recipeNameProps.recipeName}
          onChange={(e) => recipeNameProps.setRecipeName(e.target.value)}
          disabled={!nameEditable}
          className="h-11 text-xl"
        />

        {/* right-side edit toggle */}
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            title={
              nameEditable
                ? t("disableEdit", "Disable editing")
                : t("edit", "Edit")
            }
            onClick={() => setNameEditable(!nameEditable)}
            className="h-full"
          >
            {nameEditable ? <Pencil /> : <PencilOff />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {/* Switches (no borders, just clean alignment) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center justify-between gap-3 sm:justify-start">
          <span className="text-sm font-medium">{t("private")}</span>
          <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
        </label>

        <label
          className={cn(
            "flex items-center justify-between gap-3 sm:justify-start",
            {
              invisible: isPrivate
            }
          )}
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            {t("notify")}
            <Tooltip body={t("tiptext.notify")} />
          </span>
          <Switch checked={notify} onCheckedChange={setNotify} />
        </label>
      </div>

      {/* Rating */}

      <Rating
        averageRating={recipe.averageRating ?? 0}
        numberOfRatings={recipe.numberOfRatings ?? 0}
      />

      <Separator />
    </div>
  );
}
