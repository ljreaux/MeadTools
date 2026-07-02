"use client";

import { Button } from "@/components/ui/button";
import { BREW_TRACKER_DIALOG_CONTENT_CLASS, BREW_TRACKER_DIALOG_FOOTER_CLASS } from "@/components/brews/brewTrackerDialog";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatSgDisplay } from "@/lib/utils/gravityFormatting";
import { L_TO_VOLUME } from "@meadtools/core/recipe";
import { normalizeNumberString } from "@/lib/utils/validateInput";
import type { AdditiveLine, IngredientLine, NoteLine, RecipeUnitDefaults } from "@/types/recipeData";
import * as React from "react";
import { useTranslation } from "react-i18next";
import type { StageWarning } from "../stageConfig";

export function formatNumber(value?: number | null, decimals = 2, locale?: string, fallback = "—") {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return normalizeNumberString(value, decimals, locale);
}

export function formatGravity(value?: number | null, locale?: string, fallback = "—") {
  return formatSgDisplay(value, locale, fallback);
}

export function formatVolume(
  liters?: number | null,
  unit: RecipeUnitDefaults["volume"] = "gal",
  locale?: string,
  options: { allowZero?: boolean; fallback?: string } = {}
) {
  const min = options.allowZero ? 0 : Number.MIN_VALUE;
  const fallback = options.fallback ?? "—";
  if (typeof liters !== "number" || !Number.isFinite(liters) || liters < min) return fallback;
  return `${formatNumber(liters * L_TO_VOLUME[unit], 2, locale, fallback)} ${unit}`;
}

export function formatLoggedAmount(
  addition?: {
    amount: number | null;
    unit: string | null;
  } | null,
  locale?: string
) {
  if (!addition || typeof addition.amount !== "number") return null;
  return [formatNumber(addition.amount, 2, locale), addition.unit].filter(Boolean).join(" ");
}

