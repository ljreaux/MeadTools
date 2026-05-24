"use client";

import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import * as React from "react";
import { useTranslation } from "react-i18next";

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
      <DialogContent className="sm:max-w-[520px]">
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
        <DialogFooter>
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
