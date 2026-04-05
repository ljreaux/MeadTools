"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import type { TFunction } from "i18next";
import { L_TO_VOLUME, VOLUME_TO_L } from "@/lib/utils/recipeDataCalculations";
import type { VolumeUnit } from "@/types/recipeData";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";

type DialogVolumeUnit = Extract<VolumeUnit, "gal" | "qt" | "pt" | "L" | "mL">;
type PreferredUnits = "US" | "METRIC";

function getPreferredVolumeUnit(preferred: PreferredUnits | null): DialogVolumeUnit {
  return preferred === "METRIC" ? "L" : "gal";
}

function formatDisplayVolume(
  liters: number | null | undefined,
  unit: DialogVolumeUnit
) {
  if (typeof liters !== "number" || !Number.isFinite(liters) || liters <= 0) {
    return null;
  }

  const converted = liters * L_TO_VOLUME[unit];
  return `${converted.toFixed(2)} ${unit}`;
}

export function RecordVolumeDialog({
  t,
  open,
  onOpenChange,
  currentVolumeLiters,
  onSave
}: {
  t: TFunction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVolumeLiters: number | null;
  onSave: (currentVolumeLiters: number) => Promise<void>;
}) {
  const [preferredUnit, setPreferredUnit] = React.useState<DialogVolumeUnit>("gal");
  const [displayUnit, setDisplayUnit] = React.useState<DialogVolumeUnit>("gal");
  const [volumeValue, setVolumeValue] = React.useState("");
  const [volumeUnit, setVolumeUnit] = React.useState<DialogVolumeUnit>("gal");
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    try {
      const preferred = localStorage.getItem("units") as PreferredUnits | null;
      const nextUnit = getPreferredVolumeUnit(preferred);
      setPreferredUnit(nextUnit);
      setDisplayUnit(nextUnit);
      setVolumeUnit(nextUnit);
    } catch {
      setPreferredUnit("gal");
      setDisplayUnit("gal");
      setVolumeUnit("gal");
    }
  }, []);

  const currentVolumeDisplay = React.useMemo(
    () => formatDisplayVolume(currentVolumeLiters, displayUnit),
    [currentVolumeLiters, displayUnit]
  );

  React.useEffect(() => {
    if (open) {
      setVolumeValue("");
      setVolumeUnit(preferredUnit);
    }
  }, [open, preferredUnit]);

  const parsed = Number(volumeValue);
  const isValid =
    Number.isFinite(parsed) && parsed > 0 && !isSaving;

  const save = async () => {
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    setIsSaving(true);
    try {
      await onSave(parsed * VOLUME_TO_L[volumeUnit]);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("brews.primary.setVolume", "Record current volume")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "brews.primary.setVolumeDesc",
              "Record the current batch volume before moving to secondary."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">
              {t("brews.primary.currentVolume", "Current volume")}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {currentVolumeDisplay ??
                  t("brews.primary.noVolume", "No volume recorded yet.")}
              </div>
              <Select
                value={displayUnit}
                onValueChange={(value) =>
                  setDisplayUnit(value as DialogVolumeUnit)
                }
                disabled={isSaving}
              >
                <SelectTrigger className="sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gal">{t("units.gal", "gal")}</SelectItem>
                  <SelectItem value="qt">{t("units.qt", "qt")}</SelectItem>
                  <SelectItem value="pt">{t("units.pt", "pt")}</SelectItem>
                  <SelectItem value="L">{t("units.L", "L")}</SelectItem>
                  <SelectItem value="mL">{t("units.mL", "mL")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">
              {t("brews.primary.enterVolume", "Volume")}
            </div>
            <InputGroup className="h-10">
              <InputGroupInput
                inputMode="decimal"
                value={volumeValue}
                onChange={(e) => setVolumeValue(e.target.value)}
                placeholder={t("brews.primary.volumePlaceholder", "Enter volume")}
                disabled={isSaving}
                onFocus={(e) => e.target.select()}
                className="h-full text-lg"
              />
              <InputGroupAddon align="inline-end" className="pr-1">
                <Separator orientation="vertical" className="h-10" />
                <Select
                  value={volumeUnit}
                  onValueChange={(value) =>
                    setVolumeUnit(value as DialogVolumeUnit)
                  }
                  disabled={isSaving}
                >
                  <SelectTrigger className="p-2 border-none mr-2 w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gal">{t("units.gal", "gal")}</SelectItem>
                    <SelectItem value="qt">{t("units.qt", "qt")}</SelectItem>
                    <SelectItem value="pt">{t("units.pt", "pt")}</SelectItem>
                    <SelectSeparator />
                    <SelectItem value="L">{t("units.L", "L")}</SelectItem>
                    <SelectItem value="mL">{t("units.mL", "mL")}</SelectItem>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {t("cancel", "Cancel")}
          </Button>
          <Button onClick={save} disabled={!isValid}>
            {t("save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
