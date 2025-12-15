"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
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
import RecentLogsForm from "@/components/ispindel/RecentLogsForm";
import { useParams, useRouter } from "next/navigation";

import {
  useHydrometerInfo,
  type Device
} from "@/hooks/reactQuery/useHydrometerInfo";
import { useHydrometerBrews } from "@/hooks/reactQuery/useHydrometerBrews";
import { useHydrometerDeviceMutations } from "@/hooks/reactQuery/useHydrometerDeviceMutations";
import { useDeviceLogs } from "@/hooks/reactQuery/useHydrometerLogs";
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/db/queryKeys";

import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from "@/components/ui/collapsible";
import { ChevronsUpDown } from "lucide-react";

function DevicePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const deviceId = params.deviceId as string;

  const {
    data: hydroInfo,
    isLoading: infoLoading,
    isError: infoError
  } = useHydrometerInfo();

  const device: Device | undefined =
    hydroInfo?.devices?.find((d) => d.id === deviceId) ?? undefined;

  const { startBrew, endBrew, isStarting, isEnding } = useHydrometerBrews();

  const {
    updateCoefficients: updateDeviceCoefficients,
    deleteDevice,
    isUpdatingCoefficients,
    isDeletingDevice
  } = useHydrometerDeviceMutations();

  const [coefficients, setCoefficients] = useState<string[]>(["", "", "", ""]);
  const [showTable, setShowTable] = useState(false);
  const [fileName, setFileName] = useState("");

  if (
    device &&
    device.coefficients &&
    device.coefficients.length === 4 &&
    coefficients.every((c) => c === "")
  ) {
    setCoefficients(device.coefficients.map((c) => String(c)));
  }

  const [dateRange, setDateRange] = useState(() => {
    const from = new Date();
    const to = new Date();
    from.setDate(from.getDate() - 1);

    const start = new Date(from.setUTCHours(0, 0, 0, 0)).toISOString();
    const end = new Date(to.setUTCHours(23, 59, 59, 999)).toISOString();

    return { start, end };
  });

  const {
    data: deviceLogs = [],
    isLoading: logsLoading,
    isError: logsError
  } = useDeviceLogs({
    deviceId,
    startDate: dateRange.start,
    endDate: dateRange.end
  });

  const updateCoefficients = (index: number, value: string) => {
    setCoefficients((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const validateCoefficients = (arr: string[]) => {
    if (
      arr.length < 4 ||
      arr.some((item) => item === "" || isNaN(Number(item)))
    ) {
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!device) return;

    if (!validateCoefficients(coefficients)) {
      return toast({
        description: t(
          "Please fill in all coefficients with valid number values."
        ),
        variant: "destructive"
      });
    }

    await updateDeviceCoefficients({
      deviceId: device.id,
      coefficients: coefficients.map((c) => Number(c))
    });

    setShowTable(false);
  };

  const brewName = device?.brews?.name ?? null;

  if (infoLoading) {
    return (
      <div className="flex items-center justify-center my-4">
        <p>{t("loading", "Loading…")}</p>
      </div>
    );
  }

  if (infoError || !device) {
    return (
      <div className="flex items-center justify-center my-4">
        <p>
          {t("iSpindelDashboard.deviceError", "Unable to load this device.")}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      {/* Header: device name + start/end brew */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold leading-tight">
            {device.device_name}
          </h2>

          {device.brew_id ? (
            <p className="text-sm text-muted-foreground">
              {t("iSpindelDashboard.activeBrew", "Active brew")}:{" "}
              {brewName ?? t("iSpindelDashboard.unknownBrew", "Unknown")}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("iSpindelDashboard.noActiveBrew", "No active brew")}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!device.brew_id ? (
            <AlertDialog>
              <AlertDialogTrigger
                className={buttonVariants({ variant: "secondary" })}
              >
                {t("iSpindelDashboard.startBrew")}
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
                      placeholder={t(
                        "iSpindelDashboard.brewNamePlaceholder",
                        "Optional brew name"
                      )}
                    />
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <AlertDialogFooter>
                  <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                  <AlertDialogAction asChild>
                    <Button
                      variant="secondary"
                      disabled={isStarting}
                      onClick={async () => {
                        await startBrew(device.id, fileName || null);
                      }}
                    >
                      {isStarting
                        ? t("iSpindelDashboard.starting", "Starting…")
                        : t("iSpindelDashboard.startBrew")}
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant="destructive"
              disabled={isEnding}
              onClick={async () => {
                await endBrew(device.id, device.brew_id);
              }}
            >
              {isEnding
                ? t("iSpindelDashboard.ending", "Ending…")
                : t("iSpindelDashboard.endBrew", { brew_name: brewName })}
            </Button>
          )}
        </div>
      </div>

      {/* Coefficients: not a card; collapsible + separator */}

      <div className="space-y-3">
        <Collapsible open={showTable} onOpenChange={setShowTable}>
          {/* header row */}
          <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="text-center sm:text-left">
              <h3 className="text-lg font-medium">
                {t("iSpindelDashboard.coefficients", "Coefficients")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t(
                  "iSpindelDashboard.coefficientsHint",
                  "Update your device coefficients if you’ve calibrated your hydrometer."
                )}
              </p>
            </div>

            <div className="flex justify-center sm:justify-end">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  {t("iSpindelDashboard.updateCoefficients")}
                  <ChevronsUpDown className="h-4 w-4 opacity-70" />
                </Button>
              </CollapsibleTrigger>
            </div>

            {/* content row: spans full width so it doesn’t “float right” */}
            <div className="sm:col-span-2">
              <CollapsibleContent className="mt-2">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="w-full overflow-x-auto rounded-md border border-border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[160px]">
                            {t("iSpindelDashboard.coefficient", "Coefficient")}
                          </TableHead>
                          <TableHead className="min-w-[160px]">
                            {t("iSpindelDashboard.formula", "Formula")}
                          </TableHead>
                        </TableRow>
                      </TableHeader>

                      <TableBody>
                        <TableRow>
                          <TableCell>
                            <Input
                              value={coefficients[0]}
                              onChange={(e) =>
                                updateCoefficients(0, e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            × angle<sup>3</sup> +
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell>
                            <Input
                              value={coefficients[1]}
                              onChange={(e) =>
                                updateCoefficients(1, e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            × angle<sup>2</sup> +
                          </TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell>
                            <Input
                              value={coefficients[2]}
                              onChange={(e) =>
                                updateCoefficients(2, e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell>× angle +</TableCell>
                        </TableRow>

                        <TableRow>
                          <TableCell>
                            <Input
                              value={coefficients[3]}
                              onChange={(e) =>
                                updateCoefficients(3, e.target.value)
                              }
                            />
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={isUpdatingCoefficients}>
                      {isUpdatingCoefficients
                        ? t("saving", "Saving…")
                        : t("Submit")}
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowTable(false)}
                    >
                      {t("Cancel")}
                    </Button>
                  </div>
                </form>
              </CollapsibleContent>
            </div>
          </div>
        </Collapsible>

        <Separator />
      </div>

      {/* Logs: control bar directly above the table */}
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-medium">
            {t("iSpindelDashboard.recentLogs", "Recent logs")}
          </h3>

          {/* Make RecentLogsForm one-line on desktop by fixing its internal layout (see tweak below) */}
          <RecentLogsForm
            deviceId={device.id}
            onRangeChange={({ startISO, endISO }) => {
              setDateRange({ start: startISO, end: endISO });
            }}
          />
        </div>

        {logsLoading && (
          <p className="text-center text-sm">{t("loading", "Loading…")}</p>
        )}

        {logsError && (
          <p className="text-center text-sm text-destructive">
            {t(
              "iSpindelDashboard.logsError",
              "Unable to load logs for this device."
            )}
          </p>
        )}

        <LogTable
          logs={deviceLogs}
          removeLog={(id) => {
            queryClient.setQueryData(
              qk.hydrometerDeviceLogs(deviceId, dateRange.start, dateRange.end),
              (old: any[] | undefined) =>
                (old ?? []).filter((log) => log.id !== id)
            );
          }}
          deviceId={deviceId}
        />
      </div>

      {/* Delete device */}
      <div className="pt-2 flex justify-center sm:justify-end">
        <AlertDialog>
          <AlertDialogTrigger
            className={buttonVariants({ variant: "destructive" })}
          >
            {t("iSpindelDashboard.deleteDevice")}
          </AlertDialogTrigger>

          <AlertDialogContent className="z-[1000] w-11/12 max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("iSpindelDashboard.confirm")}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {t("iSpindelDashboard.deleteDeviceAlert")}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <AlertDialogFooter>
              <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button
                  disabled={isDeletingDevice}
                  onClick={async () => {
                    await deleteDevice(device.id);
                    router.push("/account/hydrometer/devices");
                  }}
                >
                  {isDeletingDevice
                    ? t("iSpindelDashboard.deleting", "Deleting…")
                    : t("iSpindelDashboard.deleteDevice")}
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

export default DevicePage;
