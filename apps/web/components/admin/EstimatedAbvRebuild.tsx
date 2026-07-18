"use client";

import { useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";

type Scope = "brew" | "all";

type RebuildResult = {
  total: number;
  processed: number;
  nextCursor: string | null;
};

export function EstimatedAbvRebuild() {
  const { t } = useTranslation();
  const fetchWithAuth = useFetchWithAuth();
  const [scope, setScope] = useState<Scope>("brew");
  const [brewId, setBrewId] = useState("");
  const [preview, setPreview] = useState<RebuildResult | null>(null);
  const [progress, setProgress] = useState<{ processed: number; total: number } | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = (body: Record<string, unknown>) =>
    fetchWithAuth<RebuildResult>("/api/admin/maintenance/rebuild-estimated-abv", {
      method: "POST",
      body: JSON.stringify(body)
    });

  async function previewRebuild() {
    setIsPreviewing(true);
    setError(null);
    setProgress(null);
    setIsComplete(false);
    try {
      const result = await request({ scope, brewId, dryRun: true });
      setPreview(result);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : t("error.generic", "Something went wrong."));
    } finally {
      setIsPreviewing(false);
    }
  }

  async function rebuild() {
    if (!preview) return;

    setIsConfirmOpen(false);
    setIsRunning(true);
    setError(null);
    setIsComplete(false);

    let processed = 0;
    let cursor: string | null = null;
    try {
      do {
        const result = await request({ scope, brewId, cursor });
        processed += result.processed;
        cursor = result.nextCursor;
        setProgress({ processed, total: result.total });
      } while (cursor);
      setPreview(null);
      setIsComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.maintenance.estimatedAbv.failed", "Could not rebuild estimated ABV entries."));
    } finally {
      setIsRunning(false);
    }
  }

  function changeScope(nextScope: Scope) {
    setScope(nextScope);
    setPreview(null);
    setProgress(null);
    setIsComplete(false);
    setError(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin.maintenance.estimatedAbv.title", "Rebuild estimated ABV")}</CardTitle>
        <CardDescription>
          {t(
            "admin.maintenance.estimatedAbv.description",
            "Recreates derived estimated-ABV timeline entries from each brew's current history. It does not modify logged brew data."
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap gap-2" aria-label={t("admin.maintenance.estimatedAbv.title", "Rebuild estimated ABV")}>
          <Button type="button" variant={scope === "brew" ? "default" : "outline"} onClick={() => changeScope("brew")} disabled={isPreviewing || isRunning}>
            {t("admin.maintenance.estimatedAbv.scopeBrew", "One brew")}
          </Button>
          <Button type="button" variant={scope === "all" ? "default" : "outline"} onClick={() => changeScope("all")} disabled={isPreviewing || isRunning}>
            {t("admin.maintenance.estimatedAbv.scopeAll", "All brews")}
          </Button>
        </div>

        {scope === "brew" ? (
          <div className="grid gap-2">
            <Label htmlFor="estimated-abv-brew-id">
              {t("admin.maintenance.estimatedAbv.brewId", "Brew ID")}
            </Label>
            <Input id="estimated-abv-brew-id" value={brewId} onChange={(event) => { setBrewId(event.target.value); setPreview(null); }} placeholder="00000000-0000-0000-0000-000000000000" disabled={isPreviewing || isRunning} />
            <p className="text-sm text-muted-foreground">
              {t("admin.maintenance.estimatedAbv.brewIdHelp", "Paste the brew ID to rebuild only that brew.")}
            </p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {preview ? (
          <p className="text-sm text-muted-foreground">
            {t("admin.maintenance.estimatedAbv.ready", "Ready to rebuild {{count}} brew estimate entries.", { count: preview.total })}
          </p>
        ) : null}
        {progress ? (
          <p className="text-sm text-muted-foreground">
            {t("admin.maintenance.estimatedAbv.progress", "Rebuilt {{processed}} of {{total}} brews.", progress)}
          </p>
        ) : null}
        {isComplete ? (
          <p className="text-sm text-green-700 dark:text-green-400">
            {t(
              "admin.maintenance.estimatedAbv.complete",
              "Estimated ABV entries rebuilt."
            )}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={previewRebuild} disabled={isPreviewing || isRunning || (scope === "brew" && !brewId.trim())}>
            {isPreviewing ? <LoaderCircle className="animate-spin" /> : null}
            {t("admin.maintenance.estimatedAbv.preview", "Preview")}
          </Button>
          <Button type="button" onClick={() => setIsConfirmOpen(true)} disabled={!preview || preview.total === 0 || isPreviewing || isRunning}>
            {isRunning ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            {t("admin.maintenance.estimatedAbv.rebuild", "Rebuild estimates")}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.maintenance.estimatedAbv.confirmTitle", "Rebuild estimated ABV entries?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "admin.maintenance.estimatedAbv.confirmDescription",
                "This will replace derived estimated-ABV entries for {{count}} brews. Logged volumes, additions, and measurements will remain unchanged.",
                { count: preview?.total ?? 0 }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRunning}>{t("cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={rebuild} disabled={isRunning}>
              {t("admin.maintenance.estimatedAbv.rebuild", "Rebuild estimates")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
