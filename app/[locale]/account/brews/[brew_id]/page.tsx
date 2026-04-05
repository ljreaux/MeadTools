"use client";

import type { ComponentProps, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Check, Pencil, PencilOff, Scale } from "lucide-react";

import {
  useAccountBrew,
  usePatchAccountBrewMetadata
} from "@/hooks/reactQuery/useAccountBrews";

import { Skeleton } from "@/components/ui/skeleton";

import { toast } from "@/hooks/use-toast";

import AddBrewEntryDialog, {
  EntryType,
  OpenAddEntryArgs
} from "@/components/brews/AddBrewEntryDialog";
import { RecordVolumeDialog } from "@/components/brews/RecordVolumeDialog";
import { useRecipe } from "@/components/providers/RecipeProvider";
import { BrewStagePath } from "@/components/brews/BrewStagePath";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from "@/components/ui/input-group";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import { BrewAdditionData, entryPayload } from "@/lib/utils/entryPayload";
import { useCreateBrewEntry } from "@/hooks/reactQuery/useCreateBrewEntry";
import { L_TO_VOLUME } from "@/lib/utils/recipeDataCalculations";
import { normalizeNumberString } from "@/lib/utils/validateInput";

type HeaderVolumeUnit = "gal" | "L";

export default function BrewPageClient() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ brew_id: string }>();
  const brewId = params?.brew_id;

  const { data: brew, isLoading, isError, error } = useAccountBrew(brewId);
  const { mutateAsync: patchMeta } = usePatchAccountBrewMetadata();
  const [nameEditable, setNameEditable] = useState(false);
  const [batchEditable, setBatchEditable] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [batchValue, setBatchValue] = useState("");
  const [startValue, setStartValue] = useState("");
  const [startDateDialogOpen, setStartDateDialogOpen] = useState(false);
  const [recordVolumeOpen, setRecordVolumeOpen] = useState(false);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage, {
        dateStyle: "short",
        timeStyle: "short"
      }),
    [i18n.resolvedLanguage]
  );

  const formatDate = (d?: string | null) =>
    d ? formatter.format(new Date(d)) : "—";

  useEffect(() => {
    if (!brew) return;
    setNameValue(brew.name ?? "");
    setBatchValue(brew.batch_number != null ? String(brew.batch_number) : "");
    setStartValue(toDateTimeLocalValue(brew.start_date));
  }, [brew]);

  const [preferredVolumeUnit, setPreferredVolumeUnit] =
    useState<HeaderVolumeUnit>("gal");

  useEffect(() => {
    try {
      const storedUnits = localStorage.getItem("units");
      setPreferredVolumeUnit(storedUnits === "METRIC" ? "L" : "gal");
    } catch {
      setPreferredVolumeUnit("gal");
    }
  }, []);

  const formatVolume = (liters?: number | null) => {
    if (typeof liters !== "number" || !Number.isFinite(liters) || liters <= 0) {
      return "—";
    }

    const converted = liters * L_TO_VOLUME[preferredVolumeUnit];
    return `${normalizeNumberString(converted, 2, i18n.resolvedLanguage)} ${preferredVolumeUnit}`;
  };

  const formatGravity = (gravity?: number | null) => {
    if (typeof gravity !== "number" || !Number.isFinite(gravity)) {
      return "—";
    }

    return normalizeNumberString(gravity, 3, i18n.resolvedLanguage, true);
  };

  const formatAbv = (value?: number | null) => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return "—";
    }

    return `${normalizeNumberString(value, 2, i18n.resolvedLanguage)}%`;
  };

  const formatTemperature = (value?: number | null, units?: string | null) => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return "—";
    }

    const decimals = units === "C" ? 1 : 1;
    const suffix = units ? `°${units}` : "";
    return `${normalizeNumberString(value, decimals, i18n.resolvedLanguage)}${suffix}`;
  };

  const formatStageLabel = (stage?: string | null) => {
    if (!stage) return "—";
    return t(`brewStage.${stage}`, stage);
  };

  const {
    derived: { ogPrimary, backsweetenedFg, abv, primaryVolumeL, totalVolumeL },
    meta: { hydrate }
  } = useRecipe();

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryPresetType, setEntryPresetType] = useState<
    EntryType | undefined
  >();
  const [entryAllowedTypes, setEntryAllowedTypes] = useState<
    EntryType[] | undefined
  >();

  function openAddEntry(args?: OpenAddEntryArgs) {
    setEntryPresetType(args?.presetType);
    setEntryAllowedTypes(args?.allowedTypes);
    setEntryOpen(true);
  }

  const allEntries = useMemo(() => {
    const buckets = brew?.entries_by_stage ?? [];
    return buckets.flatMap((b) => b.entries);
  }, [brew?.entries_by_stage]);

  const latestGravityEntry = useMemo(() => {
    const entries = brew?.entries ?? [];

    return entries
      .filter(
        (entry) =>
          typeof entry.gravity === "number" && Number.isFinite(entry.gravity)
      )
      .sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
      )[0];
  }, [brew?.entries]);

  const latestEntry = useMemo(() => {
    const entries = brew?.entries ?? [];

    return entries
      .slice()
      .sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
      )[0];
  }, [brew?.entries]);

  const currentStageStartedAt = useMemo(() => {
    const entries = brew?.entries ?? [];

    const stageChangeIntoCurrent = entries
      .filter(
        (entry) =>
          entry.type === BREW_ENTRY_TYPE.STAGE_CHANGE &&
          (entry.data as any)?.to === brew?.stage
      )
      .sort(
        (a, b) =>
          new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
      )[0];

    return stageChangeIntoCurrent?.datetime ?? brew?.start_date ?? null;
  }, [brew?.entries, brew?.stage, brew?.start_date]);

  const daysInCurrentStage = useMemo(() => {
    if (!currentStageStartedAt) return null;

    const startedAt = new Date(currentStageStartedAt).getTime();
    if (Number.isNaN(startedAt)) return null;

    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs < 0) return 0;

    return Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  }, [currentStageStartedAt]);

  const displayLatestGravity = brew?.latest_gravity ?? latestGravityEntry?.gravity;
  const displayEstimatedOg =
    typeof ogPrimary === "number" && Number.isFinite(ogPrimary) && ogPrimary > 1
      ? ogPrimary
      : null;
  const displayEstimatedFg =
    typeof backsweetenedFg === "number" &&
    Number.isFinite(backsweetenedFg) &&
    backsweetenedFg > 0
      ? backsweetenedFg
      : null;
  const displayEstimatedAbv =
    typeof abv === "number" && Number.isFinite(abv) && abv >= 0 ? abv : null;
  const displayTargetVolume =
    typeof totalVolumeL === "number" &&
    Number.isFinite(totalVolumeL) &&
    totalVolumeL > 0
      ? totalVolumeL
      : null;
  const displayPrimaryVolume =
    typeof primaryVolumeL === "number" &&
    Number.isFinite(primaryVolumeL) &&
    primaryVolumeL > 0
      ? primaryVolumeL
      : null;

  const recipeSummaryItems = [
    {
      label: t("recipeBuilder.resultsLabels.estOG"),
      value: formatGravity(displayEstimatedOg)
    },
    {
      label: t("recipeBuilder.resultsLabels.estFG"),
      value: formatGravity(displayEstimatedFg)
    },
    {
      label: t("recipeBuilder.resultsLabels.abv"),
      value: formatAbv(displayEstimatedAbv)
    },
    {
      label: t("recipeBuilder.resultsLabels.totalPrimary"),
      value: formatVolume(displayPrimaryVolume)
    },
    {
      label: t("recipeBuilder.resultsLabels.totalSecondary"),
      value: formatVolume(displayTargetVolume)
    }
  ];

  const batchSummaryItems = [
    {
      label: t("iSpindelDashboard.brews.latestGrav", "Latest gravity"),
      value: formatGravity(displayLatestGravity)
    },
    {
      label: t("entries", "Entries"),
      value: String(brew?.entry_count ?? 0)
    },
    {
      label: t("lastUpdated", "Last updated"),
      value: latestEntry ? formatDate(latestEntry.datetime) : "—"
    },
    {
      label: t("brews.daysInStage", "Days in current stage"),
      value:
        typeof daysInCurrentStage === "number"
          ? normalizeNumberString(daysInCurrentStage, 0, i18n.resolvedLanguage, true)
          : "—"
    }
  ].filter(Boolean);

  if (brew?.end_date) {
    batchSummaryItems.splice(0, 0, {
      label: t("end", "End"),
      value: formatDate(brew.end_date)
    });
  }

  async function saveMetadata(input: Parameters<typeof patchMeta>[0]["input"]) {
    try {
      await patchMeta({ brewId: brew!.id, input });
      toast({ description: t("saved", "Saved.") });
    } catch (err) {
      console.error("Error updating brew metadata:", err);
      toast({
        description: t("error.generic", "Something went wrong."),
        variant: "destructive"
      });
      throw err;
    }
  }

  async function saveName() {
    if (!brew) return;
    await saveMetadata({ name: nameValue.trim() || null });
    setNameEditable(false);
  }

  async function saveBatchNumber() {
    if (!brew) return;
    const trimmed = batchValue.trim();
    if (trimmed && (!Number.isInteger(Number(trimmed)) || Number(trimmed) < 1)) {
      toast({
        description: t("error.generic", "Something went wrong."),
        variant: "destructive"
      });
      return;
    }

    await saveMetadata({
      batch_number: trimmed ? Number(trimmed) : null
    });
    setBatchEditable(false);
  }

  async function saveStartDate() {
    if (!brew || !startValue) return;
    const date = new Date(startValue);

    if (Number.isNaN(date.getTime())) {
      toast({
        description: t("error.generic", "Something went wrong."),
        variant: "destructive"
      });
      return;
    }

    await saveMetadata({ start_date: date.toISOString() });
    setStartDateDialogOpen(false);
  }

  useEffect(() => {
    if (brew?.recipe_snapshot?.dataV2) {
      hydrate(brew.recipe_snapshot.dataV2);
    }
  }, [brew, hydrate]);
  const { mutateAsync: createEntry } = useCreateBrewEntry();
  async function addAddition(input: {
    name: string;
    recipeIngredientId?: string;
    amount?: number;
    unit?: string;
    note?: string;
  }) {
    await createEntry({
      brewId: brew!.id,
      input: entryPayload.addition({
        name: input.name,
        recipeIngredientId: input.recipeIngredientId,
        amount: input.amount,
        unit: input.unit,
        note: input.note ?? null
      })
    });
  }

  async function addAdditions(
    inputs: Array<{
      name: string;
      recipeIngredientId?: string;
      amount?: number;
      unit?: string;
      note?: string;
    }>
  ) {
    // simplest approach: fire sequentially so you don’t DDOS your own API
    for (const x of inputs) {
      await addAddition(x);
    }
  }

  if (isLoading) return <BrewPageSkeleton />;

  if (isError || !brew) {
    console.error(error);
    return (
      <div className="text-center my-4">
        {t("error.generic", "Something went wrong loading this brew.")}
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:mt-6 mt-12">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <InputGroup className="h-12 min-w-[280px] flex-1">
                <InputGroupInput
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  disabled={!nameEditable}
                  placeholder={brew.id}
                  className="h-11 text-xl"
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    title={
                      nameEditable
                        ? t("disableEdit", "Disable editing")
                        : t("edit", "Edit")
                    }
                    onClick={() => {
                      if (nameEditable) {
                        void saveName();
                      }
                      setNameEditable(!nameEditable);
                    }}
                    className="h-full"
                  >
                    {nameEditable ? <Pencil /> : <PencilOff />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <span className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-sm text-muted-foreground">
                {t(`brewStage.${brew.stage}`, brew.stage)}
              </span>
            </div>

            <div className="text-sm text-muted-foreground">
              {brew.recipe_id ? (
                <span>
                  {t("brews.recipe", "Recipe")}:{" "}
                  <Link className="text-foreground underline" href={`/recipes/${brew.recipe_id}`}>
                    {brew.recipe_name ?? t("recipe", "Recipe")}
                  </Link>
                </span>
              ) : (
                t("noRecipe", "No recipe linked.")
              )}
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-border/70 bg-background/40 p-4 space-y-3">
            <h2 className="text-sm font-semibold">{t("brews.label", "Batch")}</h2>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              <ActionInputSummaryField
                label={t("batchNumber", "Batch")}
                editable={batchEditable}
                displayValue={
                  brew.batch_number != null ? `#${String(brew.batch_number)}` : "—"
                }
                inputValue={batchValue}
                onInputChange={setBatchValue}
                onSave={saveBatchNumber}
                onToggle={() => {
                  if (batchEditable) {
                    setBatchValue(
                      brew.batch_number != null ? String(brew.batch_number) : ""
                    );
                  }
                  setBatchEditable(!batchEditable);
                }}
                inputProps={{
                  inputMode: "numeric",
                  placeholder: "1",
                  onFocus: (e) => e.target.select()
                }}
              />
              <ActionSummaryField
                label={t("start", "Start")}
                displayValue={formatDate(brew.start_date)}
                onEdit={() => {
                  setStartValue(toDateTimeLocalValue(brew.start_date));
                  setStartDateDialogOpen(true);
                }}
              />
              <SummaryField
                label={t("brews.primary.currentVolume", "Current volume")}
                value={formatVolume(brew.current_volume_liters)}
                action={
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setRecordVolumeOpen(true)}
                    title={t("brews.primary.setVolume", "Record current volume")}
                  >
                    <Scale />
                  </Button>
                }
              />
              {batchSummaryItems.map((item) => (
                item.label === t("iSpindelDashboard.brews.latestGrav", "Latest gravity") ? (
                  <SummaryField
                    key={item.label}
                    label={item.label}
                    value={item.value}
                    action={
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          openAddEntry({
                            presetType: BREW_ENTRY_TYPE.GRAVITY as EntryType,
                            allowedTypes: [BREW_ENTRY_TYPE.GRAVITY as EntryType]
                          })
                        }
                        title={t("brew.addGravity", "Add gravity reading")}
                      >
                        <Scale />
                      </Button>
                    }
                  />
                ) : (
                  <div
                    key={item.label}
                    className="border-b border-border/60 py-2"
                  >
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      {item.label}
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">
                      {item.value}
                    </dd>
                  </div>
                )
              ))}
              <SummaryField
                label={t("emailAlerts.title", "Email alerts")}
                value={
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {brew.requested_email_alerts
                        ? t("on", "On")
                        : t("off", "Off")}
                    </span>
                    <Switch
                      checked={brew.requested_email_alerts}
                      onCheckedChange={async (checked) => {
                        await saveMetadata({
                          requested_email_alerts: checked
                        });
                      }}
                    />
                  </div>
                }
              />
            </dl>
          </section>

          <section className="rounded-lg border border-border/70 bg-background/40 p-4 space-y-3">
            <h2 className="text-sm font-semibold">{t("recipe", "Recipe")}</h2>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {recipeSummaryItems.map((item) => (
                <div
                  key={item.label}
                  className="border-b border-border/60 py-2"
                >
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <BrewStagePath
        stage={brew.stage}
        entries={allEntries}
        onMoveToStage={async (to) => {
          await saveMetadata({ stage: to });
        }}
        openAddEntry={openAddEntry}
        addAddition={addAddition}
        addAdditions={addAdditions}
        current_volume_liters={brew.current_volume_liters}
        patchBrewMetadata={async (input) => {
          await saveMetadata(input);
        }}
        hasRecipeLinked={Boolean(brew.recipe_id)}
      />
      <RecordVolumeDialog
        t={t}
        open={recordVolumeOpen}
        onOpenChange={setRecordVolumeOpen}
        currentVolumeLiters={brew.current_volume_liters}
        onSave={(volume) => saveMetadata({ current_volume_liters: volume })}
      />
      <Dialog
        open={startDateDialogOpen}
        onOpenChange={setStartDateDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("start", "Start")}</DialogTitle>
          </DialogHeader>
          <DateTimePicker
            value={startValue ? new Date(startValue) : new Date(brew.start_date)}
            onChange={(value) =>
              setStartValue(value ? toDateTimeLocalValue(value.toISOString()) : "")
            }
            hourCycle={12}
          />
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setStartValue(toDateTimeLocalValue(brew.start_date));
                setStartDateDialogOpen(false);
              }}
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button onClick={saveStartDate}>{t("save", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AddBrewEntryDialog
        brewId={brew.id}
        open={entryOpen}
        onOpenChange={setEntryOpen}
        presetType={entryPresetType}
        allowedTypes={entryAllowedTypes}
        hideTrigger
      />
      {/* Timeline by stage */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{t("timeline", "Timeline")}</h2>

          <Button
            onClick={() =>
              openAddEntry({
                allowedTypes: [
                  BREW_ENTRY_TYPE.NOTE,
                  BREW_ENTRY_TYPE.TASTING,
                  BREW_ENTRY_TYPE.ISSUE,
                  BREW_ENTRY_TYPE.GRAVITY,
                  BREW_ENTRY_TYPE.TEMPERATURE,
                  BREW_ENTRY_TYPE.PH
                ] as EntryType[]
              })
            }
          >
            {t("brew.addEntry", "Add entry")}
          </Button>
        </div>

        {brew.entries_by_stage?.length ? (
          brew.entries_by_stage.map((bucket) => (
            <div
              key={bucket.stage}
              className="rounded-xl border border-border bg-card"
            >
              <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                <div className="font-medium">{formatStageLabel(bucket.stage)}</div>
                <div className="text-sm text-muted-foreground">
                  {bucket.entries.length}
                </div>
              </div>

              <div className="p-5 space-y-3">
                {bucket.entries.map((e) => (
                  <div
                    key={e.id}
                    className="rounded-lg border border-border p-4 space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{e.title ?? e.type}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDate(e.datetime)}
                      </div>
                    </div>

                    {e.note ? <div className="text-sm">{e.note}</div> : null}

                    <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                      {e.gravity != null ? (
                        <span>SG: {formatGravity(e.gravity)}</span>
                      ) : null}
                      {e.temperature != null ? (
                        <span>
                          Temp: {formatTemperature(e.temperature, e.temp_units)}
                        </span>
                      ) : null}
                      {e.type === BREW_ENTRY_TYPE.PH &&
                      typeof (e.data as any)?.ph === "number" ? (
                        <span>
                          pH:{" "}
                          {normalizeNumberString(
                            Number((e.data as any).ph),
                            2,
                            i18n.resolvedLanguage
                          )}
                        </span>
                      ) : null}
                      {e.type === "STAGE_CHANGE" && e.data ? (
                        <span>
                          {formatStageLabel(String((e.data as any)?.from ?? ""))}{" "}
                          → {formatStageLabel(String((e.data as any)?.to ?? ""))}
                        </span>
                      ) : null}
                      {e.type === BREW_ENTRY_TYPE.ADDITION && e.data
                        ? (() => {
                            const d = e.data as Partial<BrewAdditionData>;
                            return (
                              <span>
                                {d.name}
                                {d.amount != null
                                  ? `: ${normalizeNumberString(
                                      Number(d.amount),
                                      2,
                                      i18n.resolvedLanguage
                                    )}`
                                  : ""}
                                {d.unit ? ` ${d.unit}` : ""}
                              </span>
                            );
                          })()
                        : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-muted-foreground">
            {t("noEntries", "No entries yet.")}
          </div>
        )}
      </div>
    </div>
  );
}

function BrewPageSkeleton() {
  return (
    <div className="space-y-6 sm:mt-6 mt-12">
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <Skeleton className="h-7 w-[280px]" />
        <Skeleton className="h-4 w-full max-w-[520px]" />
        <Skeleton className="h-4 w-full max-w-[420px]" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-6 w-[160px]" />
        <div className="rounded-xl border border-border bg-card p-6 space-y-3">
          <Skeleton className="h-5 w-[120px]" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full max-w-[520px]" />
        </div>
      </div>
    </div>
  );
}

function SummaryField({
  label,
  value,
  action
}: {
  label: string;
  value: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-b border-border/60 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-medium text-foreground">{value}</div>
          {action}
        </div>
      </dd>
    </div>
  );
}

function ActionInputSummaryField({
  label,
  editable,
  displayValue,
  inputValue,
  onInputChange,
  onSave,
  onToggle,
  inputProps
}: {
  label: string;
  editable: boolean;
  displayValue: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSave: () => Promise<void>;
  onToggle: () => void;
  inputProps?: ComponentProps<typeof InputGroupInput>;
}) {
  return (
    <div className="border-b border-border/60 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1">
        <InputGroup className="h-10">
          <InputGroupInput
            {...inputProps}
            value={editable ? inputValue : displayValue}
            onChange={(e) => {
              if (!editable) return;
              onInputChange(e.target.value);
            }}
            disabled={!editable}
            className="h-full text-sm font-medium"
          />
          <InputGroupAddon align="inline-end">
            {editable ? (
              <InputGroupButton size="icon-xs" onClick={onSave}>
                <Check />
              </InputGroupButton>
            ) : null}
            <InputGroupButton size="icon-xs" onClick={onToggle}>
              {editable ? <PencilOff /> : <Pencil />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </dd>
    </div>
  );
}

function ActionSummaryField({
  label,
  displayValue,
  onEdit
}: {
  label: string;
  displayValue: string;
  onEdit: () => void;
}) {
  return (
    <div className="border-b border-border/60 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">
            {displayValue}
          </span>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit}>
            <Pencil />
          </Button>
        </div>
      </dd>
    </div>
  );
}

function toDateTimeLocalValue(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}
