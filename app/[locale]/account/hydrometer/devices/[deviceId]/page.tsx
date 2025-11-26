"use client";

import { useEffect, useState } from "react";
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

// Transitional: still using provider for logs only
import { useISpindel } from "@/components/providers/ISpindelProvider";

// New hooks
import {
  useHydrometerInfo,
  type Device
} from "@/hooks/reactQuery/useHydrometerInfo";
import { useHydrometerBrews } from "@/hooks/reactQuery/useHydrometerBrews";
import { useHydrometerDeviceMutations } from "@/hooks/reactQuery/useHydrometerDeviceMutations";

function DevicePage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useTranslation();

  const deviceId = params.deviceId as string;

  // --- Device + brew info ---
  const {
    data: hydroInfo,
    isLoading: infoLoading,
    isError: infoError
  } = useHydrometerInfo();

  const device: Device | undefined =
    hydroInfo?.devices?.find((d) => d.id === deviceId) ?? undefined;

  // --- Start / end brew mutations ---
  const { startBrew, endBrew, isStarting, isEnding } = useHydrometerBrews();

  // --- Device-level mutations (coeffs + delete) ---
  const {
    updateCoefficients: updateDeviceCoefficients,
    deleteDevice,
    isUpdatingCoefficients,
    isDeletingDevice
  } = useHydrometerDeviceMutations();

  // --- Transitional: logs still from provider ---
  const { fetchLogs, logs, setLogs } = useISpindel();

  const [coefficients, setCoefficients] = useState<string[]>(["", "", "", ""]);
  const [showTable, setShowTable] = useState(false);
  const [fileName, setFileName] = useState("");

  // Initialize coefficients from device
  useEffect(() => {
    if (device?.coefficients && device.coefficients.length === 4) {
      setCoefficients(device.coefficients.map((c) => String(c)));
    }
  }, [device]);

  // Initial logs fetch (last 24h)
  useEffect(() => {
    const from = new Date();
    const to = new Date();
    from.setDate(from.getDate() - 1);

    const start_date = new Date(from.setUTCHours(0, 0, 0, 0)).toISOString();
    const end_date = new Date(to.setUTCHours(23, 59, 59, 999)).toISOString();

    fetchLogs(start_date, end_date, deviceId).then((logsRes) => {
      if (logsRes) setLogs(logsRes);
    });
  }, [deviceId]);

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

  // --- NEW: Submit coefficients using the mutation hook ---
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
    <div className="w-full">
      <div className="grid items-center justify-center sm:grid-cols-2">
        {/* Device name + start/end brew */}
        <div className="flex flex-col items-center justify-center gap-4 my-2">
          <p>{device.device_name}</p>

          {!device.brew_id ? (
            <AlertDialog>
              <AlertDialogTrigger
                className={buttonVariants({ variant: "secondary" })}
              >
                {t("iSpindelDashboard.startBrew")}
              </AlertDialogTrigger>
              <AlertDialogContent className="z-[1000] w-11/12">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("iSpindelDashboard.addBrewName")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    <Input
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
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

        {/* Coefficients editor */}
        <div className="flex flex-col items-center justify-center sm:col-start-1">
          {showTable ? (
            <form onSubmit={handleSubmit}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Coefficient</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>
                      <Input
                        value={coefficients[0]}
                        onChange={(e) => updateCoefficients(0, e.target.value)}
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
                        onChange={(e) => updateCoefficients(1, e.target.value)}
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
                        onChange={(e) => updateCoefficients(2, e.target.value)}
                      />
                    </TableCell>
                    <TableCell>× angle +</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Input
                        value={coefficients[3]}
                        onChange={(e) => updateCoefficients(3, e.target.value)}
                      />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <div className="mt-2 flex gap-2">
                <Button type="submit" disabled={isUpdatingCoefficients}>
                  {isUpdatingCoefficients
                    ? t("saving", "Saving…")
                    : t("Submit")}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowTable(false)}
                >
                  {t("Cancel")}
                </Button>
              </div>
            </form>
          ) : (
            <Button onClick={() => setShowTable(true)}>
              {t("iSpindelDashboard.updateCoefficients")}
            </Button>
          )}
        </div>

        <RecentLogsForm deviceId={device.id} />
      </div>

      <div className="max-w-full mt-4">
        <LogTable
          logs={logs}
          removeLog={(id) => setLogs(logs.filter((log: any) => log.id !== id))}
          deviceId={deviceId}
        />
      </div>

      {/* Delete device */}
      <AlertDialog>
        <AlertDialogTrigger
          className={buttonVariants({ variant: "destructive" })}
        >
          {t("iSpindelDashboard.deleteDevice")}
        </AlertDialogTrigger>
        <AlertDialogContent className="z-[1000] w-11/12">
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
  );
}

export default DevicePage;
