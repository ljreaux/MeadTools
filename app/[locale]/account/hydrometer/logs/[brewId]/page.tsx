"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { toast } from "@/hooks/use-toast";
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
import LogTable from "@/components/ispindel/LogTable";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { ArrowDownUp } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import {
  HydrometerData,
  TempUnits
} from "@/components/ispindel/HydrometerData";
import { calcABV } from "@/lib/utils/unitConverter";
import Tooltip from "@/components/Tooltips";
import { Switch } from "@/components/ui/switch";
import {
  useBrewById,
  useUpdateEmailAlerts,
  useDeleteBrew,
  useUpdateBrewName
} from "@/hooks/reactQuery/useBrews";
import { useBrewLogs } from "@/hooks/reactQuery/useHydrometerLogs";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/db/queryKeys";

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
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: "short",
    timeStyle: "short"
  });
  const formatDate = (date: Date | string) => formatter.format(new Date(date));

  const brewId = (params.brewId as string) || "";

  // Single brew from React Query cache + fetch
  const { brew, isLoading, isError } = useBrewById(brewId);

  // Logs for this brew (React Query)
  const {
    data: logs = [],
    isLoading: logsLoading,
    isError: logsError
  } = useBrewLogs(brewId);

  // Mutations
  const { mutateAsync: updateEmailAlerts, isPending: isUpdatingEmail } =
    useUpdateEmailAlerts();
  const { mutateAsync: deleteBrew, isPending: isDeleting } = useDeleteBrew();
  const { mutateAsync: updateBrewName, isPending: isRenaming } =
    useUpdateBrewName();

  const [isOpen, setIsOpen] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(e.target.value);
  };

  const handleUpdateBrewName = async () => {
    if (!brew || !fileName.trim()) return;

    try {
      await updateBrewName({ brewId: brew.id, name: fileName });
      toast({ description: t("Brew name updated successfully.") });
    } catch (error) {
      console.error("Error updating brew name:", error);
      toast({
        description: t("Failed to update brew name."),
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
        description: t("Failed to delete brew."),
        variant: "destructive"
      });
    }
  };

  if (isLoading && !brew) {
    return (
      <div className="flex items-center justify-center my-4">
        <p>{t("loading", "Loading…")}</p>
      </div>
    );
  }

  if (isError || !brew) {
    return (
      <div className="flex items-center justify-center my-4">
        <p>{t("iSpindelDashboard.brewError", "Unable to load this brew.")}</p>
      </div>
    );
  }

  const chartData = logs.length > 0 ? transformData(logs) : [];

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full p-4 m-4">
        <h1>{t("iSpindelDashboard.brews.details")}:</h1>

        <div>
          {brew.name ? (
            <p>Name: {brew.name}</p>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger
                className={buttonVariants({ variant: "secondary" })}
              >
                {t("iSpindelDashboard.addBrewName")}
              </AlertDialogTrigger>
              <AlertDialogContent className="z-[1000] w-11/12">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("iSpindelDashboard.addBrewName")}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="flex flex-col gap-2">
                    <Input value={fileName} onChange={handleFileNameChange} />
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      variant={"secondary"}
                      disabled={isRenaming}
                      onClick={handleUpdateBrewName}
                    >
                      {t("iSpindelDashboard.addBrewName")}
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {brew && (
            <>
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
            </>
          )}
        </div>

        <div className="flex gap-2 items-center">
          <div className="flex">
            <p>{t("iSpindelDashboard.receiveEmailAlerts")}</p>
            <Tooltip body={t("tipText.emailAlerts")} />
          </div>
          <Switch
            checked={brew.requested_email_alerts}
            disabled={isUpdatingEmail}
            onCheckedChange={async (val: boolean) => {
              if (!brew) return;
              try {
                await updateEmailAlerts({
                  brewId: brew.id,
                  requested: val
                });

                const msg = val
                  ? "You will receive email alerts for this brew."
                  : "You will no longer receive email alerts for this brew.";

                toast({ description: msg });
              } catch {
                toast({
                  description: "Something went wrong",
                  variant: "destructive"
                });
              }
            }}
          />
        </div>

        {brew.recipe_id ? (
          <Button asChild className={buttonVariants({ variant: "default" })}>
            <a href={`/recipes/${brew.recipe_id}`}>
              {t("iSpindelDashboard.brews.open")}
            </a>
          </Button>
        ) : (
          <Button asChild className={buttonVariants({ variant: "default" })}>
            <a href={`/account/hydrometer/link/${brewId}`}>
              {t("iSpindelDashboard.brews.link")}
            </a>
          </Button>
        )}
      </div>

      {/* Chart */}
      {logs.length > 0 && (
        <HydrometerData
          chartData={chartData}
          tempUnits={logs[0]?.temp_units as TempUnits}
        />
      )}

      {/* Logs table */}
      <div className="max-w-full">
        {logsLoading && (
          <p className="text-center text-sm mb-2">{t("loading", "Loading…")}</p>
        )}
        {logsError && (
          <p className="text-center text-sm mb-2 text-destructive">
            {t(
              "iSpindelDashboard.logsError",
              "Unable to load logs for this brew."
            )}
          </p>
        )}

        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex items-center justify-center">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <h3>{t("iSpindelDashboard.brews.showLogs")}</h3>
                <ArrowDownUp className="w-4 h-4" />
                <span className="sr-only">Toggle</span>
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="max-w-full">
            <LogTable
              logs={[...logs].reverse()}
              removeLog={(id) => {
                queryClient.setQueryData(
                  qk.hydrometerBrewLogs(brewId),
                  (old: any[] | undefined) =>
                    (old ?? []).filter((log) => log.id !== id)
                );
              }}
              deviceId={logs[0]?.device_id || ""}
            />
          </CollapsibleContent>
        </Collapsible>

        <AlertDialog>
          <AlertDialogTrigger
            className={buttonVariants({ variant: "destructive" })}
          >
            {t("iSpindelDashboard.deleteBrew")}
          </AlertDialogTrigger>
          <AlertDialogContent className="z-[1000] w-11/12">
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
                  {t("iSpindelDashboard.deleteBrew")}
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
