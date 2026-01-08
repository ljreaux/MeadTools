"use client";

import * as React from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";

import { useCreateBrewEntry } from "@/hooks/reactQuery/useCreateBrewEntry";
import type { CreateBrewEntryInput } from "@/hooks/reactQuery/useAccountBrews";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import type { TempUnits } from "@/lib/brewEnums";
import { entryPayload } from "@/lib/utils/entryPayload";

type EntryType =
  | typeof BREW_ENTRY_TYPE.NOTE
  | typeof BREW_ENTRY_TYPE.TASTING
  | typeof BREW_ENTRY_TYPE.ISSUE
  | typeof BREW_ENTRY_TYPE.GRAVITY
  | typeof BREW_ENTRY_TYPE.TEMPERATURE
  | typeof BREW_ENTRY_TYPE.PH;

const ALL_ENTRY_TYPES: Array<{ value: EntryType; label: string }> = [
  { value: BREW_ENTRY_TYPE.NOTE, label: "Note" },
  { value: BREW_ENTRY_TYPE.TASTING, label: "Tasting" },
  { value: BREW_ENTRY_TYPE.ISSUE, label: "Issue" },
  { value: BREW_ENTRY_TYPE.GRAVITY, label: "Gravity" },
  { value: BREW_ENTRY_TYPE.TEMPERATURE, label: "Temperature" },
  { value: BREW_ENTRY_TYPE.PH, label: "pH" }
];

export default function AddBrewEntryDialog({
  brewId,
  allowedTypes,
  defaultType,
  presetType,
  triggerLabel
}: {
  brewId: string;
  allowedTypes?: EntryType[];
  defaultType?: EntryType;
  presetType?: EntryType; // open modal already set to this
  triggerLabel?: string;
}) {
  const options = React.useMemo(() => {
    const allow = allowedTypes?.length ? new Set(allowedTypes) : null;
    return allow
      ? ALL_ENTRY_TYPES.filter((o) => allow.has(o.value))
      : ALL_ENTRY_TYPES;
  }, [allowedTypes]);

  const initialType =
    presetType ?? defaultType ?? options[0]?.value ?? BREW_ENTRY_TYPE.NOTE;
  const { t } = useTranslation();
  const { mutateAsync, isPending } = useCreateBrewEntry();

  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<EntryType>(initialType);

  const [title, setTitle] = React.useState<string>("");
  const [note, setNote] = React.useState<string>("");

  const [gravity, setGravity] = React.useState<string>("");
  const [temperature, setTemperature] = React.useState<string>("");
  const [tempUnits, setTempUnits] = React.useState<TempUnits>("F" as TempUnits);

  const [ph, setPh] = React.useState<string>("");

  function reset() {
    setType(initialType);
    setTitle("");
    setNote("");
    setGravity("");
    setTemperature("");
    setTempUnits("F" as TempUnits);
    setPh("");
  }

  function buildInput(): CreateBrewEntryInput {
    const trimmedTitle = title.trim();
    const titleOrNull = trimmedTitle ? trimmedTitle : null;
    const trimmedNote = note.trim();
    const noteOrNull = trimmedNote ? trimmedNote : null;

    // NOTE / TASTING / ISSUE
    if (
      type === BREW_ENTRY_TYPE.NOTE ||
      type === BREW_ENTRY_TYPE.TASTING ||
      type === BREW_ENTRY_TYPE.ISSUE
    ) {
      // you can use entryPayload here, or inline.
      if (type === BREW_ENTRY_TYPE.NOTE)
        return entryPayload.note(noteOrNull ?? "", titleOrNull);
      if (type === BREW_ENTRY_TYPE.TASTING)
        return entryPayload.tasting(noteOrNull ?? "", titleOrNull ?? "Tasting");
      return entryPayload.issue(noteOrNull ?? "", titleOrNull ?? "Issue");
    }

    if (type === BREW_ENTRY_TYPE.GRAVITY) {
      const n = Number(gravity);
      if (!Number.isFinite(n)) throw new Error("Invalid gravity");
      return entryPayload.gravity(n, noteOrNull);
    }

    if (type === BREW_ENTRY_TYPE.TEMPERATURE) {
      const n = Number(temperature);
      if (!Number.isFinite(n)) throw new Error("Invalid temperature");
      return entryPayload.temperature(n, tempUnits, noteOrNull);
    }

    // PH
    const n = Number(ph);
    if (!Number.isFinite(n)) throw new Error("Invalid pH");

    const input: CreateBrewEntryInput = {
      type: BREW_ENTRY_TYPE.PH,
      title: titleOrNull ?? "pH reading",
      note: noteOrNull,
      data: { ph: n }
    };
    return input;
  }

  async function onSubmit() {
    try {
      const input = buildInput();
      await mutateAsync({ brewId, input });
      toast({ description: t("saved", "Saved.") });
      setOpen(false);
      reset();
    } catch (err) {
      console.error(err);
      toast({
        description: t("error.generic", "Something went wrong."),
        variant: "destructive"
      });
    }
  }

  const showTitle =
    type === BREW_ENTRY_TYPE.NOTE || type === BREW_ENTRY_TYPE.PH;
  const showNote = true;
  const showGravity = type === BREW_ENTRY_TYPE.GRAVITY;
  const showTemp = type === BREW_ENTRY_TYPE.TEMPERATURE;
  const showPh = type === BREW_ENTRY_TYPE.PH;

  React.useEffect(() => {
    if (!open) setType(initialType);
  }, [initialType, open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>{triggerLabel ?? t("brew.addEntry", "Add entry")}</Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("brew.addEntry", "Add entry")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {options.length > 1 && (
            <div className="space-y-2">
              <Label>{t("type", "Type")}</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as EntryType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showTitle && (
            <div className="space-y-2">
              <Label>{t("title", "Title")}</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("optional", "Optional")}
              />
            </div>
          )}

          {showGravity && (
            <div className="space-y-2">
              <Label>{t("brew.gravity", "Gravity")}</Label>
              <Input
                inputMode="decimal"
                value={gravity}
                onChange={(e) => setGravity(e.target.value)}
                placeholder="1.040"
              />
            </div>
          )}

          {showTemp && (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
              <div className="space-y-2">
                <Label>{t("brew.temperature", "Temperature")}</Label>
                <Input
                  inputMode="decimal"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="70"
                />
              </div>

              <div className="space-y-2">
                <Label>{t("units", "Units")}</Label>
                <Select
                  value={String(tempUnits)}
                  onValueChange={(v) => setTempUnits(v as TempUnits)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">F</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {showPh && (
            <div className="space-y-2">
              <Label>{t("brew.ph", "pH")}</Label>
              <Input
                inputMode="decimal"
                value={ph}
                onChange={(e) => setPh(e.target.value)}
                placeholder="3.40"
              />
            </div>
          )}

          {showNote && (
            <div className="space-y-2">
              <Label>{t("note", "Note")}</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("optional", "Optional")}
                rows={4}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={isPending}
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button type="button" onClick={onSubmit} disabled={isPending}>
              {t("save", "Save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