function getTime(value?: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function latestLoggedItem<T extends { datetime?: string | null; createdAt?: string | null }>(items?: T[]) {
  if (!items?.length) return null;
  return [...items].sort((a, b) => getTime(b.datetime ?? b.createdAt) - getTime(a.datetime ?? a.createdAt))[0];
}

export function sortNewestFirst<T extends { datetime?: string | null; createdAt?: string | null }>(items: T[]) {
  return [...items].sort((a, b) => getTime(b.datetime ?? b.createdAt) - getTime(a.datetime ?? a.createdAt));
}

export function getIngredientAmount(line: IngredientLine) {
  const src = line.amounts.basis === "volume" ? line.amounts.volume : line.amounts.weight;
  const amount = Number(src.value);
  if (!Number.isFinite(amount)) return {};
  return { amount, unit: src.unit };
}

export function getAdditiveAmount(line: AdditiveLine) {
  const amount = Number(line.amount);
  if (!Number.isFinite(amount)) return {};
  return { amount, unit: line.unit };
}

export function formatRecipeAmount(value?: string, unit?: string) {
  const v = (value ?? "").trim();
  if (!v) return null;
  return unit ? `${v} ${unit}` : v;
}

export function ingredientDisplay(line: IngredientLine) {
  const name = (line.name ?? "").trim() || "—";
  const weight = formatRecipeAmount(line.amounts.weight.value, line.amounts.weight.unit);
  const volume = formatRecipeAmount(line.amounts.volume.value, line.amounts.volume.unit);
  const primary = line.amounts.basis === "volume" ? (volume ?? weight) : (weight ?? volume);
  const secondary =
    line.amounts.basis === "volume"
      ? weight && weight !== primary
        ? weight
        : null
      : volume && volume !== primary
        ? volume
        : null;

  return { name, primary, secondary };
}

export function buildIngredientLines(lines: IngredientLine[], options: { secondaryOnly?: boolean } = {}) {
  return lines
    .filter((line) => !options.secondaryOnly || !line.secondary)
    .filter((line) => (line.name ?? "").trim().length > 0)
    .map((line) => ({ line, ...ingredientDisplay(line) }));
}

export function buildAdditiveLines(lines: AdditiveLine[]) {
  return lines
    .filter((line) => (line.name ?? "").trim().length > 0)
    .map((line) => ({
      line,
      name: line.name.trim(),
      amount: formatRecipeAmount(line.amount, line.unit)
    }));
}

export function getNoteText(note: NoteLine) {
  return (note.content ?? [])
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n");
}

export function buildNoteLines(notes: NoteLine[]) {
  return notes.map((note) => ({ note, text: getNoteText(note) })).filter((item) => item.text.length > 0);
}

export function StatusTile({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" }) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-2">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-sm font-medium", tone === "warn" && "text-yellow-700 dark:text-yellow-300")}>
        {value}
      </div>
    </div>
  );
}

export function WorkRow({
  title,
  detail,
  amount,
  isLogged,
  loggedLabel,
  actionLabel,
  disabled,
  disabledReason,
  onLog
}: {
  title: string;
  detail?: string | null;
  amount?: string | null;
  isLogged: boolean;
  loggedLabel: string;
  actionLabel: string;
  disabled: boolean;
  disabledReason?: string | null;
  onLog: () => Promise<void> | void;
}) {
  return (
    <li
      className={cn(
        "flex items-start justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2",
        isLogged && "opacity-70"
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium leading-tight line-clamp-2 whitespace-pre-line">{title}</div>
        {detail ? <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div> : null}
        {!isLogged && disabled && disabledReason ? (
          <div className="mt-1 text-xs text-muted-foreground">{disabledReason}</div>
        ) : null}
      </div>

      <div className="shrink-0 flex items-center gap-2">
        {amount ? <div className="text-sm text-muted-foreground">{amount}</div> : null}
        {isLogged ? (
          <div className="text-xs text-muted-foreground">{loggedLabel}</div>
        ) : (
          <Button size="sm" variant="secondary" disabled={disabled} onClick={onLog}>
            {actionLabel}
          </Button>
        )}
      </div>
    </li>
  );
}

export function WarningsPanel({
  warnings,
  defaultOpen = false
}: {
  warnings: StageWarning[];
  defaultOpen?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(defaultOpen);

  if (warnings.length === 0) return null;

  return (
    <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm font-medium"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          {t("brews.warnings", "Warnings")} · {warnings.length}
        </span>
        <span className="text-xs text-muted-foreground">{open ? t("hide", "Hide") : t("show", "Show")}</span>
      </button>
      {open ? (
        <div className="space-y-2 border-t border-yellow-500/20 px-3 py-3">
          {warnings.map((warning) => (
            <div key={warning.id} className="text-sm">
              {warning.message(t)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function StageFocusActions({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          {description ? <div className="mt-1 text-xs text-muted-foreground">{description}</div> : null}
        </div>
        <div className="flex flex-wrap gap-2">{children}</div>
      </div>
    </div>
  );
}

export function DateConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: (datetime: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [datetime, setDatetime] = React.useState<Date>(new Date());
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setDatetime(new Date());
  }, [open]);

  const confirm = async () => {
    setIsSaving(true);
    try {
      await onConfirm(datetime.toISOString());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${BREW_TRACKER_DIALOG_CONTENT_CLASS} sm:max-w-[480px]`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description ? <div className="text-sm text-muted-foreground">{description}</div> : null}
        <div className="space-y-2">
          <Label>{t("date", "Date")}</Label>
          <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
        </div>
        <DialogFooter className={BREW_TRACKER_DIALOG_FOOTER_CLASS}>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("cancel", "Cancel")}
          </Button>
          <Button onClick={confirm} disabled={isSaving}>
            {confirmLabel ?? t("save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LogRecipeNoteDialog({
  note,
  onOpenChange,
  onSave
}: {
  note: { title: string; text: string } | null;
  onOpenChange: (open: boolean) => void;
  onSave: (datetime: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [datetime, setDatetime] = React.useState<Date>(new Date());
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (note) setDatetime(new Date());
  }, [note]);

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave(datetime.toISOString());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(note)} onOpenChange={onOpenChange}>
      <DialogContent className={`${BREW_TRACKER_DIALOG_CONTENT_CLASS} sm:max-w-[520px]`}>
        <DialogHeader>
          <DialogTitle>{note?.title ?? t("brews.primary.addNote", "Add note")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {note?.text ? (
            <div className="rounded-md border border-border bg-background/40 px-3 py-2 text-sm whitespace-pre-line">
              {note.text}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>{t("date", "Date")}</Label>
            <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
          </div>
        </div>
        <DialogFooter className={BREW_TRACKER_DIALOG_FOOTER_CLASS}>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t("cancel", "Cancel")}
          </Button>
          <Button onClick={save} disabled={isSaving || !note}>
            {t("save", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
