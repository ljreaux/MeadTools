"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

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

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";

import Tooltip from "@/components/Tooltips";
import LogTable from "@/components/ispindel/LogTable";
import {
  HydrometerData,
  TempUnits
} from "@/components/ispindel/HydrometerData";

import { toast } from "@/hooks/use-toast";
import { calcABV } from "@/lib/utils/unitConverter";
import { qk } from "@/lib/db/queryKeys";

import {
  useBrewById,
  useUpdateEmailAlerts,
  useDeleteBrew,
  useUpdateBrewName
} from "@/hooks/reactQuery/useBrews";
import { useBrewLogs } from "@/hooks/reactQuery/useHydrometerLogs";

const transformData = (logs: any[]) => {
  const og = logs[0]?.calculated_gravity || logs[0]?.gravity;
  return logs.map((log) => {
    const sg = log.calculated_gravity || log.gravity;
    const abv = Math.round(calcABV(og, sg) * 1000) / 1000;
    return {
      date: log.datetime,
      temperature: log.temperature,
      gravity: sg,
      battery: log.battery,
      abv: Math.max(abv, 0)
    };
  });
};

function Brew() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation();

  const brewId = (params.brewId as string) || "";

  const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: "short",
    timeStyle: "short"
  });
  const formatDate = (date: Date | string) => formatter.format(new Date(date));

  const { brew, isLoading, isError } = useBrewById(brewId);

  const {
    data: logs = [],
    isLoading: logsLoading,
    isError: logsError
  } = useBrewLogs(brewId);

  const { mutateAsync: updateEmailAlerts, isPending: isUpdatingEmail } =
    useUpdateEmailAlerts();
  const { mutateAsync: deleteBrew, isPending: isDeleting } = useDeleteBrew();
  const { mutateAsync: updateBrewName, isPending: isRenaming } =
    useUpdateBrewName();

  const [renameOpen, setRenameOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleUpdateBrewName = async () => {
    if (!brew || !fileName.trim()) return;

    try {
      await updateBrewName({ brewId: brew.id, name: fileName.trim() });
      toast({ description: t("log.updated") });
      setFileName("");
      setRenameOpen(false);
    } catch (error) {
      console.error("Error updating brew name:", error);
      toast({
        description: t("error.generic"),
        variant: "destructive"
      });
    }
  };

  const handleDeleteBrew = async () => {
    if (!brew) return;

    try {
      await deleteBrew(brew.id);
      router.replace("/account/hydrometer/brews");
    } catch (error) {
      console.error("Error deleting brew:", error);
      toast({
        description: t("error.generic"),
        variant: "destructive"
      });
    }
  };

  // Initial load skeleton (brew missing)
  if (isLoading && !brew) {
    return (
      <div className="w-full space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-[260px] sm:w-[340px]" />
            <Skeleton className="h-4 w-[220px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-[160px]" />
            <Skeleton className="h-9 w-[160px]" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-5 w-[220px]" />
          <Skeleton className="h-6 w-10 rounded-full" />
        </div>

        <Separator />

        <HydrometerData chartData={[]} tempUnits={"F"} loading />

        <div className="space-y-2 min-w-0">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="space-y-2">
              <Skeleton className="h-6 w-[160px]" />
              <Skeleton className="h-4 w-[260px]" />
            </div>
            <div className="flex justify-center sm:justify-end">
              <Skeleton className="h-9 w-[160px]" />
            </div>
            <div className="sm:col-span-2 min-w-0 pt-2">
              <div className="w-full max-w-full min-w-0">
                <LogTable
                  logs={[]}
                  loading
                  skeletonRows={5}
                  removeLog={() => {}}
                  deviceId=""
                />
              </div>
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-center sm:justify-end">
          <Skeleton className="h-9 w-[170px]" />
        </div>
      </div>
    );
  }

  if (isError || !brew) {
    return (
      <div className="flex items-center justify-center my-4">
        <p>{t("iSpindelDashboard.brewError")}</p>
      </div>
    );
  }

  const chartData = logs.length > 0 ? transformData(logs) : [];
  const tableLogs = logsLoading ? [] : [...logs].reverse();

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold leading-tight">
            {brew.name?.trim()
              ? brew.name
              : t("iSpindelDashboard.brews.details")}
          </h2>

          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {t("iSpindelDashboard.brews.startTime")}{" "}
              {formatDate(brew.start_date)}
            </p>
            {brew.end_date && (
              <p>
                {t("iSpindelDashboard.brews.endTime")}{" "}
                {formatDate(brew.end_date)}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!brew.name && (
            <AlertDialog open={renameOpen} onOpenChange={setRenameOpen}>
              <AlertDialogTrigger
                className={buttonVariants({ variant: "secondary" })}
              >
                {t("iSpindelDashboard.addBrewName")}
              </AlertDialogTrigger>

              <AlertDialogContent className="z-[1000] w-11/12 max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("iSpindelDashboard.addBrewName")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="flex flex-col gap-2">
                    <Input
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder={t("iSpindelDashboard.brewNamePlaceholder")}
                    />
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      variant="secondary"
                      disabled={isRenaming}
                      onClick={handleUpdateBrewName}
                    >
                      {isRenaming
                        ? t("saving", "Saving…")
                        : t("iSpindelDashboard.addBrewName")}
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {brew.recipe_id ? (
            <Link
              href={`/recipes/${brew.recipe_id}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              {t("iSpindelDashboard.brews.open")}
            </Link>
          ) : (
            <Link
              href={`/account/hydrometer/link/${brewId}`}
              className={buttonVariants({ variant: "secondary" })}
            >
              {t("iSpindelDashboard.brews.link")}
            </Link>
          )}
        </div>
      </div>

      {/* Email alerts */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <p className="text-sm font-medium">
            {t("iSpindelDashboard.receiveEmailAlerts")}
          </p>
          <Tooltip body={t("tipText.emailAlerts")} />
        </div>

        <Switch
          checked={brew.requested_email_alerts}
          disabled={isUpdatingEmail}
          onCheckedChange={async (val: boolean) => {
            try {
              await updateEmailAlerts({ brewId: brew.id, requested: val });

              const msg = val
                ? t("emailAlerts.enabled")
                : t("emailAlerts.disabled");

              toast({ description: msg });
            } catch {
              toast({
                description: t("error.generic"),
                variant: "destructive"
              });
            }
          }}
        />
      </div>

      <Separator />

      {/* Chart: now component-owned loading */}
      <HydrometerData
        loading={logsLoading}
        chartData={chartData}
        name={brew.name?.trim() ? brew.name : undefined}
        tempUnits={(logs[0]?.temp_units as TempUnits) || "F"}
      />

      {/* Logs */}
      <div className="space-y-2 min-w-0">
        <Collapsible open={logsOpen} onOpenChange={setLogsOpen}>
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="text-center sm:text-left">
              <h3 className="text-lg font-medium">
                {t("iSpindelDashboard.recentLogs", "Recent logs")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("iSpindelDashboard.brewLogsHint")}
              </p>
            </div>

            <div className="flex justify-center sm:justify-end">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  {t("iSpindelDashboard.brews.showLogs")}
                  <ChevronsUpDown className="h-4 w-4 opacity-70" />
                </Button>
              </CollapsibleTrigger>
            </div>

            <div className="sm:col-span-2 min-w-0">
              <CollapsibleContent className="pt-2 space-y-2 min-w-0">
                {!logsLoading && logsError && (
                  <p className="text-center text-sm text-destructive">
                    {t("iSpindelDashboard.logsError")}
                  </p>
                )}

                <div className="w-full max-w-full min-w-0">
                  <LogTable
                    logs={tableLogs}
                    loading={logsLoading}
                    skeletonRows={5}
                    removeLog={(id) => {
                      queryClient.setQueryData(
                        qk.hydrometerBrewLogs(brewId),
                        (old: any[] | undefined) =>
                          (old ?? []).filter((log) => log.id !== id)
                      );
                    }}
                    deviceId={logs[0]?.device_id || ""}
                  />
                </div>
              </CollapsibleContent>
            </div>
          </div>
        </Collapsible>
      </div>

      {/* Delete */}
      <div className="pt-2 flex justify-center sm:justify-end">
        <AlertDialog>
          <AlertDialogTrigger
            className={buttonVariants({ variant: "destructive" })}
          >
            {t("iSpindelDashboard.deleteBrew")}
          </AlertDialogTrigger>

          <AlertDialogContent className="z-[1000] w-11/12 max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("iSpindelDashboard.confirm")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("iSpindelDashboard.deleteBrewAlert")}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button onClick={handleDeleteBrew} disabled={isDeleting}>
                  {isDeleting
                    ? t("iSpindelDashboard.deleting")
                    : t("iSpindelDashboard.deleteBrew")}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default Brew;
