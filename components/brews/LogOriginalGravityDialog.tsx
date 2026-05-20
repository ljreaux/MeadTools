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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateTimePicker } from "@/components/ui/datetime-picker";

export type LogOriginalGravityInput = {
  chosenOg: number;
  suggestedOg: number;
  suggestedOgSource: "actualized_recipe" | "recipe" | "measured";
  estimatedFg: number;
  fermentableSg: number;
  warningAcknowledged: boolean;
  note?: string;
  datetime?: string;
};

function formatGravity(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(3) : "";
}

export function LogOriginalGravityDialog({
  open,
  onOpenChange,
  suggestedOg,
  suggestedOgSource,
  estimatedFg,
  onSave
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestedOg: number | null;
  suggestedOgSource: "actualized_recipe" | "recipe" | "measured";
  estimatedFg: number | null;
  onSave: (input: LogOriginalGravityInput) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [og, setOg] = React.useState("");
  const [fg, setFg] = React.useState("");
  const [note, setNote] = React.useState("");
  const [datetime, setDatetime] = React.useState<Date>(new Date());
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setOg(formatGravity(suggestedOg));
    setFg(formatGravity(estimatedFg));
    setNote("");
    setDatetime(new Date());
  }, [estimatedFg, open, suggestedOg]);

  const parsedOg = Number(og);
  const parsedFg = Number(fg);
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
      <DialogContent className="sm:max-w-[520px]">
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
              <Input
                inputMode="decimal"
                value={og}
                onChange={(event) => setOg(event.target.value)}
                onFocus={(event) => event.target.select()}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("brews.primary.estimatedFg", "Estimated FG")}</Label>
              <Input
                inputMode="decimal"
                value={fg}
                onChange={(event) => setFg(event.target.value)}
                onFocus={(event) => event.target.select()}
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

        <DialogFooter>
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
