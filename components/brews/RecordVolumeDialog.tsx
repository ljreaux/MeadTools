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
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { getUnitLabel } from "@/components/brews/stages/additionDialogShared";

type DialogVolumeUnit = VolumeUnit;
type PreferredUnits = "US" | "METRIC";
const US_VOLUME_UNITS: DialogVolumeUnit[] = ["gal", "qt", "pt", "fl_oz"];
const METRIC_VOLUME_UNITS: DialogVolumeUnit[] = ["L", "mL"];
const IMPERIAL_VOLUME_UNITS: DialogVolumeUnit[] = ["imp_gal", "imp_qt", "imp_pt", "imp_fl_oz"];

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

function formatSignedDisplayVolume(liters: number, unit: DialogVolumeUnit) {
  if (!Number.isFinite(liters)) return null;
  const converted = liters * L_TO_VOLUME[unit];
  const sign = converted > 0 ? "+" : "";
  return `${sign}${converted.toFixed(2)} ${unit}`;
}

export function RecordVolumeDialog({
  t,
  open,
  onOpenChange,
  currentVolumeLiters,
  defaultVolumeUnit,
  intent = "current",
  onSave
}: {
  t: TFunction;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVolumeLiters: number | null;
  defaultVolumeUnit?: DialogVolumeUnit;
  intent?: "current" | "secondaryVolume";
  onSave: (
    currentVolumeLiters: number,
    meta: {
      displayValue: number;
      displayUnit: DialogVolumeUnit;
      startingLiters?: number;
      datetime?: string;
    }
  ) => Promise<void>;
}) {
  const [preferredUnit, setPreferredUnit] = React.useState<DialogVolumeUnit>("gal");
  const [displayUnit, setDisplayUnit] = React.useState<DialogVolumeUnit>("gal");
  const [volumeValue, setVolumeValue] = React.useState("");
  const [volumeUnit, setVolumeUnit] = React.useState<DialogVolumeUnit>("gal");
  const [datetime, setDatetime] = React.useState<Date>(new Date());
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    try {
      const preferred = localStorage.getItem("units") as PreferredUnits | null;
      const nextUnit = defaultVolumeUnit ?? getPreferredVolumeUnit(preferred);
      setPreferredUnit(nextUnit);
      setDisplayUnit(nextUnit);
      setVolumeUnit(nextUnit);
    } catch {
      setPreferredUnit("gal");
      setDisplayUnit("gal");
      setVolumeUnit("gal");
    }
  }, [defaultVolumeUnit]);

  const currentVolumeDisplay = React.useMemo(
    () => formatDisplayVolume(currentVolumeLiters, displayUnit),
    [currentVolumeLiters, displayUnit]
  );

  React.useEffect(() => {
    if (open) {
      setVolumeValue("");
      setVolumeUnit(preferredUnit);
      setDatetime(new Date());
    }
  }, [open, preferredUnit]);

  const parsed = Number(volumeValue);
  const isSecondaryVolume = intent === "secondaryVolume";
  const hasStartingVolume =
    typeof currentVolumeLiters === "number" &&
    Number.isFinite(currentVolumeLiters) &&
    currentVolumeLiters > 0;
  const inputLiters = parsed * VOLUME_TO_L[volumeUnit];
  const resultingVolumeLiters = inputLiters;
  const isValid =
    Number.isFinite(parsed) &&
    parsed > 0 &&
    !isSaving;

  const save = async () => {
    if (!Number.isFinite(parsed) || parsed <= 0) return;

    setIsSaving(true);
    try {
      await onSave(resultingVolumeLiters, {
        displayValue: parsed,
        displayUnit: volumeUnit,
        startingLiters: isSecondaryVolume ? currentVolumeLiters ?? undefined : undefined,
        datetime: datetime.toISOString()
      });
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
            {isSecondaryVolume
              ? t("brews.primary.recordSecondaryVolume", "Record secondary volume")
              : t("brews.volume.recordCurrent", "Record current volume")}
          </DialogTitle>
          <DialogDescription>
            {isSecondaryVolume
              ? t(
                  "brews.primary.recordSecondaryVolumeDesc",
                  "Enter the total volume after transferring to secondary. This becomes the batch volume used for stabilizers and later additions."
                )
              : t(
                  "brews.volume.recordCurrentDesc",
                  "Record the current batch volume for this brew."
                )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-medium">
              {isSecondaryVolume
                ? t("brews.primary.previousVolume", "Previous volume")
                : t("brews.volume.currentVolume", "Current volume")}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-muted-foreground">
                {currentVolumeDisplay ??
                  t("brews.volume.noVolume", "No volume recorded yet.")}
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
                  {US_VOLUME_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {getUnitLabel(t, unit)}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  {METRIC_VOLUME_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {getUnitLabel(t, unit)}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  {IMPERIAL_VOLUME_UNITS.map((unit) => (
                    <SelectItem key={unit} value={unit}>
                      {getUnitLabel(t, unit)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">
              {isSecondaryVolume
                ? t("brews.primary.enterSecondaryVolume", "Volume after transfer")
                : t("brews.volume.enterVolume", "Volume")}
            </div>
            <InputGroup className="h-10">
              <InputGroupInput
                inputMode="decimal"
                value={volumeValue}
                onChange={(e) => setVolumeValue(e.target.value)}
                placeholder={
                  isSecondaryVolume
                    ? t("brews.primary.secondaryVolumePlaceholder", "Enter volume after transfer")
                    : t("brews.volume.placeholder", "Enter volume")
                }
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
                    {US_VOLUME_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {getUnitLabel(t, unit)}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    {METRIC_VOLUME_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {getUnitLabel(t, unit)}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    {IMPERIAL_VOLUME_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {getUnitLabel(t, unit)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
            {isSecondaryVolume && hasStartingVolume && Number.isFinite(parsed) && parsed > 0 ? (
              <div className="text-xs text-muted-foreground">
                {t("brews.primary.volumeChange", "Volume change")}:{" "}
                {formatSignedDisplayVolume(
                  resultingVolumeLiters - currentVolumeLiters,
                  volumeUnit
                )}
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">{t("date", "Date")}</div>
            <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
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
            {isSecondaryVolume
              ? t("brews.primary.saveSecondaryVolume", "Save volume")
              : t("save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
