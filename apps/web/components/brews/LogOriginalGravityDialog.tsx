"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { BREW_TRACKER_DIALOG_CONTENT_CLASS, BREW_TRACKER_DIALOG_FOOTER_CLASS } from "@/components/brews/brewTrackerDialog";
import { GRAVITY_UNITS, type GravityUnit } from "@/lib/brewEnums";
import { toBrix, toSG } from "@meadtools/core/gravity";
import { formatBrixNumber, formatSgDisplay } from "@/lib/utils/gravityFormatting";
import type { GravityEntryDisplayData } from "@/lib/utils/entryPayload";

export type LogOriginalGravityInput = {
  chosenOg: number;
  suggestedOg: number;
  suggestedOgSource: "actualized_recipe" | "recipe" | "measured";
  estimatedFg: number;
  fermentableSg: number;
  warningAcknowledged: boolean;
  ogDisplay?: GravityEntryDisplayData;
  note?: string;
  datetime?: string;
};

function formatGravity(value?: number | null) {
  return formatSgDisplay(value, undefined, "");
}

function formatGravityForUnit(value: number | null, unit: GravityUnit) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return unit === GRAVITY_UNITS.BRIX
    ? formatBrixNumber(toBrix(value), undefined, "")
    : formatGravity(value);
}

function gravityInputToSg(value: string, unit: GravityUnit) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NaN;
  return unit === GRAVITY_UNITS.BRIX ? toSG(parsed) : parsed;
}

function GravityInputWithUnits({
  value,
  unit,
  onValueChange,
  onUnitChange
}: {
  value: string;
  unit: GravityUnit;
  onValueChange: (value: string) => void;
  onUnitChange: (unit: GravityUnit) => void;
}) {
  const { t } = useTranslation();

  return (
    <InputGroup className="h-12">
      <InputGroupInput
        inputMode="decimal"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={(event) => event.target.select()}
        className="h-full text-lg"
      />
      <InputGroupAddon
        align="inline-end"
        className="mr-1 whitespace-nowrap px-1 text-xs sm:text-sm"
      >
        <Separator orientation="vertical" className="h-12" />
        <Select value={unit} onValueChange={(next) => onUnitChange(next as GravityUnit)}>
          <SelectTrigger className="mr-2 w-24 border-none p-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GRAVITY_UNITS.SG}>{t("SG", "SG")}</SelectItem>
            <SelectItem value={GRAVITY_UNITS.BRIX}>{t("BRIX")}</SelectItem>
          </SelectContent>
        </Select>
      </InputGroupAddon>
    </InputGroup>
  );
}

