"use client";

import type { ComponentProps, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { Check, Filter, Pencil, PencilOff, Scale, Trash2, X } from "lucide-react";

import {
  AccountBrewEntry,
  CreateBrewEntryInput,
  useAccountBrew,
  usePatchAccountBrewMetadata
} from "@/hooks/reactQuery/useAccountBrews";

import { Skeleton } from "@/components/ui/skeleton";

import { toast } from "@/hooks/use-toast";

import AddBrewEntryDialog, { EntryType, OpenAddEntryArgs } from "@/components/brews/AddBrewEntryDialog";
import { RecordVolumeDialog } from "@/components/brews/RecordVolumeDialog";
import { useRecipe } from "@/components/providers/RecipeProvider";
import { BrewStagePath } from "@/components/brews/BrewStagePath";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { BREW_ENTRY_TYPE, BREW_STAGE, type BrewStage } from "@/lib/brewEnums";
import { BrewAdditionData, BrewPackagingData, GravityReadingRole, entryPayload } from "@/lib/utils/entryPayload";
import { useCreateBrewEntry, useDeleteBrewEntry, usePatchBrewEntry } from "@/hooks/reactQuery/useCreateBrewEntry";
import { L_TO_VOLUME, VOLUME_TO_L } from "@/lib/utils/recipeDataCalculations";
import { calcABV } from "@/lib/utils/unitConverter";
import { normalizeNumberString, parseNumber } from "@/lib/utils/validateInput";
import { buildBrewRecipeStageData } from "@/lib/utils/buildBrewRecipeStageData";
import {
  AdditiveUnitSelect,
  AmountUnitField,
  IngredientBasisSelect,
  IngredientUnitSelect,
  type AdditionBasis
} from "@/components/brews/stages/additionDialogShared";

type HeaderVolumeUnit = "gal" | "L";
type HistoryView = "stages" | "metrics";
type HistoryFilter = "readings" | "additions" | "volume" | "notes" | "stageChanges" | "packaging";

const BREW_STAGE_ORDER = Object.values(BREW_STAGE);
const HISTORY_FILTER_TYPES: Record<HistoryFilter, string[]> = {
  readings: [BREW_ENTRY_TYPE.GRAVITY, BREW_ENTRY_TYPE.TEMPERATURE, BREW_ENTRY_TYPE.PH],
  additions: [BREW_ENTRY_TYPE.ADDITION],
  volume: [BREW_ENTRY_TYPE.VOLUME],
  notes: [BREW_ENTRY_TYPE.NOTE, BREW_ENTRY_TYPE.TASTING, BREW_ENTRY_TYPE.ISSUE],
  stageChanges: [BREW_ENTRY_TYPE.STAGE_CHANGE],
  packaging: [BREW_ENTRY_TYPE.PACKAGING]
};
const METRIC_ENTRY_TYPES = new Set<string>([
  BREW_ENTRY_TYPE.GRAVITY,
  BREW_ENTRY_TYPE.TEMPERATURE,
  BREW_ENTRY_TYPE.PH,
  BREW_ENTRY_TYPE.VOLUME,
  BREW_ENTRY_TYPE.PACKAGING,
  BREW_ENTRY_TYPE.ADDITION
]);

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

  const getEntryTime = (entry: AccountBrewEntry) => {
    const time = new Date(entry.datetime).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  const getVisibleEntries = (entries: AccountBrewEntry[]) => entries.filter((entry) => !(entry.data as any)?.hidden);

  const sortEntriesNewestFirst = (entries: AccountBrewEntry[]) =>
    [...entries].sort((a, b) => getEntryTime(b) - getEntryTime(a));
  const formatTimelineDateRange = (entries: AccountBrewEntry[]) => {
    if (!entries.length) return "—";

    const sorted = [...entries].sort((a, b) => getEntryTime(a) - getEntryTime(b));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    if (!first || !last || first.id === last.id) {
      return formatDate(last?.datetime);
    }

    return `${formatDate(first.datetime)} - ${formatDate(last.datetime)}`;
  };

  const getPackageCount = (data?: Partial<BrewPackagingData> | null) =>
    (data?.bottleRows ?? []).reduce((sum, row) => sum + row.quantity, 0);

  const formatGravityEntry = (entry: AccountBrewEntry) => {
    const role = (entry.data as any)?.readingRole;
    const source = (entry.data as any)?.source;
    const label = role === "OG" ? "OG" : role === "FG" ? "FG" : "SG";
    return `${label}: ${formatGravity(entry.gravity)}${source === "recipe" ? ` (${t("recipe", "Recipe").toLowerCase()})` : ""}`;
  };

  const formatAdditionEntry = (entry: AccountBrewEntry) => {
    const data = entry.data as Partial<BrewAdditionData> | null;
    if (!data?.name) return t("brews.entryTypes.ADDITION", "Addition");

    const amount =
      data.amount != null && Number.isFinite(Number(data.amount))
        ? `: ${normalizeNumberString(Number(data.amount), 2, i18n.resolvedLanguage)}`
        : "";
    const unit = data.unit ? ` ${data.unit}` : "";
    return `${data.name}${amount}${unit}`;
  };

  const formatVolumeEntry = (entry: AccountBrewEntry) => {
    const data = entry.data as { liters?: number; displayValue?: number; displayUnit?: string } | null;
    const value =
      typeof data?.displayValue === "number" && Number.isFinite(data.displayValue) && data.displayUnit
        ? `${normalizeNumberString(data.displayValue, 2, i18n.resolvedLanguage)} ${data.displayUnit}`
        : formatVolume(data?.liters);
    return `${t("volume", "Volume")}: ${value}`;
  };

  const formatPackagingEntry = (entry: AccountBrewEntry) => {
    const data = entry.data as Partial<BrewPackagingData> | null;
    const value =
      typeof data?.displayValue === "number" && Number.isFinite(data.displayValue) && data.displayUnit
        ? `${normalizeNumberString(data.displayValue, 2, i18n.resolvedLanguage)} ${data.displayUnit}`
        : formatVolume(data?.packagedVolumeLiters);
    const count = getPackageCount(data);
    const packages =
      count > 0
        ? ` - ${normalizeNumberString(count, 0, i18n.resolvedLanguage)} ${t("brews.packaged.packages", "packages")}`
        : "";
    return `${t("brews.packaged.packaging", "Packaging")}: ${value}${packages}`;
  };

  const formatStageChangeEntry = (entry: AccountBrewEntry) => {
    const data = entry.data as { from?: string; to?: string } | null;
    return `${formatStageLabel(data?.from ?? "")} -> ${formatStageLabel(data?.to ?? "")}`;
  };

  const formatTimelineEntryLabel = (entry: AccountBrewEntry) => {
    if (entry.title) return entry.title;

    if (entry.type === BREW_ENTRY_TYPE.GRAVITY) return t("gravity", "Gravity");
    if (entry.type === BREW_ENTRY_TYPE.TEMPERATURE) return t("temperature", "Temperature");
    if (entry.type === BREW_ENTRY_TYPE.PH) return t("pH", "pH");
    if (entry.type === BREW_ENTRY_TYPE.NOTE) return t("note", "Note");
    if (entry.type === BREW_ENTRY_TYPE.TASTING) return t("tasting", "Tasting");
    if (entry.type === BREW_ENTRY_TYPE.ISSUE) return t("issue", "Issue");
    if (entry.type === BREW_ENTRY_TYPE.ADDITION) return t("brews.entryTypes.ADDITION", "Addition");
    if (entry.type === BREW_ENTRY_TYPE.VOLUME) return t("volume", "Volume");
    if (entry.type === BREW_ENTRY_TYPE.PACKAGING) return t("brews.packaged.packaging", "Packaging");
    if (entry.type === BREW_ENTRY_TYPE.STAGE_CHANGE) return t("brews.stageChange", "Stage change");

    return entry.type;
  };

  const formatTimelineEntrySummary = (entry: AccountBrewEntry) => {
    if (entry.type === BREW_ENTRY_TYPE.GRAVITY && entry.gravity != null) return formatGravityEntry(entry);
    if (entry.type === BREW_ENTRY_TYPE.TEMPERATURE && entry.temperature != null) {
      return `${t("temperature", "Temperature")}: ${formatTemperature(entry.temperature, entry.temp_units)}`;
    }
    if (entry.type === BREW_ENTRY_TYPE.PH && typeof (entry.data as any)?.ph === "number") {
      return `pH: ${normalizeNumberString(Number((entry.data as any).ph), 2, i18n.resolvedLanguage)}`;
    }
    if (entry.type === BREW_ENTRY_TYPE.ADDITION) return formatAdditionEntry(entry);
    if (entry.type === BREW_ENTRY_TYPE.VOLUME) return formatVolumeEntry(entry);
    if (entry.type === BREW_ENTRY_TYPE.PACKAGING) return formatPackagingEntry(entry);
    if (entry.type === BREW_ENTRY_TYPE.STAGE_CHANGE) return formatStageChangeEntry(entry);
    if (entry.note) return entry.note;

    return formatTimelineEntryLabel(entry);
  };

  const getStageHighlights = (entries: AccountBrewEntry[]) => {
    const newestFirst = [...entries].sort((a, b) => getEntryTime(b) - getEntryTime(a));
    const highlights: string[] = [];

    const latestGravity = newestFirst.find((entry) => entry.type === BREW_ENTRY_TYPE.GRAVITY && entry.gravity != null);
    if (latestGravity) highlights.push(formatGravityEntry(latestGravity));

    const latestPackaging = newestFirst.find((entry) => entry.type === BREW_ENTRY_TYPE.PACKAGING);
    if (latestPackaging) highlights.push(formatPackagingEntry(latestPackaging));

    const stageChange = newestFirst.find((entry) => entry.type === BREW_ENTRY_TYPE.STAGE_CHANGE);
    if (stageChange) highlights.push(formatStageChangeEntry(stageChange));

    const addition = newestFirst.find((entry) => entry.type === BREW_ENTRY_TYPE.ADDITION);
    if (addition) highlights.push(formatAdditionEntry(addition));

    const latestNote = newestFirst.find(
      (entry) =>
        entry.type === BREW_ENTRY_TYPE.NOTE ||
        entry.type === BREW_ENTRY_TYPE.TASTING ||
        entry.type === BREW_ENTRY_TYPE.ISSUE
    );
    if (latestNote) highlights.push(`${formatTimelineEntryLabel(latestNote)}: ${formatTimelineEntrySummary(latestNote)}`);

    return Array.from(new Set(highlights)).slice(0, 2);
  };

  const getDefaultTimelineStage = (
    buckets: Array<{ stage: BrewStage; entries: AccountBrewEntry[] }>,
    currentStage?: BrewStage
  ) => {
    if (!buckets.length) return undefined;
    if (currentStage && buckets.some((bucket) => bucket.stage === currentStage)) return currentStage;

    const currentIndex = currentStage ? BREW_STAGE_ORDER.indexOf(currentStage) : -1;
    if (currentIndex === -1) return buckets[0]?.stage;

    return [...buckets].sort((a, b) => {
      const aDistance = Math.abs(BREW_STAGE_ORDER.indexOf(a.stage) - currentIndex);
      const bDistance = Math.abs(BREW_STAGE_ORDER.indexOf(b.stage) - currentIndex);
      return aDistance - bDistance;
    })[0]?.stage;
  };

  const getAllowedFilterTypes = (filters: HistoryFilter[]) => {
    if (!filters.length) return null;
    return new Set(filters.flatMap((filter) => HISTORY_FILTER_TYPES[filter]));
  };

  const entryMatchesFilters = (entry: AccountBrewEntry, filters: HistoryFilter[]) => {
    const allowedTypes = getAllowedFilterTypes(filters);
    return !allowedTypes || allowedTypes.has(entry.type);
  };

  const getMetricGroupKey = (entry: AccountBrewEntry) => {
    if (entry.type === BREW_ENTRY_TYPE.GRAVITY || entry.type === BREW_ENTRY_TYPE.TEMPERATURE || entry.type === BREW_ENTRY_TYPE.PH) {
      return "readings";
    }
    if (entry.type === BREW_ENTRY_TYPE.ADDITION) return "additions";
    if (entry.type === BREW_ENTRY_TYPE.VOLUME || entry.type === BREW_ENTRY_TYPE.PACKAGING) return "volume";
    return null;
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
  const [editingEntry, setEditingEntry] = useState<AccountBrewEntry | null>(null);
  const [timelineOpenStage, setTimelineOpenStage] = useState<string | undefined>();
  const [historyView, setHistoryView] = useState<HistoryView>("stages");
  const [historyFilters, setHistoryFilters] = useState<HistoryFilter[]>([]);

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

  const visibleEntries = useMemo(() => getVisibleEntries(brew?.entries ?? []), [brew?.entries]);
  const entryStageById = useMemo(() => {
    const map = new Map<string, BrewStage>();
    for (const bucket of brew?.entries_by_stage ?? []) {
      for (const entry of bucket.entries) {
        map.set(entry.id, bucket.stage);
      }
    }
    return map;
  }, [brew?.entries_by_stage]);

  const visibleTimelineBuckets = useMemo(
    () =>
      (brew?.entries_by_stage ?? [])
        .map((bucket) => ({
          stage: bucket.stage,
          entries: getVisibleEntries(bucket.entries)
        }))
        .filter((bucket) => bucket.entries.length > 0),
    [brew?.entries_by_stage]
  );
  const filteredTimelineBuckets = useMemo(
    () =>
      visibleTimelineBuckets
        .map((bucket) => ({
          stage: bucket.stage,
          entries: sortEntriesNewestFirst(bucket.entries.filter((entry) => entryMatchesFilters(entry, historyFilters)))
        }))
        .filter((bucket) => bucket.entries.length > 0),
    [historyFilters, visibleTimelineBuckets]
  );
  const metricGroups = useMemo(() => {
    const groups: Record<"readings" | "additions" | "volume", AccountBrewEntry[]> = {
      readings: [],
      additions: [],
      volume: []
    };

    for (const entry of visibleEntries) {
      if (!METRIC_ENTRY_TYPES.has(entry.type)) continue;
      const key = getMetricGroupKey(entry);
      if (key) groups[key].push(entry);
    }

    return groups;
  }, [visibleEntries]);

  const defaultTimelineStage = useMemo(
    () => getDefaultTimelineStage(filteredTimelineBuckets, brew?.stage),
    [brew?.stage, filteredTimelineBuckets]
  );

  useEffect(() => {
    setTimelineOpenStage(defaultTimelineStage);
  }, [defaultTimelineStage]);

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

  const displayLatestGravity = latestGravityEntry?.gravity ?? brew?.latest_gravity;
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
      label: t("brews.recipeTotalSecondaryVolume", "Total secondary volume"),
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
  const { mutateAsync: patchEntry } = usePatchBrewEntry();
  const { mutateAsync: deleteEntry } = useDeleteBrewEntry();

  async function addEntry(input: CreateBrewEntryInput) {
    await createEntry({ brewId: brew!.id, input });
  }

  async function recordCurrentVolume(input: {
    liters: number;
    displayValue?: number;
    displayUnit?: string;
    startingLiters?: number;
    datetime?: string;
  }) {
    await saveMetadata({ current_volume_liters: input.liters });
    await addEntry(
      entryPayload.volume({
        liters: input.liters,
        displayValue: input.displayValue,
        displayUnit: input.displayUnit,
        startingLiters: input.startingLiters,
        datetime: input.datetime
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
    datetime?: string;
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
        meta: input.meta,
        datetime: input.datetime
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
      datetime?: string;
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

  const historyFilterOptions: Array<{ value: HistoryFilter; label: string }> = [
    { value: "readings", label: t("brews.history.filters.readings", "Readings") },
    { value: "additions", label: t("brews.history.filters.additions", "Additions") },
    { value: "volume", label: t("brews.history.filters.volume", "Volume") },
    { value: "notes", label: t("brews.history.filters.notes", "Notes") },
    { value: "stageChanges", label: t("brews.history.filters.stageChanges", "Stage changes") },
    { value: "packaging", label: t("brews.history.filters.packaging", "Packaging") }
  ];
  const activeFilterValue = historyFilters.length ? historyFilters : ["all"];
  const hasMetricEntries = Object.values(metricGroups).some((entries) => entries.length > 0);

  const renderEmptyHistory = () => (
    <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
      {visibleEntries.length
        ? t("brews.history.noFilteredEntries", "No entries match the selected filters.")
        : t("noEntries", "No entries yet.")}
    </div>
  );

  const renderEntryCard = (entry: AccountBrewEntry, options?: { showStage?: boolean }) => {
    const label = formatTimelineEntryLabel(entry);
    const summary = formatTimelineEntrySummary(entry);
    const showSummary = summary !== label && summary !== entry.note;
    const stage = entryStageById.get(entry.id);

    return (
      <div key={entry.id} className="rounded-lg border border-border p-4 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="font-medium">{label}</div>
            {options?.showStage && stage ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {formatStageLabel(stage)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">{formatDate(entry.datetime)}</div>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setEditingEntry(entry)}
              title={t("edit", "Edit")}
            >
              <Pencil />
            </Button>
          </div>
        </div>

        {entry.note ? <div className="text-sm">{entry.note}</div> : null}

        {showSummary ? (
          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>{summary}</span>
          </div>
        ) : null}

        {entry.type === BREW_ENTRY_TYPE.PACKAGING &&
        (entry.data as Partial<BrewPackagingData> | null)?.bottleRows?.length ? (
          <div className="flex flex-wrap gap-2 pt-2">
            {((entry.data as Partial<BrewPackagingData>).bottleRows ?? []).map((row, index) => (
              <span
                key={`${row.label}-${index}`}
                className="inline-flex items-baseline gap-1.5 rounded-md border border-border bg-background/60 px-2 py-1 text-xs"
              >
                <span className="font-medium text-foreground">
                  {normalizeNumberString(row.quantity, 0, i18n.resolvedLanguage)} {row.label}
                </span>
                {row.totalLiters > 0 ? <span className="text-muted-foreground">{formatVolume(row.totalLiters)}</span> : null}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

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
        onMoveToStage={async (to, datetime) => {
          await saveMetadata({ stage: to, stage_change_datetime: datetime });
        }}
        openAddEntry={openAddEntry}
        addAddition={addAddition}
        addAdditions={addAdditions}
        addEntry={addEntry}
        patchEntry={async (entryId, input) => {
          await patchEntry({ brewId: brew.id, entryId, input });
        }}
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
            startingLiters: meta.startingLiters,
            datetime: meta.datetime
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
      <Tabs value={historyView} onValueChange={(value) => setHistoryView(value as HistoryView)} className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-semibold">{t("brews.history.title", "History")}</h2>
            <TabsList className="h-8">
              <TabsTrigger value="stages" className="h-6 px-2">
                {t("brews.history.views.stages", "Stages")}
              </TabsTrigger>
              <TabsTrigger value="metrics" className="h-6 px-2">
                {t("brews.history.views.metrics", "Metrics")}
              </TabsTrigger>
            </TabsList>
          </div>

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

        {historyView === "stages" ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
            <div className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Filter className="h-4 w-4" />
              {t("brews.history.filters.label", "Filters")}
            </div>
            <ToggleGroup
              type="multiple"
              size="sm"
              value={activeFilterValue}
              onValueChange={(value) => {
                if (!value.length) {
                  setHistoryFilters([]);
                  return;
                }
                if (value.includes("all")) {
                  setHistoryFilters(historyFilters.length ? [] : (value.filter((item) => item !== "all") as HistoryFilter[]));
                  return;
                }
                setHistoryFilters(value as HistoryFilter[]);
              }}
              className="flex flex-wrap justify-start gap-1.5"
            >
              <ToggleGroupItem
                value="all"
                aria-label={t("brews.history.filters.all", "All")}
                className="h-7 rounded-full border border-border bg-background px-3 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {t("brews.history.filters.all", "All")}
              </ToggleGroupItem>
              {historyFilterOptions.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={option.label}
                  className="h-7 rounded-full border border-border bg-background px-3 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {historyFilters.length ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 rounded-full px-2 text-xs text-muted-foreground"
                onClick={() => setHistoryFilters([])}
              >
                <X className="h-3.5 w-3.5" />
                {t("clear", "Clear")}
              </Button>
            ) : null}
          </div>
        ) : null}

        <TabsContent value="stages" className="mt-0">
          {filteredTimelineBuckets.length ? (
            <Accordion
              type="single"
              collapsible
              value={timelineOpenStage}
              onValueChange={(value) => setTimelineOpenStage(value || undefined)}
              className="space-y-3"
            >
              {filteredTimelineBuckets.map((bucket) => {
                const highlights = getStageHighlights(bucket.entries);
                const entryCountLabel = bucket.entries.length === 1 ? t("entry", "entry") : t("entries", "entries");

                return (
                  <AccordionItem
                    key={bucket.stage}
                    value={bucket.stage}
                    className="rounded-xl border border-border bg-card px-0"
                  >
                    <AccordionTrigger className="gap-4 px-5 py-4 hover:no-underline">
                      <div className="min-w-0 flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <div className="font-medium text-foreground">{formatStageLabel(bucket.stage)}</div>
                          <div className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {bucket.entries.length} {entryCountLabel}
                          </div>
                          {bucket.stage === brew.stage ? (
                            <div className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              {t("current", "Current")}
                            </div>
                          ) : null}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatTimelineDateRange(bucket.entries)}</span>
                          {highlights.map((highlight) => (
                            <span key={highlight} className="line-clamp-1 max-w-full sm:max-w-[18rem]">
                              {highlight}
                            </span>
                          ))}
                        </div>
                      </div>
                    </AccordionTrigger>

                    <AccordionContent className="px-5 pb-5">
                      <div className="space-y-3">{bucket.entries.map((entry) => renderEntryCard(entry))}</div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          ) : (
            renderEmptyHistory()
          )}
        </TabsContent>

        <TabsContent value="metrics" className="mt-0">
          {hasMetricEntries ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {[
                { key: "readings" as const, label: t("brews.history.metrics.readings", "Readings") },
                { key: "additions" as const, label: t("brews.history.metrics.additions", "Additions") },
                { key: "volume" as const, label: t("brews.history.metrics.volume", "Volume & packaging") }
              ].map((group) => (
                <section key={group.key} className="flex max-h-[34rem] min-h-[12rem] flex-col rounded-xl border border-border bg-card p-4">
                  <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
                    <h3 className="font-medium">{group.label}</h3>
                    <span className="text-sm text-muted-foreground">{metricGroups[group.key].length}</span>
                  </div>
                  {metricGroups[group.key].length ? (
                    <div className="min-h-0 space-y-3 overflow-y-auto pr-1">
                      {metricGroups[group.key].map((entry) => renderEntryCard(entry, { showStage: true }))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {t("brews.history.noMetricEntries", "No matching metric entries.")}
                    </div>
                  )}
                </section>
              ))}
            </div>
          ) : (
            renderEmptyHistory()
          )}
        </TabsContent>
      </Tabs>
      <EditBrewEntryDialog
        entry={editingEntry}
        onOpenChange={(open) => {
          if (!open) setEditingEntry(null);
        }}
        formatGravity={formatGravity}
        onSave={async (entryId, input) => {
          await patchEntry({ brewId: brew.id, entryId, input });
          toast({ description: t("saved", "Saved.") });
          setEditingEntry(null);
        }}
        onDelete={async (entryId) => {
          await deleteEntry({ brewId: brew.id, entryId });
          toast({ description: t("deleted", "Deleted.") });
          setEditingEntry(null);
        }}
      />
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

function inferAdditionBasis(unit?: string | null): AdditionBasis {
  if (!unit) return "other";
  if (["kg", "g", "mg", "lb", "lbs", "oz"].includes(unit)) return "weight";
  if (["L", "mL", "ml", "liter", "liters", "gal", "qt", "pt", "fl_oz", "imp_gal", "imp_qt", "imp_pt", "imp_fl_oz"].includes(unit)) {
    return "volume";
  }
  return "other";
}

function EditBrewEntryDialog({
  entry,
  onOpenChange,
  onSave,
  onDelete
}: {
  entry: AccountBrewEntry | null;
  onOpenChange: (open: boolean) => void;
  formatGravity: (gravity?: number | null) => string;
  onSave: (entryId: string, input: {
    datetime?: string;
    title?: string | null;
    note?: string | null;
    gravity?: number | null;
    temperature?: number | null;
    temp_units?: any | null;
    data?: any | null;
  }) => Promise<void>;
  onDelete: (entryId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [datetime, setDatetime] = useState<Date>(new Date());
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [gravity, setGravity] = useState("");
  const [temperature, setTemperature] = useState("");
  const [tempUnits, setTempUnits] = useState("F");
  const [ph, setPh] = useState("");
  const [additionName, setAdditionName] = useState("");
  const [additionAmount, setAdditionAmount] = useState("");
  const [additionUnit, setAdditionUnit] = useState("");
  const [additionBasis, setAdditionBasis] = useState<AdditionBasis>("other");
  const [additionComponents, setAdditionComponents] = useState<Array<{ key: string; name: string; amount: number; unit: string }>>([]);
  const [volume, setVolume] = useState("");
  const [volumeUnit, setVolumeUnit] = useState("");
  const [packagingRows, setPackagingRows] = useState<
    Array<{ label: string; quantity: string; sizeLiters: string }>
  >([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    const parsedDate = new Date(entry.datetime);
    setDatetime(Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate);
    setTitle(entry.title ?? "");
    setNote(entry.note ?? "");
    setGravity(entry.gravity != null ? String(entry.gravity) : "");
    setTemperature(entry.temperature != null ? String(entry.temperature) : "");
    setTempUnits(entry.temp_units ?? "F");
    setPh(typeof (entry.data as any)?.ph === "number" ? String((entry.data as any).ph) : "");

    const addition = entry.data as Partial<BrewAdditionData> | null;
    setAdditionName(addition?.name ?? entry.title ?? "");
    setAdditionAmount(typeof addition?.amount === "number" ? String(addition.amount) : "");
    setAdditionUnit(addition?.unit ?? "");
    setAdditionBasis(inferAdditionBasis(addition?.unit ?? ""));
    setAdditionComponents(
      Array.isArray(addition?.meta?.components)
        ? addition.meta.components
            .map((component: any) => ({
              key: String(component?.key ?? ""),
              name: String(component?.name ?? component?.key ?? ""),
              amount: typeof component?.amount === "number" && Number.isFinite(component.amount) ? component.amount : 0,
              unit: typeof component?.unit === "string" && component.unit ? component.unit : "g"
            }))
            .filter((component) => component.key && component.name)
        : []
    );

    const volumeData = entry.data as any;
    const packagingData = entry.data as Partial<BrewPackagingData> | null;
    setVolume(
      typeof volumeData?.displayValue === "number"
        ? String(volumeData.displayValue)
        : typeof volumeData?.liters === "number"
          ? String(volumeData.liters)
          : typeof volumeData?.packagedVolumeLiters === "number"
            ? String(volumeData.packagedVolumeLiters)
            : ""
    );
    setVolumeUnit(volumeData?.displayUnit ?? "L");
    setPackagingRows(
      (packagingData?.bottleRows ?? []).map((row) => ({
        label: row.label,
        quantity: String(row.quantity),
        sizeLiters: String(row.sizeLiters)
      }))
    );
  }, [entry]);

  if (!entry) return null;

  const isStageChange = entry.type === BREW_ENTRY_TYPE.STAGE_CHANGE;
  const canDelete = !isStageChange;
  const withoutVersion = (data: any) => {
    const rest = { ...(data ?? {}) };
    delete rest.v;
    return rest;
  };

  const buildPatch = () => {
    const patch: {
      datetime?: string;
      title?: string | null;
      note?: string | null;
      gravity?: number | null;
      temperature?: number | null;
      temp_units?: any | null;
      data?: any | null;
    } = {
      datetime: datetime.toISOString(),
      note: note.trim() || null
    };

    if (isStageChange) return patch;

    if (entry.type === BREW_ENTRY_TYPE.NOTE || entry.type === BREW_ENTRY_TYPE.TASTING || entry.type === BREW_ENTRY_TYPE.ISSUE) {
      patch.title = title.trim() || null;
      return patch;
    }

    if (entry.type === BREW_ENTRY_TYPE.GRAVITY) {
      const n = Number(gravity);
      if (!Number.isFinite(n)) throw new Error("Invalid gravity");
      patch.gravity = n;
      patch.data = withoutVersion(entry.data);
      return patch;
    }

    if (entry.type === BREW_ENTRY_TYPE.TEMPERATURE) {
      const n = Number(temperature);
      if (!Number.isFinite(n)) throw new Error("Invalid temperature");
      patch.temperature = n;
      patch.temp_units = tempUnits;
      return patch;
    }

    if (entry.type === BREW_ENTRY_TYPE.PH) {
      const n = Number(ph);
      if (!Number.isFinite(n)) throw new Error("Invalid pH");
      patch.title = title.trim() || "pH reading";
      patch.data = { ...withoutVersion(entry.data), ph: n };
      return patch;
    }

    if (entry.type === BREW_ENTRY_TYPE.ADDITION) {
      const nextComponents = additionComponents.map((component) => ({
        ...component,
        amount: Number(component.amount)
      }));
      const componentTotal = nextComponents.reduce(
        (sum, component) => sum + (Number.isFinite(component.amount) ? component.amount : 0),
        0
      );
      const amount = additionComponents.length ? componentTotal : additionAmount.trim() ? Number(additionAmount) : undefined;
      if (amount !== undefined && !Number.isFinite(amount)) throw new Error("Invalid amount");
      const nextData = {
        ...withoutVersion(entry.data),
        name: additionName.trim(),
        amount,
        unit: additionUnit.trim() || undefined,
        meta:
          additionComponents.length > 0
            ? {
                ...(((entry.data as any) ?? {}).meta ?? {}),
                components: nextComponents
              }
            : ((entry.data as any) ?? {}).meta
      };
      patch.title = additionName.trim() || entry.title;
      patch.data = nextData;
      return patch;
    }

    if (entry.type === BREW_ENTRY_TYPE.VOLUME) {
      const n = Number(volume);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid volume");
      const previous = withoutVersion(entry.data);
      const previousUnit = previous.displayUnit ?? volumeUnit;
      const liters = volumeUnit in VOLUME_TO_L ? n * VOLUME_TO_L[volumeUnit as keyof typeof VOLUME_TO_L] : previous.liters;
      patch.data = {
        ...previous,
        liters: typeof liters === "number" && Number.isFinite(liters) ? liters : previous.liters,
        displayValue: n,
        displayUnit: volumeUnit || previousUnit
      };
      return patch;
    }

    if (entry.type === BREW_ENTRY_TYPE.PACKAGING) {
      const n = Number(volume);
      if (!Number.isFinite(n) || n <= 0) throw new Error("Invalid packaged volume");
      const previous = withoutVersion(entry.data);
      const previousUnit = previous.displayUnit ?? volumeUnit;
      const liters =
        volumeUnit in VOLUME_TO_L
          ? n * VOLUME_TO_L[volumeUnit as keyof typeof VOLUME_TO_L]
          : previous.packagedVolumeLiters;
      const nextRows = packagingRows
        .map((row) => ({
          label: row.label.trim(),
          quantity: Number(row.quantity),
          sizeLiters: Number(row.sizeLiters)
        }))
        .filter(
          (row) =>
            row.label &&
            Number.isFinite(row.quantity) &&
            row.quantity > 0 &&
            Number.isFinite(row.sizeLiters) &&
            row.sizeLiters > 0
        )
        .map((row) => ({
          ...row,
          totalLiters: row.quantity * row.sizeLiters
        }));

      patch.title = entry.title ?? "Packaged";
      patch.data = {
        ...previous,
        packagedVolumeLiters:
          typeof liters === "number" && Number.isFinite(liters)
            ? liters
            : previous.packagedVolumeLiters,
        displayValue: n,
        displayUnit: volumeUnit || previousUnit,
        bottleRows: nextRows
      };
      return patch;
    }

    patch.title = title.trim() || entry.title;
    return patch;
  };

  const save = async () => {
    setIsSaving(true);
    try {
      await onSave(entry.id, buildPatch());
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    setIsSaving(true);
    try {
      await onDelete(entry.id);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(entry)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("edit", "Edit")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("date", "Date")}</Label>
            <DateTimePicker value={datetime} onChange={(value) => value && setDatetime(value)} hourCycle={12} />
          </div>

          {(entry.type === BREW_ENTRY_TYPE.NOTE ||
            entry.type === BREW_ENTRY_TYPE.TASTING ||
            entry.type === BREW_ENTRY_TYPE.ISSUE ||
            entry.type === BREW_ENTRY_TYPE.PH) &&
          !isStageChange ? (
            <div className="space-y-2">
              <Label>{t("title", "Title")}</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
          ) : null}

          {entry.type === BREW_ENTRY_TYPE.GRAVITY ? (
            <div className="space-y-2">
              <Label>{t("brew.gravity", "Gravity")}</Label>
              <Input inputMode="decimal" value={gravity} onChange={(event) => setGravity(event.target.value)} />
            </div>
          ) : null}

          {entry.type === BREW_ENTRY_TYPE.TEMPERATURE ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <div className="space-y-2">
                <Label>{t("brew.temperature", "Temperature")}</Label>
                <Input inputMode="decimal" value={temperature} onChange={(event) => setTemperature(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("units", "Units")}</Label>
                <Select value={tempUnits} onValueChange={setTempUnits}>
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
          ) : null}

          {entry.type === BREW_ENTRY_TYPE.PH ? (
            <div className="space-y-2">
              <Label>{t("brew.ph", "pH")}</Label>
              <Input inputMode="decimal" value={ph} onChange={(event) => setPh(event.target.value)} />
            </div>
          ) : null}

          {entry.type === BREW_ENTRY_TYPE.ADDITION ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t("name", "Name")}</Label>
                <Input value={additionName} onChange={(event) => setAdditionName(event.target.value)} />
              </div>
              {additionComponents.length > 0 ? (
                <div className="space-y-2">
                  <Label>{t("amount", "Amount")}</Label>
                  <div className="space-y-2">
                    {additionComponents.map((component, index) => (
                      <div key={component.key} className="grid gap-2 sm:grid-cols-[1fr_minmax(11rem,14rem)]">
                        <div className="self-center text-sm">{component.name}</div>
                        <AmountUnitField
                          amount={String(component.amount)}
                          unit={component.unit}
                          onAmountChange={(value) => {
                            const nextAmount = Number(value);
                            setAdditionComponents((items) =>
                              items.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, amount: Number.isFinite(nextAmount) ? nextAmount : item.amount }
                                  : item
                              )
                            );
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>{t("amount", "Amount")}</Label>
                  {(entry.data as Partial<BrewAdditionData> | null)?.source === "recipe_ingredient" ? (
                    <div className="space-y-2">
                      <IngredientBasisSelect value={additionBasis} onValueChange={setAdditionBasis} t={t} />
                      <AmountUnitField
                        amount={additionAmount}
                        unit={additionUnit}
                        onAmountChange={setAdditionAmount}
                        unitControl={
                          <IngredientUnitSelect
                            basis={additionBasis === "other" ? "weight" : additionBasis}
                            value={additionUnit}
                            onValueChange={setAdditionUnit}
                          />
                        }
                      />
                    </div>
                  ) : (
                    <AmountUnitField
                      amount={additionAmount}
                      unit={additionUnit}
                      onAmountChange={setAdditionAmount}
                      unitControl={
                        <AdditiveUnitSelect
                          value={additionUnit}
                          onValueChange={(value) => {
                            setAdditionUnit(value);
                            setAdditionBasis(inferAdditionBasis(value));
                          }}
                        />
                      }
                    />
                  )}
                </div>
              )}
            </div>
          ) : null}

          {entry.type === BREW_ENTRY_TYPE.VOLUME ? (
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-2">
                <Label>{t("brews.volume.enterVolume", "Volume")}</Label>
                <Input inputMode="decimal" value={volume} onChange={(event) => setVolume(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("unit", "Unit")}</Label>
                <Select value={volumeUnit} onValueChange={setVolumeUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gal">gal</SelectItem>
                    <SelectItem value="qt">qt</SelectItem>
                    <SelectItem value="pt">pt</SelectItem>
                    <SelectItem value="L">L</SelectItem>
                    <SelectItem value="mL">mL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {entry.type === BREW_ENTRY_TYPE.PACKAGING ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                <div className="space-y-2">
                  <Label>{t("brews.packaged.packagedVolume", "Packaged volume")}</Label>
                  <Input inputMode="decimal" value={volume} onChange={(event) => setVolume(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("unit", "Unit")}</Label>
                  <Select value={volumeUnit} onValueChange={setVolumeUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gal">gal</SelectItem>
                      <SelectItem value="qt">qt</SelectItem>
                      <SelectItem value="pt">pt</SelectItem>
                      <SelectItem value="L">L</SelectItem>
                      <SelectItem value="mL">mL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label>{t("brews.packaged.packages", "Packages")}</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setPackagingRows((rows) => [
                        ...rows,
                        { label: "", quantity: "", sizeLiters: "" }
                      ])
                    }
                  >
                    {t("add", "Add")}
                  </Button>
                </div>
                <div className="space-y-2">
                  {packagingRows.length ? (
                    packagingRows.map((row, index) => (
                      <div key={index} className="grid gap-2 sm:grid-cols-[1fr_6rem_7rem_auto]">
                        <Input
                          value={row.label}
                          placeholder={t("bottlingCalculator.table.bottle", "Bottle")}
                          onChange={(event) =>
                            setPackagingRows((rows) =>
                              rows.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, label: event.target.value } : item
                              )
                            )
                          }
                        />
                        <Input
                          inputMode="decimal"
                          value={row.quantity}
                          placeholder={t("bottlingCalculator.table.qty", "Qty")}
                          onChange={(event) =>
                            setPackagingRows((rows) =>
                              rows.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, quantity: event.target.value } : item
                              )
                            )
                          }
                        />
                        <Input
                          inputMode="decimal"
                          value={row.sizeLiters}
                          placeholder={t("units.L", "L")}
                          onChange={(event) =>
                            setPackagingRows((rows) =>
                              rows.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, sizeLiters: event.target.value } : item
                              )
                            )
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setPackagingRows((rows) =>
                              rows.filter((_, itemIndex) => itemIndex !== index)
                            )
                          }
                        >
                          {t("remove", "Remove")}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {t("brews.packaged.noPackageRows", "No package rows recorded.")}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>{t("note", "Note")}</Label>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </div>

        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {canDelete ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isSaving}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("delete", "Delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("brews.deleteEntryTitle", "Delete this entry?")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t(
                      "brews.deleteEntryDescription",
                      "This removes the entry from the brew timeline. This action cannot be undone."
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isSaving}>{t("cancel", "Cancel")}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isSaving}
                    onClick={(event) => {
                      event.preventDefault();
                      void remove();
                    }}
                  >
                    {t("delete", "Delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
              {t("cancel", "Cancel")}
            </Button>
            <Button onClick={save} disabled={isSaving}>
              {t("save", "Save")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
