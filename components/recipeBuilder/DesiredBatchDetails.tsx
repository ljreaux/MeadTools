"use client";

import { useState } from "react";
import { useRecipe } from "../providers/RecipeProvider";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon
} from "@/components/ui/input-group";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel
} from "../ui/alert-dialog";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import Tooltip from "../Tooltips";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";

function DesiredBatchDetails() {
  const { t } = useTranslation();
  const { setIngredientsToTarget, units } = useRecipe();

  const [{ og, volume }, setOgAndVolume] = useState({ og: "", volume: "" });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);

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
              placeholder={t("placeholder.og", "Enter OG")}
              value={og}
              onChange={(e) => {
                if (isValidNumber(e.target.value))
                  setOgAndVolume({ og: e.target.value, volume });
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
              placeholder={t("placeholder.volume", "Enter Volume")}
              value={volume}
              onChange={(e) => {
                if (isValidNumber(e.target.value))
                  setOgAndVolume({ og, volume: e.target.value });
              }}
              inputMode="decimal"
              onFocus={(e) => e.target.select()}
              className="text-lg"
            />
            <InputGroupAddon
              align="inline-end"
              className="mr-1 text-xs sm:text-sm"
            >
              {units.volume}
            </InputGroupAddon>
          </InputGroup>

          <Button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="max-w-24"
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
              <Button onClick={handleSubmit}>{t("SUBMIT")}</Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>{" "}
      <Separator className="my-2" />
    </div>
  );
}

export default DesiredBatchDetails;
