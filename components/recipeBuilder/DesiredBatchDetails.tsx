"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";

import { useRecipe } from "@/components/providers/RecipeProvider";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";
import { calcABV, calcOG } from "@/lib/utils/unitConverter";

import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import Tooltip from "@/components/Tooltips";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

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

type TargetUnit = "SG" | "ABV";

export default function DesiredBatchDetails() {
  const { t } = useTranslation();

  const {
    data: { fg, unitDefaults },
    setIngredientsToTarget
  } = useRecipe();

  const [{ og, volume }, setOgAndVolume] = useState({ og: "", volume: "" });
  const [targetUnit, setTargetUnit] = useState<TargetUnit>("SG");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [open, setOpen] = useState(false);

  const estimatedFg = parseNumber(fg);
  const maxAbv = calcABV(1.3, estimatedFg);
  const enteredTarget = parseNumber(og);
  const abvOutOfRange =
    targetUnit === "ABV" &&
    og.trim() !== "" &&
    (!Number.isFinite(enteredTarget) ||
      enteredTarget < 0 ||
      enteredTarget > maxAbv);

  const getTargetOg = () => {
    const target = enteredTarget;
    if (targetUnit === "SG") return target;

    try {
      return calcOG(target, estimatedFg);
    } catch {
      return NaN;
    }
  };

  const targetOg = getTargetOg();
  const canSubmit =
    og.trim() !== "" &&
    volume.trim() !== "" &&
    Number.isFinite(targetOg);

  const handleSubmit = () => {
    setIngredientsToTarget(targetOg, parseNumber(volume));
    setIsDialogOpen(false);
    setOgAndVolume({ og: "", volume: "" });
  };

  const handleTargetUnitChange = (nextUnit: TargetUnit) => {
    const currentTarget = parseNumber(og);

    if (!Number.isFinite(currentTarget) || !Number.isFinite(estimatedFg)) {
      setTargetUnit(nextUnit);
      return;
    }

    try {
      const convertedTarget =
        nextUnit === "ABV"
          ? calcABV(currentTarget, estimatedFg)
          : calcOG(currentTarget, estimatedFg);

      setTargetUnit(nextUnit);
      setOgAndVolume({
        og: convertedTarget.toFixed(nextUnit === "ABV" ? 2 : 3),
        volume
      });
    } catch {
      // Keep the current unit and value so the validation remains visible.
    }
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
          <div className="grid gap-1">
            <InputGroup className="h-12">
              <InputGroupInput
                placeholder={
                  targetUnit === "ABV"
                    ? t("placeholder.abv")
                    : t("placeholder.og")
                }
                value={og}
                onChange={(e) => {
                  if (isValidNumber(e.target.value)) {
                    setOgAndVolume({ og: e.target.value, volume });
                  }
                }}
                inputMode="decimal"
                onFocus={(e) => e.target.select()}
                className="text-lg"
                aria-invalid={abvOutOfRange}
              />
              <InputGroupAddon
                align="inline-end"
                className="mr-1 whitespace-nowrap px-1 text-xs sm:text-sm"
              >
                <Separator orientation="vertical" className="h-12" />
                <Select
                  value={targetUnit}
                  onValueChange={(value) =>
                    handleTargetUnitChange(value as TargetUnit)
                  }
                >
                  <SelectTrigger className="mr-2 w-24 border-none p-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SG">{t("SG")}</SelectItem>
                    <SelectItem value="ABV">{t("ABV")}</SelectItem>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
            {abvOutOfRange ? (
              <p className="text-xs text-destructive">
                {t("initialDetails.abvOutOfRange", {
                  maxDisp: maxAbv.toFixed(2)
                })}
              </p>
            ) : null}
          </div>

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
