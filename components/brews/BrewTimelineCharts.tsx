"use client";

import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";

import type {
  AccountBrewEntry,
  AccountBrewLinkedDevice
} from "@/hooks/reactQuery/useAccountBrews";
import {
  useLinkHydrometerDeviceToAccountBrew,
  useUnlinkHydrometerDeviceFromAccountBrew
} from "@/hooks/reactQuery/useAccountBrews";
import { useHydrometerInfo, type Device } from "@/hooks/reactQuery/useHydrometerInfo";
import { useBrewLogs, type Log } from "@/hooks/reactQuery/useHydrometerLogs";
import {
  HydrometerData,
  type HydrometerChartData,
  type TempUnits
} from "@/components/ispindel/HydrometerData";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { BREW_ENTRY_TYPE } from "@/lib/brewEnums";
import { calcABV } from "@/lib/utils/unitConverter";

function getTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getManualTemperatureUnits(entries: AccountBrewEntry[]): TempUnits {
  const entryUnits = entries.find(
    (entry) =>
      entry.type === BREW_ENTRY_TYPE.TEMPERATURE &&
      isFiniteNumber(entry.temperature) &&
      (entry.temp_units === "F" || entry.temp_units === "C" || entry.temp_units === "K")
  )?.temp_units;

  if (entryUnits === "F" || entryUnits === "C" || entryUnits === "K") {
    return entryUnits;
  }

  return "F";
}

function getWirelessTemperatureUnits(logs: Log[]): TempUnits {
  const logUnits = logs.find(
    (log) => log.temp_units === "F" || log.temp_units === "C" || log.temp_units === "K"
  )?.temp_units;

  return logUnits ?? "F";
}

export function buildManualBrewChartData(entries: AccountBrewEntry[]): HydrometerChartData[] {
  const points: HydrometerChartData[] = [];

  for (const entry of entries) {
    if (!entry.datetime || !getTime(entry.datetime)) continue;

    const data = entry.data as {
      hidden?: unknown;
      source?: unknown;
      abvEstimate?: { abv?: unknown };
      ph?: unknown;
      liters?: unknown;
    } | null;

    if (data?.source === "abv_estimate") {
      const abv = isFiniteNumber(data.abvEstimate?.abv) ? data.abvEstimate.abv : entry.gravity;
      if (isFiniteNumber(abv)) {
        points.push({
          date: entry.datetime,
          abv
        });
      }
      continue;
    }

    if (data?.hidden) continue;

    if (entry.type === BREW_ENTRY_TYPE.GRAVITY && isFiniteNumber(entry.gravity)) {
      points.push({
        date: entry.datetime,
        gravity: entry.gravity
      });
    }

    if (entry.type === BREW_ENTRY_TYPE.TEMPERATURE && isFiniteNumber(entry.temperature)) {
      points.push({
        date: entry.datetime,
        temperature: entry.temperature
      });
    }

    const ph = data?.ph;
    if (entry.type === BREW_ENTRY_TYPE.PH && isFiniteNumber(ph)) {
      points.push({
        date: entry.datetime,
        ph
      });
    }

    const liters = data?.liters;
    if (entry.type === BREW_ENTRY_TYPE.VOLUME && isFiniteNumber(liters)) {
      points.push({
        date: entry.datetime,
        volume: liters
      });
    }
  }

  return points
    .filter(
      (point) =>
        isFiniteNumber(point.gravity) ||
        isFiniteNumber(point.abv) ||
        isFiniteNumber(point.temperature) ||
        isFiniteNumber(point.ph) ||
        isFiniteNumber(point.volume)
    )
    .sort((a, b) => getTime(a.date) - getTime(b.date));
}