export function LogOriginalGravityDialog({
  open,
  onOpenChange,
  suggestedOg,
  suggestedOgSource,
  estimatedFg,
  gravityUnitPreference = GRAVITY_UNITS.SG,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedOg: number | null;
  suggestedOgSource: "actualized_recipe" | "recipe" | "measured";
  estimatedFg: number | null;
  gravityUnitPreference?: GravityUnit;
  onSave: (input: LogOriginalGravityInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [og, setOg] = React.useState("");
  const [ogUnit, setOgUnit] = React.useState<GravityUnit>(gravityUnitPreference);
  const [fg, setFg] = React.useState("");
  const [fgUnit, setFgUnit] = React.useState<GravityUnit>(gravityUnitPreference);
  const [note, setNote] = React.useState("");
  const [datetime, setDatetime] = React.useState<Date>(new Date());
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setOgUnit(gravityUnitPreference);
    setFgUnit(gravityUnitPreference);
    setOg(formatGravityForUnit(suggestedOg, gravityUnitPreference));
    setFg(formatGravityForUnit(estimatedFg, gravityUnitPreference));
    setNote("");
    setDatetime(new Date());
  }, [estimatedFg, gravityUnitPreference, open, suggestedOg]);

  const parsedOg = gravityInputToSg(og, ogUnit);
  const parsedFg = gravityInputToSg(fg, fgUnit);
  const hasSuggested = typeof suggestedOg === "number" && Number.isFinite(suggestedOg) && suggestedOg > 1;
  const differsFromSuggested = hasSuggested && Number.isFinite(parsedOg) && Math.abs(parsedOg - suggestedOg) > 0.0005;
  const fermentableSg = Number.isFinite(parsedOg) && Number.isFinite(parsedFg) ? 1 + (parsedOg - parsedFg) : null;
  const isValid =
    Number.isFinite(parsedOg) &&
    parsedOg > 1 &&
    Number.isFinite(parsedFg) &&
    parsedFg > 0 &&
    fermentableSg != null &&
    fermentableSg > 1 &&
    !isSaving;

  const sourceLabel =
    suggestedOgSource === "measured"
      ? t("brews.primary.measuredOg", "measured OG")
      : suggestedOgSource === "actualized_recipe"
        ? t("brews.primary.actualizedRecipeOg", "logged ingredients")
        : t("brews.primary.recipeOg", "recipe OG");

  const save = async () => {
    if (!isValid || fermentableSg == null) return;
    setIsSaving(true);
    try {
      await onSave({
        chosenOg: parsedOg,
        suggestedOg: suggestedOg ?? parsedOg,
        suggestedOgSource,
        estimatedFg: parsedFg,
        fermentableSg,
        warningAcknowledged: differsFromSuggested,
        ogDisplay: {
          enteredValue: Number(og),
          enteredUnit: ogUnit,
          convertedGravity: parsedOg,
          refractometerCorrectionApplied: false
        },
        note: note.trim() || undefined,
        datetime: datetime.toISOString()
      });
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${BREW_TRACKER_DIALOG_CONTENT_CLASS} sm:max-w-[520px]`}>
        <DialogHeader>
          <DialogTitle>{t("brews.actions.logOg", "Log OG")}</DialogTitle>
          <DialogDescription>
            {t("brews.primary.logOgDesc", "Original gravity also sets the nutrient calculation basis for primary.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hasSuggested ? (
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {t("brews.primary.suggestedOg", "Suggested OG")}: {formatGravity(suggestedOg)} ({sourceLabel})
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("brews.primary.og", "Original gravity")}</Label>
              <GravityInputWithUnits
                value={og}
                unit={ogUnit}
                onValueChange={setOg}
                onUnitChange={(nextUnit) => {
                  const currentSg = gravityInputToSg(og, ogUnit);
                  setOgUnit(nextUnit);
                  if (Number.isFinite(currentSg)) {
                    setOg(formatGravityForUnit(currentSg, nextUnit));
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("brews.primary.estimatedFg", "Estimated FG")}</Label>
              <GravityInputWithUnits
                value={fg}
                unit={fgUnit}
                onValueChange={setFg}
                onUnitChange={(nextUnit) => {
                  const currentSg = gravityInputToSg(fg, fgUnit);
                  setFgUnit(nextUnit);
                  if (Number.isFinite(currentSg)) {
                    setFg(formatGravityForUnit(currentSg, nextUnit));
                  }
                }}
              />
            </div>
          </div>

          {differsFromSuggested ? (
            <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm">
              {t(
                "brews.primary.ogOverrideWarning",
                "This OG differs from the suggested value. Confirm the estimated FG so nutrients are calculated from the intended fermentable gravity."
              )}
            </div>
          ) : null}

          {fermentableSg != null ? (
            <div className="text-sm text-muted-foreground">
              {t("brews.primary.fermentableSg", "Fermentable SG")}: {formatGravity(fermentableSg)}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{t("date", "Date")}</Label>
            <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
          </div>

          <div className="space-y-2">
            <Label>{t("note", "Note")}</Label>
            <Textarea
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("optional", "Optional")}
            />
          </div>
        </div>

        <DialogFooter className={BREW_TRACKER_DIALOG_FOOTER_CLASS}>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
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
