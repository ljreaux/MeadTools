"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";

import { useRecipe } from "@/components/providers/RecipeProvider";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";

import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import Tooltip from "@/components/Tooltips";
import { Separator } from "@/components/ui/separator";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";

export default function DesiredBatchDetails() {
  const { t } = useTranslation();

  const {
    data: { unitDefaults },
    setIngredientsToTarget
  } = useRecipe();

  const [{ og, volume }, setOgAndVolume] = useState({ og: "", volume: "" });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);

  const canSubmit = og.trim() !== "" && volume.trim() !== "";

  const handleSubmit = () => {
    setIngredientsToTarget(parseNumber(og), parseNumber(volume));
    setIsDialogOpen(false);
    setOgAndVolume({ og: "", volume: "" });
  };

  return (
    <div>
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* HEADER */}
        <CollapsibleTrigger
          className="flex w-full items-center justify-between cursor-pointer"
          asChild
        >
          <span>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              {t("initialDetails.title")}
              <Tooltip body={t("tipText.desiredDetailsForm")} />
            </h3>

            <ChevronDown
              className={`h-5 w-5 transition-transform duration-200 ${
                open ? "rotate-180" : ""
              }`}
            />
          </span>
        </CollapsibleTrigger>

        {/* CONTENT */}
        <CollapsibleContent className="mt-4 grid gap-4 joyride-initialDetails">
          {/* OG Input */}
          <InputGroup className="h-12">
            <InputGroupInput
              placeholder={t("placeholder.og")}
              value={og}
              onChange={(e) => {
                if (isValidNumber(e.target.value)) {
                  setOgAndVolume({ og: e.target.value, volume });
                }
              }}
              inputMode="decimal"
              onFocus={(e) => e.target.select()}
              className="text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="mr-1 text-xs sm:text-sm"
            >
              {t("SG")}
            </InputGroupAddon>
          </InputGroup>

          {/* Volume Input */}
          <InputGroup className="h-12">
            <InputGroupInput
              placeholder={t("placeholder.volume")}
              value={volume}
              onChange={(e) => {
                if (isValidNumber(e.target.value)) {
                  setOgAndVolume({ og, volume: e.target.value });
                }
              }}
              inputMode="decimal"
              onFocus={(e) => e.target.select()}
              className="text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="mr-1 text-xs sm:text-sm"
            >
              {unitDefaults.volume}
            </InputGroupAddon>
          </InputGroup>

          <Button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="max-w-24"
            disabled={!canSubmit}
          >
            {t("SUBMIT")}
          </Button>
        </CollapsibleContent>
      </Collapsible>

      {/* CONFIRMATION DIALOG */}
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("desktop.confirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("calculateDetailsDialog")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {t("SUBMIT")}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Separator className="my-2" />
    </div>
  );
}
