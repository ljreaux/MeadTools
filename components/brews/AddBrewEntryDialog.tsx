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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { DateTimePicker } from "@/components/ui/datetime-picker";

import { useCreateBrewEntry } from "@/hooks/reactQuery/useCreateBrewEntry";
import type { CreateBrewEntryInput } from "@/hooks/reactQuery/useAccountBrews";
import { BREW_ENTRY_TYPE, GRAVITY_UNITS } from "@/lib/brewEnums";
import type { TempUnits } from "@/lib/brewEnums";
import { entryPayload } from "@/lib/utils/entryPayload";
import type { GravityReadingRole } from "@/lib/utils/entryPayload";
import { BREW_TRACKER_DIALOG_CONTENT_CLASS } from "@/components/brews/brewTrackerDialog";
import { getUnitLabel } from "@/components/brews/stages/additionDialogShared";
import type { GravityUnit } from "@/lib/brewEnums";
import { refractometerCorrectedSg, toBrix, toSG } from "@/lib/utils/unitConverter";
import { formatSgAsBrixDisplay, formatSgDisplay } from "@/lib/utils/gravityFormatting";
import TooltipHelper from "@/components/Tooltips";

export type EntryType =
  | typeof BREW_ENTRY_TYPE.NOTE
  | typeof BREW_ENTRY_TYPE.TASTING
  | typeof BREW_ENTRY_TYPE.ISSUE
  | typeof BREW_ENTRY_TYPE.GRAVITY
  | typeof BREW_ENTRY_TYPE.TEMPERATURE
  | typeof BREW_ENTRY_TYPE.PH;