export function buildWirelessHydrometerChartData(logs: Log[]): HydrometerChartData[] {
  const points: HydrometerChartData[] = [];
  const sortedLogs = [...logs].sort((a, b) => getTime(a.datetime) - getTime(b.datetime));
  const deviceOriginalGravity = sortedLogs
    .map((log) => (isFiniteNumber(log.calculated_gravity) ? log.calculated_gravity : log.gravity))
    .find(isFiniteNumber);

  for (const log of sortedLogs) {
    if (!log.datetime || !getTime(log.datetime)) continue;

    const gravity = isFiniteNumber(log.calculated_gravity)
      ? log.calculated_gravity
      : log.gravity;
    const abv =
      isFiniteNumber(deviceOriginalGravity) && isFiniteNumber(gravity)
        ? Math.round(calcABV(deviceOriginalGravity, gravity) * 1000) / 1000
        : null;

    points.push({
      date: log.datetime,
      gravity: isFiniteNumber(gravity) ? gravity : undefined,
      temperature: isFiniteNumber(log.temperature) ? log.temperature : undefined,
      battery: isFiniteNumber(log.battery) ? log.battery : undefined,
      ...(isFiniteNumber(abv) ? { abv: Math.max(abv, 0) } : {})
    });
  }

  return points
    .filter(
      (point) =>
        isFiniteNumber(point.gravity) ||
        isFiniteNumber(point.temperature) ||
        isFiniteNumber(point.battery)
    )
    .sort((a, b) => getTime(a.date) - getTime(b.date));
}

export function BrewTimelineCharts({
  brewId,
  entries,
  linkedDevices
}: {
  brewId: string;
  entries: AccountBrewEntry[];
  linkedDevices: AccountBrewLinkedDevice[];
}) {
  const { t } = useTranslation();
  const { data: logs = [], isLoading: logsLoading } = useBrewLogs(brewId);

  const manualChartData = useMemo(() => buildManualBrewChartData(entries), [entries]);
  const wirelessChartData = useMemo(() => buildWirelessHydrometerChartData(logs), [logs]);
  const manualTempUnits = useMemo(() => getManualTemperatureUnits(entries), [entries]);
  const wirelessTempUnits = useMemo(() => getWirelessTemperatureUnits(logs), [logs]);

  return (
    <div className="space-y-4">
      <HydrometerLinkPanel
        brewId={brewId}
        linkedDevices={linkedDevices}
        logs={logs}
        logsLoading={logsLoading}
      />

      {logsLoading || wirelessChartData.length ? (
        <ChartSection title={t("brews.charts.wirelessTitle", "Wireless hydrometer readings")}>
          <HydrometerData
            chartData={wirelessChartData}
            tempUnits={wirelessTempUnits}
            loading={logsLoading}
            name={t("brews.charts.wirelessTitle", "Wireless hydrometer readings")}
          />
        </ChartSection>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {t(
            "brews.charts.noWirelessReadings",
            "No wireless hydrometer readings are associated with this brew."
          )}
        </div>
      )}

      {manualChartData.length ? (
        <ChartSection title={t("brews.charts.manualTitle", "Manual timeline readings")}>
          <HydrometerData
            chartData={manualChartData}
            tempUnits={manualTempUnits}
            name={t("brews.charts.manualTitle", "Manual timeline readings")}
          />
        </ChartSection>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
          {t(
            "brews.charts.noManualReadings",
            "No manual gravity, temperature, or pH readings have been logged yet."
          )}
        </div>
      )}
    </div>
  );
}

function ChartSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Accordion type="single" defaultValue="chart" collapsible>
      <AccordionItem value="chart">
        <AccordionTrigger>{title}</AccordionTrigger>
        <AccordionContent>{children}</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function HydrometerLinkPanel({
  brewId,
  linkedDevices,
  logs,
  logsLoading
}: {
  brewId: string;
  linkedDevices: AccountBrewLinkedDevice[];
  logs: Log[];
  logsLoading: boolean;
}) {
  const { t } = useTranslation();
  const { data: hydrometerInfo, isLoading } = useHydrometerInfo();
  const linkDevice = useLinkHydrometerDeviceToAccountBrew();
  const unlinkDevice = useUnlinkHydrometerDeviceFromAccountBrew();
  const devices = hydrometerInfo?.devices ?? [];
  const linkableDevices = devices.filter((device) => !device.brew_id);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const selectedDevice = linkableDevices.find((device) => device.id === selectedDeviceId);
  const hasActiveLinkedDevice = linkedDevices.length > 0;
  const linkedNames = linkedDevices.map((device) => device.device_name || device.id).join(", ");
  const logDeviceIds = Array.from(new Set(logs.map((log) => log.device_id).filter(Boolean)));
  const logDeviceNames = logDeviceIds.map((deviceId) => {
    const device = devices.find((item) => item.id === deviceId);
    return device?.device_name || deviceId;
  });
  const logDeviceLabel = logDeviceNames.join(", ");
  const hasWirelessBrew = hasActiveLinkedDevice || logs.length > 0;
  const linkedDevice = linkedDevices[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("brews.charts.hydrometerLinkTitle", "Wireless hydrometer")}</CardTitle>
        <CardDescription className="space-y-1">
          <span className="block">
            {linkedDevices.length
              ? t("brews.charts.activeLinkedDevices", "Active device: {{devices}}", {
                  devices: linkedNames
                })
              : t("brews.charts.noActiveLinkedDevice", "No active wireless hydrometer device is attached to this brew.")}
          </span>
          {logDeviceNames.length ? (
            <span className="block">
              {t(
                "brews.charts.historicalWirelessLogs",
                "Wireless logs are associated with this brew from: {{devices}}.",
                { devices: logDeviceLabel }
              )}
            </span>
          ) : null}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {hasWirelessBrew ? (
          <>
            <Button variant="secondary" asChild>
              <Link href={`/account/hydrometer/logs/${brewId}`}>
                {t("brews.charts.openHydrometerBrew", "Open hydrometer brew")}
              </Link>
            </Button>

            {linkedDevice ? (
              <Button
                type="button"
                variant="destructive"
                disabled={unlinkDevice.isPending}
                onClick={async () => {
                  try {
                    await unlinkDevice.mutateAsync({
                      brewId,
                      deviceId: linkedDevice.id
                    });
                    toast({
                      description: t(
                        "brews.charts.unlinkedHydrometerToast",
                        "Hydrometer unlinked. Existing wireless logs remain with this brew."
                      )
                    });
                  } catch (error) {
                    console.error(error);
                    toast({
                      description: t("error", "Something went wrong."),
                      variant: "destructive"
                    });
                  }
                }}
              >
                {unlinkDevice.isPending
                  ? t("brews.charts.unlinkingHydrometer", "Unlinking...")
                  : t("brews.charts.unlinkHydrometer", "Unlink hydrometer")}
              </Button>
            ) : null}
          </>
        ) : logsLoading ? (
          <div className="text-sm text-muted-foreground">
            {t("brews.charts.checkingWirelessBrew", "Checking wireless hydrometer status...")}
          </div>
        ) : (
          <>
            <Select
              value={selectedDeviceId}
              onValueChange={setSelectedDeviceId}
              disabled={isLoading || linkDevice.isPending || !linkableDevices.length}
            >
              <SelectTrigger className="w-full sm:max-w-md">
                <SelectValue
                  placeholder={
                    linkableDevices.length
                      ? t("brews.charts.selectDevice", "Select a hydrometer device")
                      : t("brews.charts.noAvailableDevices", "No available hydrometer devices")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {linkableDevices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {formatDeviceOption(device, brewId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              disabled={!selectedDevice || linkDevice.isPending}
              onClick={async () => {
                if (!selectedDevice) return;
                try {
                  const result = await linkDevice.mutateAsync({
                    brewId,
                    deviceId: selectedDevice.id
                  });
                  toast({
                    description:
                      result.adopted_count > 0
                        ? t(
                            "brews.charts.linkedHydrometerToast",
                            "Linked hydrometer and adopted {{count}} log entries.",
                            { count: result.adopted_count }
                          )
                        : t(
                            "brews.charts.linkedHydrometerNoLogsToast",
                            "Linked hydrometer. New readings will appear here as they are recorded."
                          )
                  });
                } catch (error) {
                  console.error(error);
                  toast({
                    description: t("error", "Something went wrong."),
                    variant: "destructive"
                  });
                }
              }}
            >
              {linkDevice.isPending
                ? t("linking", "Linking...")
                : t("brews.charts.linkDevice", "Link hydrometer")}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatDeviceOption(device: Device, currentBrewId: string) {
  const name = device.device_name || device.id;
  if (device.brew_id === currentBrewId) return `${name} (linked here)`;
  if (device.brews?.name) return `${name} (${device.brews.name})`;
  if (device.brew_id) return `${name} (linked brew)`;
  return `${name} (unassigned)`;
}
