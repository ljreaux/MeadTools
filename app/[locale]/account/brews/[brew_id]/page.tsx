"use client";

import type { ComponentProps, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Check, Pencil, PencilOff, Scale } from "lucide-react";

import { CreateBrewEntryInput, useAccountBrew, usePatchAccountBrewMetadata } from "@/hooks/reactQuery/useAccountBrews";

import { Skeleton } from "@/components/ui/skeleton";

import { toast } from "@/hooks/use-toast";

import AddBrewEntryDialog, { EntryType, OpenAddEntryArgs } from "@/components/brews/AddBrewEntryDialog";
import { RecordVolumeDialog } from "@/components/brews/RecordVolumeDialog";
import { useRecipe } from "@/components/providers/RecipeProvider";
import { BrewStagePath } from "@/components/brews/BrewStagePath";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import { BrewAdditionData, GravityReadingRole, entryPayload } from "@/lib/utils/entryPayload";
import { useCreateBrewEntry } from "@/hooks/reactQuery/useCreateBrewEntry";
import { L_TO_VOLUME } from "@/lib/utils/recipeDataCalculations";
import { calcABV } from "@/lib/utils/unitConverter";
import { normalizeNumberString, parseNumber } from "@/lib/utils/validateInput";
import { buildBrewRecipeStageData } from "@/lib/utils/buildBrewRecipeStageData";

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

  const formatDate = (d?: string | null) => (d ? formatter.format(new Date(d)) : "—");

  useEffect(() => {
    if (!brew) return;
    setNameValue(brew.name ?? "");
    setBatchValue(brew.batch_number != null ? String(brew.batch_number) : "");
    setStartValue(toDateTimeLocalValue(brew.start_date));
  }, [brew]);

  const [preferredVolumeUnit, setPreferredVolumeUnit] = useState<HeaderVolumeUnit>("gal");

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
    meta: { hydrate, reset }
  } = useRecipe();

  const brewRecipe = useMemo(
    () =>
      buildBrewRecipeStageData({
        recipeSnapshot: brew?.recipe_snapshot,
        currentVolumeLiters: brew?.current_volume_liters,
        latestGravity: brew?.latest_gravity,
        entries: brew?.entries
      }),
    [brew?.recipe_snapshot, brew?.current_volume_liters, brew?.latest_gravity, brew?.entries]
  );

  const [entryOpen, setEntryOpen] = useState(false);
  const [entryPresetType, setEntryPresetType] = useState<EntryType | undefined>();
  const [entryAllowedTypes, setEntryAllowedTypes] = useState<EntryType[] | undefined>();
  const [entryGravityRole, setEntryGravityRole] = useState<GravityReadingRole | undefined>();
  const [entryGravityDefaultValue, setEntryGravityDefaultValue] = useState<number | undefined>();
  const [entryGravitySource, setEntryGravitySource] = useState<"measured" | "recipe" | undefined>();

  function openAddEntry(args?: OpenAddEntryArgs) {
    setEntryPresetType(args?.presetType);
    setEntryAllowedTypes(args?.allowedTypes);
    setEntryGravityRole(args?.gravityRole);
    setEntryGravityDefaultValue(args?.gravityDefaultValue);
    setEntryGravitySource(args?.gravitySource);
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
          typeof entry.gravity === "number" &&
          Number.isFinite(entry.gravity) &&
          !(entry.data as any)?.hidden &&
          (entry.data as any)?.source !== "nutrient_basis"
      )
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0];
  }, [brew?.entries]);

  const latestEntry = useMemo(() => {
    const entries = brew?.entries ?? [];

    return entries
      .filter((entry) => !(entry.data as any)?.hidden)
      .sort((a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime())[0];
  }, [brew?.entries]);

  const displayLatestGravity = brew?.latest_gravity ?? latestGravityEntry?.gravity;
  const displayActualOg = brewRecipe.actual.originalGravity?.gravity ?? null;
  const displayActualFg = brewRecipe.actual.finalGravity?.gravity ?? null;
  const displayRawActualAbv =
    typeof displayActualOg === "number" &&
    Number.isFinite(displayActualOg) &&
    typeof displayActualFg === "number" &&
    Number.isFinite(displayActualFg)
      ? calcABV(displayActualOg, displayActualFg)
      : null;
  const displayActualAbv =
    typeof brewRecipe.actual.currentAbv === "number" && Number.isFinite(brewRecipe.actual.currentAbv)
      ? brewRecipe.actual.currentAbv
      : displayRawActualAbv;
  const displayEstimatedOg =
    typeof brewRecipe.derived?.gravity.ogPrimary === "number" &&
    Number.isFinite(brewRecipe.derived.gravity.ogPrimary) &&
    brewRecipe.derived.gravity.ogPrimary > 1
      ? brewRecipe.derived.gravity.ogPrimary
      : null;
  const estimatedFg = parseNumber(brewRecipe.recipeData?.fg ?? "");
  const displayEstimatedFg = Number.isFinite(estimatedFg) && estimatedFg > 0 ? estimatedFg : null;
  const displayEstimatedAbv =
    typeof brewRecipe.derived?.alcohol.abv === "number" &&
    Number.isFinite(brewRecipe.derived.alcohol.abv) &&
    brewRecipe.derived.alcohol.abv >= 0
      ? brewRecipe.derived.alcohol.abv
      : null;
  const displayTargetVolume =
    typeof brewRecipe.derived?.volume.totalL === "number" &&
    Number.isFinite(brewRecipe.derived.volume.totalL) &&
    brewRecipe.derived.volume.totalL > 0
      ? brewRecipe.derived.volume.totalL
      : null;
  const displayPrimaryVolume =
    typeof brewRecipe.derived?.volume.primaryL === "number" &&
    Number.isFinite(brewRecipe.derived.volume.primaryL) &&
    brewRecipe.derived.volume.primaryL > 0
      ? brewRecipe.derived.volume.primaryL
      : null;
  const recordVolumeCurrentLiters =
    brew?.current_volume_liters ??
    (brew?.stage === "PRIMARY" ? displayPrimaryVolume : brewRecipe.effective.currentVolumeL);
  const displaySecondaryVolume =
    typeof brewRecipe.derived?.volume.secondaryL === "number" &&
    Number.isFinite(brewRecipe.derived.volume.secondaryL) &&
    brewRecipe.derived.volume.secondaryL > 0
      ? brewRecipe.derived.volume.secondaryL
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
      label: t("brews.recipe.targetVolume", "Target volume"),
      value: formatVolume(displayTargetVolume)
    },
    {
      label: t("recipeBuilder.resultsLabels.totalPrimary"),
      value: formatVolume(displayPrimaryVolume)
    },
    {
      label: t("recipeBuilder.resultsLabels.totalSecondary"),
      value: formatVolume(displaySecondaryVolume)
    }
  ];

  const batchSummaryItems = [
    {
      label: t("brews.actualOg", "Actual OG"),
      value: formatGravity(displayActualOg)
    },
    {
      label: t("brews.actualFg", "Actual FG"),
      value: formatGravity(displayActualFg)
    },
    {
      label: t("ABV", "ABV"),
      value: formatAbv(displayActualAbv)
    },
    {
      label: t("iSpindelDashboard.brews.latestGrav", "Latest gravity"),
      value: formatGravity(displayLatestGravity)
    },
    {
      label: t("lastUpdated", "Last updated"),
      value: latestEntry ? formatDate(latestEntry.datetime) : "—"
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
      return;
    }
    reset();
  }, [brew?.recipe_snapshot, hydrate, reset]);
  const { mutateAsync: createEntry } = useCreateBrewEntry();

  async function addEntry(input: CreateBrewEntryInput) {
    await createEntry({ brewId: brew!.id, input });
  }

  async function recordCurrentVolume(input: {
    liters: number;
    displayValue?: number;
    displayUnit?: string;
    startingLiters?: number;
  }) {
    await saveMetadata({ current_volume_liters: input.liters });
    await addEntry(
      entryPayload.volume({
        liters: input.liters,
        displayValue: input.displayValue,
        displayUnit: input.displayUnit,
        startingLiters: input.startingLiters
      })
    );
  }

  async function addAddition(input: {
    name: string;
    recipeIngredientId?: string;
    recipeAdditiveId?: string;
    amount?: number;
    unit?: string;
    note?: string;
    kind?: "INGREDIENT" | "NUTRIENT" | "YEAST" | "OTHER";
    source?:
      | "recipe_ingredient"
      | "recipe_additive"
      | "recipe_nutrient"
      | "recipe_go_ferm"
      | "recipe_yeast"
      | "manual_yeast"
      | "manual";
    meta?: Record<string, any>;
  }) {
    await addEntry(
      entryPayload.addition({
        name: input.name,
        recipeIngredientId: input.recipeIngredientId,
        recipeAdditiveId: input.recipeAdditiveId,
        amount: input.amount,
        unit: input.unit,
        note: input.note ?? null,
        kind: input.kind,
        source: input.source,
        meta: input.meta
      })
    );
  }

  async function addAdditions(
    inputs: Array<{
      name: string;
      recipeIngredientId?: string;
      recipeAdditiveId?: string;
      amount?: number;
      unit?: string;
      note?: string;
      kind?: "INGREDIENT" | "NUTRIENT" | "YEAST" | "OTHER";
      source?:
        | "recipe_ingredient"
        | "recipe_additive"
        | "recipe_nutrient"
        | "recipe_go_ferm"
        | "recipe_yeast"
        | "manual_yeast"
        | "manual";
      meta?: Record<string, any>;
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
    return <div className="text-center my-4">{t("error.generic", "Something went wrong loading this brew.")}</div>;
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
                    title={nameEditable ? t("disableEdit", "Disable editing") : t("edit", "Edit")}
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
                displayValue={brew.batch_number != null ? `#${String(brew.batch_number)}` : "—"}
                inputValue={batchValue}
                onInputChange={setBatchValue}
                onSave={saveBatchNumber}
                onToggle={() => {
                  if (batchEditable) {
                    setBatchValue(brew.batch_number != null ? String(brew.batch_number) : "");
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
                label={t("brews.volume.currentVolume", "Current volume")}
                value={formatVolume(brew.current_volume_liters)}
                action={
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setRecordVolumeOpen(true)}
                    title={t("brews.volume.recordCurrent", "Record current volume")}
                  >
                    <Scale />
                  </Button>
                }
              />
              {batchSummaryItems.map((item) =>
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
                  <div key={item.label} className="border-b border-border/60 py-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                    <dd className="mt-1 text-sm font-medium text-foreground">{item.value}</dd>
                  </div>
                )
              )}
              <SummaryField
                label={t("emailAlerts.title", "Email alerts")}
                value={
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">
                      {brew.requested_email_alerts ? t("on", "On") : t("off", "Off")}
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
                <div key={item.label} className="border-b border-border/60 py-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      <BrewStagePath
        brewId={brew.id}
        stage={brew.stage}
        entries={allEntries}
        onMoveToStage={async (to) => {
          await saveMetadata({ stage: to });
        }}
        openAddEntry={openAddEntry}
        addAddition={addAddition}
        addAdditions={addAdditions}
        addEntry={addEntry}
        current_volume_liters={brew.current_volume_liters}
        recipe={brewRecipe}
        patchBrewMetadata={async (input) => {
          await saveMetadata(input);
        }}
        linkRecipeHref={`/account/brews/${brew.id}/link`}
        hasRecipeLinked={Boolean(brewRecipe.recipeData)}
      />
      <RecordVolumeDialog
        t={t}
        open={recordVolumeOpen}
        onOpenChange={setRecordVolumeOpen}
        currentVolumeLiters={recordVolumeCurrentLiters}
        onSave={(volume, meta) =>
          recordCurrentVolume({
            liters: volume,
            displayValue: meta.displayValue,
            displayUnit: meta.displayUnit,
            startingLiters: meta.startingLiters
          })
        }
      />
      <Dialog open={startDateDialogOpen} onOpenChange={setStartDateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("start", "Start")}</DialogTitle>
          </DialogHeader>
          <DateTimePicker
            value={startValue ? new Date(startValue) : new Date(brew.start_date)}
            onChange={(value) => setStartValue(value ? toDateTimeLocalValue(value.toISOString()) : "")}
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
        gravityRole={entryGravityRole}
        gravityDefaultValue={entryGravityDefaultValue}
        gravitySource={entryGravitySource}
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
          brew.entries_by_stage.map((bucket) => {
            const visibleEntries = bucket.entries.filter((entry) => !(entry.data as any)?.hidden);
            if (!visibleEntries.length) return null;

            return (
              <div key={bucket.stage} className="rounded-xl border border-border bg-card">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <div className="font-medium">{formatStageLabel(bucket.stage)}</div>
                  <div className="text-sm text-muted-foreground">{visibleEntries.length}</div>
                </div>

                <div className="p-5 space-y-3">
                  {visibleEntries.map((e) => (
                    <div key={e.id} className="rounded-lg border border-border p-4 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-medium">{e.title ?? e.type}</div>
                        <div className="text-sm text-muted-foreground">{formatDate(e.datetime)}</div>
                      </div>

                      {e.note ? <div className="text-sm">{e.note}</div> : null}

                      <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                        {e.gravity != null ? (
                          <span>
                            {(() => {
                              const role = (e.data as any)?.readingRole;
                              const source = (e.data as any)?.source;
                              const label = role === "OG" ? "OG" : role === "FG" ? "FG" : "SG";
                              return `${label}: ${formatGravity(e.gravity)}${source === "recipe" ? " (recipe)" : ""}`;
                            })()}
                          </span>
                        ) : null}
                        {e.temperature != null ? (
                          <span>Temp: {formatTemperature(e.temperature, e.temp_units)}</span>
                        ) : null}
                        {e.type === BREW_ENTRY_TYPE.PH && typeof (e.data as any)?.ph === "number" ? (
                          <span>pH: {normalizeNumberString(Number((e.data as any).ph), 2, i18n.resolvedLanguage)}</span>
                        ) : null}
                        {e.type === "STAGE_CHANGE" && e.data ? (
                          <span>
                            {formatStageLabel(String((e.data as any)?.from ?? ""))} →{" "}
                            {formatStageLabel(String((e.data as any)?.to ?? ""))}
                          </span>
                        ) : null}
                        {e.type === BREW_ENTRY_TYPE.ADDITION && e.data
                          ? (() => {
                              const d = e.data as Partial<BrewAdditionData>;
                              return (
                                <span>
                                  {d.name}
                                  {d.amount != null
                                    ? `: ${normalizeNumberString(Number(d.amount), 2, i18n.resolvedLanguage)}`
                                    : ""}
                                  {d.unit ? ` ${d.unit}` : ""}
                                </span>
                              );
                            })()
                          : null}
                        {e.type === BREW_ENTRY_TYPE.VOLUME && e.data
                          ? (() => {
                              const d = e.data as {
                                liters?: number;
                                displayValue?: number;
                                displayUnit?: string;
                              };
                              const value =
                                typeof d.displayValue === "number" && Number.isFinite(d.displayValue) && d.displayUnit
                                  ? `${normalizeNumberString(
                                      d.displayValue,
                                      2,
                                      i18n.resolvedLanguage
                                    )} ${d.displayUnit}`
                                  : formatVolume(d.liters);
                              return <span>Volume: {value}</span>;
                            })()
                          : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-muted-foreground">{t("noEntries", "No entries yet.")}</div>
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

function SummaryField({ label, value, action }: { label: string; value: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-b border-border/60 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
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
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
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
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{displayValue}</span>
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
