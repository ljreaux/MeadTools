"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
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
import { useState } from "react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  useHydrometerInfo,
  type Device
} from "@/hooks/reactQuery/useHydrometerInfo";
import { useHydrometerBrews } from "@/hooks/reactQuery/useHydrometerBrews";

function Devices() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useHydrometerInfo();

  const deviceList: Device[] = data?.devices ?? [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center my-4">
        <p>{t("loading", "Loading…")}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center my-4">
        <p>{t("error.generic", "Something went wrong loading devices.")}</p>
      </div>
    );
  }

  if (!deviceList || deviceList.length === 0) {
    return (
      <div className="flex items-center justify-center my-4">
        <p>{t("noDevices")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4 my-4 text-center">
      <div className="flex gap-2 flex-wrap justify-center">
        {deviceList.map((dev) =>
          dev ? <DeviceCard device={dev} key={dev.id} /> : null
        )}
      </div>
    </div>
  );
}

export default Devices;

const DeviceCard = ({ device }: { device: Device }) => {
  const { t } = useTranslation();
  const [fileName, setFileName] = useState("");

  const { startBrew, endBrew, isStarting, isEnding } = useHydrometerBrews();

  const updateFileName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(e.target.value);
  };

  // Name for the active brew from the joined relation
  const brewName = device.brews?.name ?? null;

  const handleStart = async () => {
    await startBrew(device.id, fileName || null);
    setFileName("");
  };

  const handleEnd = async () => {
    await endBrew(device.id, device.brew_id);
  };

  return (
    <div className="flex flex-col gap-2 border rounded-lg p-3">
      <h2 className="font-semibold">
        {device.device_name ?? t("unnamedDevice", "Unnamed device")}
      </h2>

      <div className="grid gap-1">
        <Link
          className={buttonVariants({ variant: "secondary" })}
          href={`/account/hydrometer/devices/${device.id}`}
        >
          {t("iSpindelDashboard.deviceDetails")}
        </Link>

        {!device.brew_id ? (
          <AlertDialog>
            <AlertDialogTrigger
              className={buttonVariants({ variant: "secondary" })}
              disabled={isStarting}
            >
              {isStarting
                ? t("iSpindelDashboard.startBrew.loading", "Starting…")
                : t("iSpindelDashboard.startBrew")}
            </AlertDialogTrigger>
            <AlertDialogContent className="z-[1000] w-11/12 max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("iSpindelDashboard.addBrewName")}
                </AlertDialogTitle>
                <AlertDialogDescription className="flex flex-col gap-2">
                  <Input
                    value={fileName}
                    onChange={updateFileName}
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
                    onClick={handleStart}
                    disabled={isStarting}
                  >
                    {isStarting
                      ? t("iSpindelDashboard.startBrew.loading", "Starting…")
                      : t("iSpindelDashboard.startBrew")}
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <Button variant="destructive" onClick={handleEnd} disabled={isEnding}>
            {isEnding
              ? t("iSpindelDashboard.endBrew.loading", "Ending…")
              : t("iSpindelDashboard.endBrew", {
                  brew_name:
                    brewName ?? t("iSpindelDashboard.unknownBrew", "your brew")
                })}
          </Button>
        )}
      </div>
    </div>
  );
};
