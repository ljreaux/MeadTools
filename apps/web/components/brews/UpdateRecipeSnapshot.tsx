"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { usePatchAccountBrewMetadata, type AccountBrew } from "@/hooks/reactQuery/useAccountBrews";
import type { RecipeApiResponse } from "@/hooks/reactQuery/useRecipeQuery";
import { recipeSnapshotContentKey } from "@/lib/brews/recipeSnapshot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

const CONTENT_SECTIONS = [
  "unitDefaults", "ingredients", "fg", "additives", "notes",
  "nutrients", "stabilizers", "lossAdjustment"
] as const;

export function UpdateRecipeSnapshot({ brew }: { brew: AccountBrew }) {
  const { t, i18n } = useTranslation();
  const fetchWithAuth = useFetchWithAuth();
  const patch = usePatchAccountBrewMetadata();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snapshot = brew.recipe_snapshot;
  const canCheck = Boolean(brew.recipe_id && snapshot && !brew.end_date && brew.stage !== "COMPLETE");
  const sourceQuery = useQuery({
    queryKey: ["brew-recipe-source", brew.recipe_id],
    enabled: canCheck,
    queryFn: async () => {
      const response = await fetchWithAuth<{ recipe: RecipeApiResponse }>(`/api/recipes/${brew.recipe_id}`);
      return response.recipe;
    },
    retry: false,
    staleTime: 0
  });
  const source = sourceQuery.data;
  const differs = Boolean(
    snapshot && source && recipeSnapshotContentKey(snapshot) !== recipeSnapshotContentKey(source)
  );
  const changedSections = useMemo(() => {
    if (!snapshot || !source) return [];
    const sections = snapshot.name !== source.name ? [t("brews.snapshot.name")] : [];
    for (const section of CONTENT_SECTIONS) {
      const before = (snapshot.dataV2 as Record<string, unknown> | null)?.[section];
      const after = (source.dataV2 as Record<string, unknown> | null)?.[section];
      if (recipeSnapshotContentKey({ dataV2: before }) !== recipeSnapshotContentKey({ dataV2: after })) {
        sections.push(t(`brews.snapshot.sections.${section}`));
      }
    }
    return sections;
  }, [snapshot, source, t]);

  const update = async () => {
    if (!source || !snapshot || patch.isPending) return;
    setError(null);
    try {
      await patch.mutateAsync({
        brewId: brew.id,
        input: {
          update_recipe_snapshot: true,
          expected_snapshotted_at: snapshot.snapshottedAt ?? null,
          expected_recipe_content_key: recipeSnapshotContentKey(source)
        }
      });
      setOpen(false);
      await sourceQuery.refetch();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("brews.snapshot.failed"));
      await sourceQuery.refetch();
    }
  };

  const date = (value?: string) => value
    ? new Intl.DateTimeFormat(i18n.resolvedLanguage, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : t("brews.snapshot.unknownDate");

  return (
    <section className="rounded-lg border border-border/70 bg-background/40 p-4 space-y-3">
      <h2 className="text-sm font-semibold">{t("brews.snapshot.title")}</h2>
      {snapshot ? <p className="text-sm text-muted-foreground">{t("brews.snapshot.current", { date: date(snapshot.snapshottedAt) })}</p> : null}
      {canCheck && sourceQuery.isError ? (
        <p className="text-sm text-muted-foreground">{t("brews.snapshot.unavailable")}</p>
      ) : null}
      {canCheck && sourceQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("brews.snapshot.checking")}</p>
      ) : null}
      {canCheck && source && !differs ? (
        <p className="text-sm text-muted-foreground">{t("brews.snapshot.upToDate")}</p>
      ) : null}
      {canCheck && differs ? (
        <Button variant="secondary" onClick={() => { setError(null); setOpen(true); void sourceQuery.refetch(); }}>
          {t("brews.snapshot.action")}
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={(next) => !patch.isPending && setOpen(next)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("brews.snapshot.confirmTitle")}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>{t("brews.snapshot.warning")}</p>
            <p>{t("brews.snapshot.entriesRemain")}</p>
            {changedSections.length ? (
              <div>
                <p className="font-medium">{t("brews.snapshot.changedSections")}</p>
                <ul className="list-disc pl-5">{changedSections.map((section) => <li key={section}>{section}</li>)}</ul>
              </div>
            ) : null}
            {error ? <p role="alert" className="text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="secondary" disabled={patch.isPending} onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button disabled={patch.isPending || !differs || sourceQuery.isFetching} onClick={() => void update()}>
              {patch.isPending ? t("saving") : t("brews.snapshot.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
