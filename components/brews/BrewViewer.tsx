"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Filter, LockKeyhole, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { BrewStagePath } from "@/components/brews/BrewStagePath";
import { BrewTimelineChartsView } from "@/components/brews/BrewTimelineCharts";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { BREW_ENTRY_TYPE, type BrewStage } from "@/lib/brewEnums";
import { buildBrewRecipeStageData } from "@/lib/utils/buildBrewRecipeStageData";
import { formatSgDisplay } from "@/lib/utils/gravityFormatting";
import { L_TO_VOLUME } from "@/lib/utils/recipeDataCalculations";
import { calcABV } from "@/lib/utils/unitConverter";
import type {
  BrewViewCapabilities,
  BrewViewDetail,
  BrewViewEntry
} from "@/types/brewView";
import { READ_ONLY_BREW_CAPABILITIES } from "@/types/brewView";

type HistoryFilter =
  | "readings"
  | "additions"
  | "volume"
  | "notes"
  | "stageChanges"
  | "packaging";
type MetricGroup = "readings" | "additions" | "volume";

const FILTER_TYPES: Record<HistoryFilter, string[]> = {
  readings: [
    BREW_ENTRY_TYPE.GRAVITY,
    BREW_ENTRY_TYPE.TEMPERATURE,
    BREW_ENTRY_TYPE.PH
  ],
  additions: [BREW_ENTRY_TYPE.ADDITION],
  volume: [BREW_ENTRY_TYPE.VOLUME],
  notes: [BREW_ENTRY_TYPE.NOTE, BREW_ENTRY_TYPE.TASTING, BREW_ENTRY_TYPE.ISSUE],
  stageChanges: [BREW_ENTRY_TYPE.STAGE_CHANGE],
  packaging: [BREW_ENTRY_TYPE.PACKAGING]
};

const noopAsync = async () => undefined;

function isHistoryFilter(value: string): value is HistoryFilter {
  return Object.prototype.hasOwnProperty.call(FILTER_TYPES, value);
}

