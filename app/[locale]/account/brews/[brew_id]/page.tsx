"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";

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
import { useRecipe } from "@/components/providers/RecipeProvider";
import { BrewStagePath } from "@/components/brews/BrewStagePath";
import { Button } from "@/components/ui/button";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import { BrewAdditionData, entryPayload } from "@/lib/utils/entryPayload";
import { useCreateBrewEntry } from "@/hooks/reactQuery/useCreateBrewEntry";

export default function BrewPageClient() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ brew_id: string }>();
  const brewId = params?.brew_id;

  const { data: brew, isLoading, isError, error } = useAccountBrew(brewId);
  const { mutateAsync: patchMeta } = usePatchAccountBrewMetadata();

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

  const {
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

  useEffect(() => {
    if (brew?.recipe_snapshot?.dataV2) {
      hydrate(brew.recipe_snapshot.dataV2);
      console.log(brew.recipe_snapshot.dataV2);
    }
  }, [brew]);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">{brew.name ?? brew.id}</h1>
            <div className="text-sm text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
              <div>
                {t("start", "Start")}:{" "}
                <span className="text-foreground">
                  {formatDate(brew.start_date)}
                </span>
              </div>
              <div>
                {t("end", "End")}:{" "}
                <span className="text-foreground">
                  {brew.end_date
                    ? formatDate(brew.end_date)
                    : t("ongoing", "Ongoing")}
                </span>
              </div>
              <div>
                {t("batchNumber", "Batch")}:{" "}
                <span className="text-foreground">
                  {brew.batch_number ?? "—"}
                </span>
              </div>
              <div>
                {t("entries", "Entries")}:{" "}
                <span className="text-foreground">{brew.entry_count}</span>
              </div>
            </div>

            {brew.recipe_id ? (
              <Link
                className="underline text-sm"
                href={`/recipes/${brew.recipe_id}`}
              >
                {brew.recipe_name ?? t("recipe", "Recipe")}
              </Link>
            ) : (
              <div className="text-sm text-muted-foreground">
                {t("noRecipe", "No recipe linked.")}
              </div>
            )}
          </div>
        </div>
      </div>

      <BrewStagePath
        stage={brew.stage}
        entries={allEntries}
        onMoveToStage={async (to) => {
          await patchMeta({ brewId: brew.id, input: { stage: to } });
          toast({ description: t("saved", "Saved.") });
        }}
        openAddEntry={openAddEntry}
        addAddition={addAddition}
        addAdditions={addAdditions}
      />
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
                <div className="font-medium">{bucket.stage}</div>
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
                      {e.gravity != null ? <span>SG: {e.gravity}</span> : null}
                      {e.temperature != null ? (
                        <span>
                          Temp: {e.temperature}
                          {e.temp_units ? `°${e.temp_units}` : ""}
                        </span>
                      ) : null}
                      {e.type === "STAGE_CHANGE" && e.data ? (
                        <span>
                          {String((e.data as any)?.from ?? "")} →{" "}
                          {String((e.data as any)?.to ?? "")}
                        </span>
                      ) : null}
                      {e.type === BREW_ENTRY_TYPE.ADDITION && e.data
                        ? (() => {
                            const d = e.data as Partial<BrewAdditionData>;
                            return (
                              <span>
                                {d.name}
                                {d.amount != null ? `: ${d.amount}` : ""}
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
    <div className="space-y-6">
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