export type OpenAddEntryArgs = {
  presetType?: EntryType;
  allowedTypes?: EntryType[];
  gravityRole?: GravityReadingRole;
  gravityDefaultValue?: number;
  gravitySource?: "measured" | "recipe";
};
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
  gravityRole,
  gravityDefaultValue,
  gravitySource = "measured",
  gravityUnitPreference = GRAVITY_UNITS.SG,
  correctionOg,
  onGravityUnitPreferenceChange,
  triggerLabel,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  hideTrigger
}: {
  brewId: string;
  allowedTypes?: EntryType[];
  defaultType?: EntryType;
  presetType?: EntryType; // open modal already set to this
  gravityRole?: GravityReadingRole;
  gravityDefaultValue?: number;
  gravitySource?: "measured" | "recipe";
  gravityUnitPreference?: GravityUnit;
  correctionOg?: number | null;
  onGravityUnitPreferenceChange?: (unit: GravityUnit) => void | Promise<void>;
  triggerLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
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

  const [openInternal, setOpenInternal] = React.useState(false);
  const open = openProp ?? openInternal;

  const setOpen = (v: boolean) => {
    onOpenChangeProp?.(v);
    if (openProp === undefined) setOpenInternal(v);
  };

  const [type, setType] = React.useState<EntryType>(initialType);

  const [title, setTitle] = React.useState<string>("");
  const [note, setNote] = React.useState<string>("");
  const [datetime, setDatetime] = React.useState<Date>(new Date());

  const [gravity, setGravity] = React.useState<string>("");
  const [gravityUnit, setGravityUnit] = React.useState<GravityUnit>(gravityUnitPreference);
  const [applyRefractometerCorrection, setApplyRefractometerCorrection] = React.useState(false);
  const [correctionFactor, setCorrectionFactor] = React.useState("1");
  const [temperature, setTemperature] = React.useState<string>("");
  const [tempUnits, setTempUnits] = React.useState<TempUnits>("F" as TempUnits);

  const [ph, setPh] = React.useState<string>("");

  const hasCorrectionOg =
    typeof correctionOg === "number" &&
    Number.isFinite(correctionOg) &&
    correctionOg > 1;
  const canApplyRefractometerCorrection =
    gravityUnit === GRAVITY_UNITS.BRIX && hasCorrectionOg;

  const formatDefaultGravity = React.useCallback(
    (value?: number) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return "";
      return gravityUnitPreference === GRAVITY_UNITS.BRIX
        ? toBrix(value).toFixed(2)
        : value.toFixed(3);
    },
    [gravityUnitPreference]
  );

  function reset() {
    setType(initialType);
    setTitle("");
    setNote("");
    setDatetime(new Date());
    setGravityUnit(gravityUnitPreference);
    setGravity(formatDefaultGravity(gravityDefaultValue));
    setApplyRefractometerCorrection(false);
    setCorrectionFactor("1");
    setTemperature("");
    setTempUnits("F" as TempUnits);
    setPh("");
  }

  React.useEffect(() => {
    if (!open) return;
    setType(initialType);
    setGravityUnit(gravityUnitPreference);
    setGravity(formatDefaultGravity(gravityDefaultValue));
    setApplyRefractometerCorrection(false);
    setCorrectionFactor("1");
  }, [formatDefaultGravity, gravityDefaultValue, gravityUnitPreference, initialType, open]);

  React.useEffect(() => {
    if (!canApplyRefractometerCorrection) {
      setApplyRefractometerCorrection(false);
    }
  }, [canApplyRefractometerCorrection]);

  const gravityPreview = React.useMemo(() => {
    if (type !== BREW_ENTRY_TYPE.GRAVITY) return null;
    const enteredValue = Number(gravity);
    if (!Number.isFinite(enteredValue)) return null;
    if (gravityUnit === GRAVITY_UNITS.SG) return enteredValue;

    if (applyRefractometerCorrection && hasCorrectionOg) {
      const factor = Number(correctionFactor);
      if (!Number.isFinite(factor) || factor <= 0) return null;
      return refractometerCorrectedSg(
        toBrix(correctionOg!),
        enteredValue,
        factor
      );
    }

    return toSG(enteredValue);
  }, [
    applyRefractometerCorrection,
    correctionFactor,
    correctionOg,
    gravity,
    gravityUnit,
    hasCorrectionOg,
    type
  ]);

  function buildInput(): CreateBrewEntryInput {
    const trimmedTitle = title.trim();
    const titleOrNull = trimmedTitle ? trimmedTitle : null;
    const trimmedNote = note.trim();
    const noteOrNull = trimmedNote ? trimmedNote : null;
    const datetimeIso = datetime.toISOString();

    // NOTE / TASTING / ISSUE
    if (
      type === BREW_ENTRY_TYPE.NOTE ||
      type === BREW_ENTRY_TYPE.TASTING ||
      type === BREW_ENTRY_TYPE.ISSUE
    ) {
      // you can use entryPayload here, or inline.
      if (type === BREW_ENTRY_TYPE.NOTE)
        return entryPayload.note(noteOrNull ?? "", titleOrNull, null, datetimeIso);
      if (type === BREW_ENTRY_TYPE.TASTING)
        return entryPayload.tasting(noteOrNull ?? "", titleOrNull ?? "Tasting", datetimeIso);
      return entryPayload.issue(noteOrNull ?? "", titleOrNull ?? "Issue", datetimeIso);
    }

    if (type === BREW_ENTRY_TYPE.GRAVITY) {
      const enteredValue = Number(gravity);
      if (!Number.isFinite(enteredValue)) throw new Error("Invalid gravity");
      const factor = Number(correctionFactor);
      if (
        gravityUnit === GRAVITY_UNITS.BRIX &&
        applyRefractometerCorrection &&
        (!Number.isFinite(factor) || factor <= 0)
      ) {
        throw new Error("Invalid correction factor");
      }
      const sg =
        gravityUnit === GRAVITY_UNITS.SG
          ? enteredValue
          : applyRefractometerCorrection && hasCorrectionOg
            ? refractometerCorrectedSg(toBrix(correctionOg!), enteredValue, factor)
            : toSG(enteredValue);
      return entryPayload.gravity(sg, noteOrNull, {
        readingRole: gravityRole ?? "GENERAL",
        source: gravitySource,
        datetime: datetimeIso,
        display: {
          enteredValue,
          enteredUnit: gravityUnit,
          convertedGravity: sg,
          refractometerCorrectionApplied:
            gravityUnit === GRAVITY_UNITS.BRIX && applyRefractometerCorrection,
          correctionFactor:
            gravityUnit === GRAVITY_UNITS.BRIX && applyRefractometerCorrection
              ? factor
              : undefined,
          ogUsed:
            gravityUnit === GRAVITY_UNITS.BRIX &&
            applyRefractometerCorrection &&
            hasCorrectionOg
              ? correctionOg!
              : undefined
        }
      });
    }

    if (type === BREW_ENTRY_TYPE.TEMPERATURE) {
      const n = Number(temperature);
      if (!Number.isFinite(n)) throw new Error("Invalid temperature");
      return entryPayload.temperature(n, tempUnits, noteOrNull, datetimeIso);
    }

    // PH
    const n = Number(ph);
    if (!Number.isFinite(n)) throw new Error("Invalid pH");

    const input: CreateBrewEntryInput = {
      type: BREW_ENTRY_TYPE.PH,
      title: titleOrNull ?? "pH reading",
      datetime: datetimeIso,
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
        description: t("error", "Something went wrong."),
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
    setType(initialType);
  }, [initialType, open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      {/* ✅ only render trigger if you want it */}
      {!hideTrigger ? (
        <DialogTrigger asChild>
          <Button>{triggerLabel ?? t("brew.addEntry", "Add entry")}</Button>
        </DialogTrigger>
      ) : null}

      <DialogContent className={`${BREW_TRACKER_DIALOG_CONTENT_CLASS} sm:max-w-[560px]`}>
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

          <div className="space-y-2">
            <Label>{t("date", "Date")}</Label>
            <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
          </div>

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
              <InputGroup className="h-12">
                <InputGroupInput
                  inputMode="decimal"
                  value={gravity}
                  onChange={(e) => setGravity(e.target.value)}
                  placeholder="1.040"
                  onFocus={(e) => e.target.select()}
                  className="h-full text-lg"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="mr-1 text-xs sm:text-sm"
                >
                  <Separator orientation="vertical" className="h-12" />
                  <Select
                    value={gravityUnit}
                    onValueChange={(value) => {
                      const nextUnit = value as GravityUnit;
                      const currentValue = Number(gravity);
                      if (Number.isFinite(currentValue) && nextUnit !== gravityUnit) {
                        setGravity(
                          nextUnit === GRAVITY_UNITS.BRIX
                            ? toBrix(currentValue).toFixed(2)
                            : toSG(currentValue).toFixed(3)
                        );
                      }
                      setGravityUnit(nextUnit);
                      void onGravityUnitPreferenceChange?.(nextUnit);
                    }}
                  >
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
              {gravityUnit === GRAVITY_UNITS.BRIX ? (
                <div className="space-y-3 rounded-md border border-border bg-background/40 p-3">
                  {canApplyRefractometerCorrection ? (
                    <div className="flex items-center justify-between gap-3">
                      <Label htmlFor="refractometer-correction" className="text-sm">
                        {t(
                          "brews.gravity.applyRefractometerCorrection",
                          "Apply refractometer correction"
                        )}
                      </Label>
                      <Switch
                        id="refractometer-correction"
                        checked={applyRefractometerCorrection}
                        onCheckedChange={setApplyRefractometerCorrection}
                      />
                    </div>
                  ) : null}

                  {applyRefractometerCorrection && canApplyRefractometerCorrection ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <Label>{t("brews.gravity.correctionFactor", "Correction factor")}</Label>
                        <TooltipHelper
                          body={t("tiptext.refractometerWarning")}
                          link="https://www.brewersfriend.com/how-to-determine-your-refractometers-wort-correction-factor/"
                          variant={correctionFactor !== "1" ? "warning" : "muted"}
                        />
                      </div>
                      <Input
                        inputMode="decimal"
                        value={correctionFactor}
                        onChange={(event) => setCorrectionFactor(event.target.value)}
                      />
                      <div className="text-xs text-muted-foreground">
                        {t("brews.gravity.correctionOg", "OG: {{og}}", {
                          og: formatSgDisplay(correctionOg, undefined)
                        })}
                      </div>
                    </div>
                  ) : null}

                  {gravityPreview != null ? (
                    <div className="text-sm text-muted-foreground">
                      {applyRefractometerCorrection && canApplyRefractometerCorrection
                        ? t("brews.gravity.correctedSgPreview", "Corrected SG: {{sg}}", {
                            sg: formatSgDisplay(gravityPreview, undefined)
                          })
                        : t("brews.gravity.convertedSgPreview", "Converted SG: {{sg}}", {
                            sg: formatSgDisplay(gravityPreview, undefined)
                          })}
                    </div>
                  ) : null}

                  {gravityPreview != null ? (
                    <div className="text-xs text-muted-foreground">
                      {formatSgAsBrixDisplay(gravityPreview, t("BRIX"), undefined)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {showTemp && (
            <div className="space-y-2">
              <Label>{t("brew.temperature", "Temperature")}</Label>
              <InputGroup className="h-12">
                <InputGroupInput
                  inputMode="decimal"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="70"
                  onFocus={(e) => e.target.select()}
                  className="h-full text-lg"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1"
                >
                  <Separator orientation="vertical" className="h-12" />
                <Select
                  value={String(tempUnits)}
                  onValueChange={(v) => setTempUnits(v as TempUnits)}
                >
                  <SelectTrigger className="p-2 border-none mr-2 w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">{getUnitLabel(t, "F")}</SelectItem>
                    <SelectItem value="C">{getUnitLabel(t, "C")}</SelectItem>
                  </SelectContent>
                </Select>
                </InputGroupAddon>
              </InputGroup>
            </div>
          )}

          {showPh && (
            <div className="space-y-2">
              <Label>{t("brew.ph", "pH")}</Label>
              <InputGroup className="h-12">
                <InputGroupInput
                  inputMode="decimal"
                  value={ph}
                  onChange={(e) => setPh(e.target.value)}
                  placeholder="3.40"
                  onFocus={(e) => e.target.select()}
                  className="h-full text-lg"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="mr-1 text-xs sm:text-sm"
                >
                  <InputGroupText>pH</InputGroupText>
                </InputGroupAddon>
              </InputGroup>
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

          <div className="flex justify-end gap-3 pt-2">
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