export function BrewViewer({
  brew,
  capabilities = READ_ONLY_BREW_CAPABILITIES,
  backHref,
  recipeHref,
  backLabelKey = "back"
}: {
  brew: BrewViewDetail;
  capabilities?: BrewViewCapabilities;
  backHref: string;
  recipeHref?: string | null;
  backLabelKey?: string;
}) {
  const { t, i18n } = useTranslation();
  const [filters, setFilters] = useState<HistoryFilter[]>([]);
  const [newestFirst, setNewestFirst] = useState(true);
  const readOnly = !Object.values(capabilities).some(Boolean);
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage, {
        dateStyle: "medium",
        timeStyle: "short"
      }),
    [i18n.resolvedLanguage]
  );
  const formatDate = (value: string | null) =>
    value ? dateFormatter.format(new Date(value)) : "-";
  const visibleEntries = useMemo(
    () =>
      brew.entries.filter(
        (entry) => !(entry.data as { hidden?: boolean } | null)?.hidden
      ),
    [brew.entries]
  );
  const filteredBuckets = useMemo(
    () =>
      brew.entries_by_stage
        .map((bucket) => ({
          ...bucket,
          entries: bucket.entries
            .filter(
              (entry) => !(entry.data as { hidden?: boolean } | null)?.hidden
            )
            .filter((entry) =>
              filters.length === 0
                ? true
                : filters.some((filter) =>
                    FILTER_TYPES[filter].includes(entry.type)
                  )
            )
            .sort((a, b) => {
              const difference =
                new Date(a.datetime).getTime() - new Date(b.datetime).getTime();
              return newestFirst ? -difference : difference;
            })
        }))
        .filter((bucket) => bucket.entries.length > 0),
    [brew.entries_by_stage, filters, newestFirst]
  );
  const recipe = useMemo(
    () =>
      buildBrewRecipeStageData({
        recipeSnapshot: brew.recipe_snapshot,
        currentVolumeLiters: brew.current_volume_liters,
        latestGravity: brew.latest_gravity,
        entries: brew.entries
      }),
    [
      brew.current_volume_liters,
      brew.entries,
      brew.latest_gravity,
      brew.recipe_snapshot
    ]
  );
  const actualOg = recipe.actual.originalGravity?.gravity ?? null;
  const actualFg = recipe.actual.finalGravity?.gravity ?? null;
  const actualAbv =
    actualOg && actualFg
      ? calcABV(actualOg, actualFg)
      : recipe.actual.currentAbv;
  const recipeUnit =
    recipe.recipeData?.unitDefaults.volume ??
    recipe.derived?.volume.unit ??
    "gal";
  const formatVolume = (liters: number | null) => {
    if (liters == null) return "-";
    const conversion = L_TO_VOLUME[recipeUnit];
    return conversion
      ? `${(liters * conversion).toFixed(2)} ${recipeUnit}`
      : `${liters.toFixed(2)} L`;
  };
  const formatGravity = (gravity: number | null) =>
    gravity == null ? "-" : formatSgDisplay(gravity);
  const metricGroups = useMemo(() => {
    const groups: Record<MetricGroup, BrewViewEntry[]> = {
      readings: [],
      additions: [],
      volume: []
    };
    for (const entry of visibleEntries) {
      if (FILTER_TYPES.readings.includes(entry.type))
        groups.readings.push(entry);
      if (FILTER_TYPES.additions.includes(entry.type))
        groups.additions.push(entry);
      if (
        FILTER_TYPES.volume.includes(entry.type) ||
        FILTER_TYPES.packaging.includes(entry.type)
      ) {
        groups.volume.push(entry);
      }
    }
    return groups;
  }, [visibleEntries]);

  const summary = [
    [
      t("batchNumber", "Batch"),
      brew.batch_number == null ? "-" : `#${brew.batch_number}`
    ],
    [t("start", "Start"), formatDate(brew.start_date)],
    [
      t("end", "End"),
      brew.end_date ? formatDate(brew.end_date) : t("ongoing", "Ongoing")
    ],
    [
      t("brews.volume.currentVolume", "Current volume"),
      formatVolume(brew.current_volume_liters)
    ],
    [
      t("iSpindelDashboard.brews.latestGrav", "Latest gravity"),
      formatGravity(brew.latest_gravity)
    ],
    [t("brews.entries", "Entries"), String(brew.entry_count)]
  ];
  const recipeSummary = [
    [
      t("recipeBuilder.resultsLabels.estOG", "Estimated OG"),
      formatGravity(recipe.derived?.gravity.ogPrimary ?? null)
    ],
    [
      t("recipeBuilder.resultsLabels.estFG", "Estimated FG"),
      formatGravity(Number(recipe.recipeData?.fg) || null)
    ],
    [t("brews.primary.og", "Original gravity"), formatGravity(actualOg)],
    [t("brews.primary.fg", "Final gravity"), formatGravity(actualFg)],
    [
      t("recipeBuilder.resultsLabels.abv", "ABV"),
      actualAbv == null ? "-" : `${actualAbv.toFixed(2)}%`
    ],
    [
      t("recipeBuilder.resultsLabels.volume", "Volume"),
      formatVolume(recipe.derived?.volume.totalL ?? null)
    ]
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href={backHref}>
              <ArrowLeft />
              {t(backLabelKey, "Back")}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-2xl font-semibold sm:text-3xl">
              {brew.name || brew.id}
            </h1>
            <span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
              {t(`brewStage.${brew.stage}`, brew.stage)}
            </span>
            {readOnly ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                <LockKeyhole className="size-3" />
                {t("admin.readOnly", "Read only")}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {brew.owner ? (
              <span>
                {t("admin.owner", "Owner")}: {brew.owner.displayName}
              </span>
            ) : null}
            {brew.recipe_id && recipeHref ? (
              <span>
                {t("brews.recipe", "Recipe")}:{" "}
                <Link
                  className="text-foreground underline underline-offset-4"
                  href={recipeHref}
                >
                  {brew.recipe_name || t("recipe", "Recipe")}
                </Link>
              </span>
            ) : (
              <span>{t("noRecipe", "No recipe linked.")}</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SummarySection title={t("batchNumber", "Batch")} items={summary} />
        <SummarySection title={t("recipe", "Recipe")} items={recipeSummary} />
      </div>

      <Accordion type="single" defaultValue="stage-panel" collapsible>
        <AccordionItem value="stage-panel">
          <AccordionTrigger>
            {t("brews.stagePanel.title", "Brew tracker")} -{" "}
            {t(`brewStage.${brew.stage}`, brew.stage)}
          </AccordionTrigger>
          <AccordionContent>
            <BrewStagePath
              brewId={brew.id}
              stage={brew.stage}
              entries={brew.entries}
              onMoveToStage={noopAsync}
              openAddEntry={() => undefined}
              addAddition={noopAsync}
              addAdditions={noopAsync}
              addEntry={noopAsync}
              current_volume_liters={brew.current_volume_liters}
              gravity_unit_preference={brew.gravity_unit_preference}
              recipe={recipe}
              patchBrewMetadata={noopAsync}
              hasRecipeLinked={Boolean(recipe.recipeData)}
              readOnly={readOnly}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Tabs defaultValue="stages" className="space-y-4">
        <div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="stages">
              {t("brews.history.stages", "Stages")}
            </TabsTrigger>
            <TabsTrigger value="metrics">
              {t("brews.history.metrics.title", "Metrics")}
            </TabsTrigger>
            <TabsTrigger value="charts">
              {t("brews.history.charts", "Charts")}
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="multiple"
              value={filters}
              onValueChange={(value) =>
                setFilters(value.filter(isHistoryFilter))
              }
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="readings">
                <Filter className="size-3.5" />
                {t("brews.history.metrics.readings", "Readings")}
              </ToggleGroupItem>
              <ToggleGroupItem value="additions">
                {t("brews.history.metrics.additions", "Additions")}
              </ToggleGroupItem>
              <ToggleGroupItem value="notes">
                {t("brews.history.notes", "Notes")}
              </ToggleGroupItem>
            </ToggleGroup>
            {filters.length ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => setFilters([])}
                aria-label={t("clear", "Clear")}
                title={t("clear", "Clear")}
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setNewestFirst((value) => !value)}
            >
              {newestFirst ? t("newest", "Newest") : t("oldest", "Oldest")}
            </Button>
          </div>
        </div>

        <TabsContent value="stages" className="mt-0">
          {filteredBuckets.length ? (
            <Accordion
              type="multiple"
              defaultValue={[brew.stage]}
              className="space-y-3"
            >
              {filteredBuckets.map((bucket) => (
                <AccordionItem
                  key={bucket.stage}
                  value={bucket.stage}
                  className="rounded-md border px-4"
                >
                  <AccordionTrigger>
                    <span className="flex flex-wrap items-center gap-2">
                      {t(`brewStage.${bucket.stage}`, bucket.stage)}
                      <span className="text-xs font-normal text-muted-foreground">
                        {bucket.entries.length} {t("entries", "entries")}
                      </span>
                      {bucket.stage === brew.stage ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {t("current", "Current")}
                        </span>
                      ) : null}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {bucket.entries.map((entry) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        stage={bucket.stage}
                        formatDate={formatDate}
                      />
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <EmptyHistory />
          )}
        </TabsContent>

        <TabsContent value="metrics" className="mt-0">
          {visibleEntries.length ? (
            <div className="grid gap-4 lg:grid-cols-3">
              {(["readings", "additions", "volume"] as const).map((group) => (
                <section key={group} className="min-h-40 rounded-md border p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h2 className="font-medium">
                      {t(`brews.history.metrics.${group}`, group)}
                    </h2>
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {metricGroups[group].length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {metricGroups[group].map((entry) => (
                      <EntryCard
                        key={entry.id}
                        entry={entry}
                        stage={findEntryStage(brew, entry.id)}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyHistory />
          )}
        </TabsContent>

        <TabsContent value="charts" className="mt-0">
          <BrewTimelineChartsView entries={brew.entries} logs={brew.logs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummarySection({
  title,
  items
}: {
  title: string;
  items: string[][];
}) {
  return (
    <section className="space-y-3 rounded-lg border border-border/70 bg-background/40 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {items.map(([label, value]) => (
          <div key={label} className="border-b border-border/60 py-2">
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function EntryCard({
  entry,
  stage,
  formatDate
}: {
  entry: BrewViewEntry;
  stage: BrewStage;
  formatDate: (value: string | null) => string;
}) {
  const { t } = useTranslation();
  const data = (entry.data ?? {}) as Record<string, unknown>;
  const details = [
    typeof entry.gravity === "number" ? formatSgDisplay(entry.gravity) : null,
    typeof entry.temperature === "number"
      ? `${entry.temperature} ${entry.temp_units || ""}`.trim()
      : null,
    typeof data.ph === "number" ? `pH ${data.ph}` : null,
    typeof data.liters === "number" ? `${data.liters.toFixed(2)} L` : null,
    typeof data.amount === "number"
      ? `${data.amount} ${typeof data.unit === "string" ? data.unit : ""}`.trim()
      : null
  ].filter(Boolean);

  return (
    <article className="rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">
            {entry.title || t(`brewEntryType.${entry.type}`, entry.type)}
          </h3>
          <div className="text-xs text-muted-foreground">
            {t(`brewStage.${stage}`, stage)} - {formatDate(entry.datetime)}
          </div>
        </div>
        {details.length ? (
          <div className="text-sm font-medium tabular-nums">
            {details.join(" · ")}
          </div>
        ) : null}
      </div>
      {entry.note ? (
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {entry.note}
        </p>
      ) : null}
    </article>
  );
}

function findEntryStage(brew: BrewViewDetail, entryId: string): BrewStage {
  return (
    brew.entries_by_stage.find((bucket) =>
      bucket.entries.some((entry) => entry.id === entryId)
    )?.stage ?? brew.stage
  );
}

function EmptyHistory() {
  const { t } = useTranslation();
  return (
    <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
      {t("brews.history.empty", "No matching history entries.")}
    </div>
  );
}
