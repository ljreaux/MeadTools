"use client";

import { useCallback, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { saveAs } from "file-saver";
import { useGenerateImage } from "recharts-to-png";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";

import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from "@/components/ui/chart";

import {
  Select,
  SelectItem,
  SelectValue,
  SelectContent,
  SelectTrigger
} from "@/components/ui/select";

import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { toBrix } from "@/lib/utils/unitConverter";
import { toCelsius, toFahrenheit } from "@/lib/utils/temperature";
// import ChartDownload from "./ChartDownload";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { Separator } from "../ui/separator";

type FileData = {
  date: string;
  temperature?: number;
  gravity: number;
  abv: number;
  signalStrength?: number;
  battery?: number;
};

export type TempUnits = "C" | "F" | "K";

export function HydrometerData({
  chartData,
  name,
  tempUnits
}: {
  chartData: FileData[];
  name?: string;
  tempUnits: TempUnits;
}) {
  const { i18n, t } = useTranslation();
  const lang = i18n.resolvedLanguage || "en-US";

  const [gravityUnits, setGravityUnits] = useState("SG");
  const [data, setData] = useState(chartData);
  const [currentTempUnits, setCurrentTempUnits] = useState(tempUnits);

  const [mobileOpen, setMobileOpen] = useState(false);

  const chartConfig = {
    temperature: {
      label: t("temperature"),
      color: "hsl(var(--chart-1))"
    },
    gravity: {
      label: gravityUnits === "Brix" ? t("BRIX") : t("nuteSgLabel"),
      color: "hsl(var(--chart-2))"
    },
    signalStrength: {
      label: t("iSpindelDashboard.signalStrength"),
      color: "hsl(var(--chart-3))"
    },
    battery: {
      label: t("iSpindelDashboard.batteryLevel"),
      color: "hsl(var(--chart-4))"
    },
    abv: {
      label: t("ABV"),
      color: "hsl(var(--chart-5))"
    }
  } satisfies ChartConfig;

  const showSignalStrength = !!data[0]?.signalStrength;
  const showBattery = !!data[0]?.battery;

  const yPadding =
    showSignalStrength || showBattery ? { bottom: 15 } : undefined;
  const xPadding =
    showSignalStrength || showBattery ? { left: 45, right: 60 } : undefined;

  const beginDate = useMemo(
    () =>
      new Date(data[0].date).toLocaleDateString(lang, {
        month: "long",
        day: "numeric"
      }),
    [data, lang]
  );

  const endDate = useMemo(
    () =>
      new Date(data[data.length - 1].date).toLocaleDateString(lang, {
        month: "long",
        day: "numeric",
        year: "numeric"
      }),
    [data, lang]
  );

  const defaultChecked = {
    temperature: false,
    gravity: false,
    signalStrength: false,
    battery: false,
    abv: false
  };

  const initialChecked = Object.keys(chartConfig).reduce(
    (acc, key) => {
      acc[key] = true;
      return acc;
    },
    {} as { [key: string]: boolean }
  );

  const [checkObj, setCheckObj] = useState<{ [key: string]: boolean }>(
    initialChecked || defaultChecked
  );

  const roundToNearest005 = (value: number) =>
    Math.round(value / 0.005) * 0.005;

  const generateTicks = (
    dataMin: number,
    dataMax: number,
    interval: number
  ) => {
    const ticks: number[] = [];
    const min = roundToNearest005(dataMin - interval);
    const max = roundToNearest005(dataMax + interval);

    for (let i = min; i <= max; i += interval) ticks.push(i);
    return ticks;
  };

  const dataMin = Math.min(...data.map((d) => d.gravity));
  const dataMax = Math.max(...data.map((d) => d.gravity));

  const abvMax = Math.max(...data.map((d) => d.abv));
  const abvTicks: number[] = [];
  for (let i = 0; i <= abvMax + 0.5; i += 0.5) abvTicks.push(i);

  const [getDivJpeg, { ref }] = useGenerateImage<HTMLDivElement>({
    quality: 0.8,
    type: "image/png"
  });

  const [getMobilePng, { ref: mobileRef }] = useGenerateImage<HTMLDivElement>({
    quality: 0.8,
    type: "image/png"
  });

  const handleDivDownload = useCallback(async () => {
    const jpeg = await getDivJpeg();
    if (jpeg) saveAs(jpeg, `${beginDate}-${endDate}.png`);
  }, [getDivJpeg, beginDate, endDate]);

  const handleMobileDownload = useCallback(async () => {
    const png = await getMobilePng();
    if (png) saveAs(png, `${beginDate}-${endDate}.png`);
  }, [getMobilePng, beginDate, endDate]);
  if (!data.length) return null;

  const handleGravityUnits = (val: string) => {
    const dataWithBrix = chartData.map((d) => ({
      ...d,
      gravity: toBrix(d.gravity)
    }));

    if (val === "SG") setData(chartData);
    else if (val === "Brix") setData(dataWithBrix);

    setGravityUnits(val);
  };

  const handleTempUnits = (val: string) => {
    const nextUnits = val as "F" | "C";

    setData((prev) =>
      prev.map((obj) => {
        if (typeof obj.temperature !== "number") return obj;

        // convert from CURRENT -> NEXT
        const nextTemp =
          currentTempUnits === nextUnits
            ? obj.temperature
            : currentTempUnits === "F"
              ? toCelsius(obj.temperature)
              : toFahrenheit(obj.temperature);

        return { ...obj, temperature: nextTemp };
      })
    );

    setCurrentTempUnits(nextUnits);
  };

  const MobileModalChart = () => (
    <div className="h-full w-full">
      <ChartContainer
        config={{
          gravity: chartConfig.gravity,
          abv: chartConfig.abv,
          temperature: chartConfig.temperature
        }}
        className="bg-background"
      >
        <LineChart
          accessibilityLayer
          data={data}
          margin={{ left: 8, right: 10, top: 8, bottom: 8 }}
        >
          <CartesianGrid vertical={false} stroke="hsl(210, 13%, 35%)" />

          <XAxis
            dataKey="date"
            tickMargin={8}
            minTickGap={70}
            tickFormatter={(value) =>
              new Date(value).toLocaleDateString(lang, {
                month: "short",
                day: "numeric"
              })
            }
          />

          {/* Visible axes: SG/Brix (left) */}
          <YAxis
            dataKey={"gravity"}
            yAxisId={"gravity"}
            domain={[
              (v: number) => roundToNearest005(v - 0.005),
              (v: number) => roundToNearest005(v + 0.005)
            ]}
            ticks={generateTicks(dataMin, dataMax, 0.005)}
            allowDecimals
            tickMargin={8}
            tickFormatter={(val) =>
              gravityUnits === "Brix"
                ? Number(val).toFixed(2)
                : Number(val).toFixed(3)
            }
          />

          {/* Visible axes: ABV (right) */}
          <YAxis
            dataKey={"abv"}
            yAxisId={"abv"}
            orientation="right"
            ticks={abvTicks}
            tickMargin={8}
            unit={"%"}
          />

          {/* Hidden axis: Temperature (exists so the temp line can render correctly) */}
          <YAxis
            dataKey={"temperature"}
            yAxisId={"temperature"}
            orientation="right"
            hide
            width={0}
            tick={false}
            axisLine={false}
            tickLine={false}
            unit={`°${currentTempUnits}`}
          />

          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(val) => {
                  const date = new Date(val);
                  return date.toLocaleString(lang, {
                    dateStyle: "short",
                    timeStyle: "short"
                  });
                }}
              />
            }
          />

          {/* Lines: SG/Brix + ABV + Temperature */}
          <Line
            dataKey="gravity"
            type="monotone"
            stroke="var(--color-gravity)"
            strokeWidth={2}
            dot={false}
            yAxisId={"gravity"}
          />

          <Line
            dataKey="abv"
            type="monotone"
            stroke="var(--color-abv)"
            strokeWidth={2}
            dot={false}
            yAxisId={"abv"}
            unit={"%"}
          />

          <Line
            dataKey="temperature"
            type="monotone"
            stroke="var(--color-temperature)"
            strokeWidth={2}
            dot={false}
            yAxisId={"temperature"}
            unit={`°${currentTempUnits}`}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );

  return (
    <Card className="w-full max-w-[1240px] self-center">
      <CardContent ref={ref} className="bg-inherit">
        <CardHeader>
          <CardTitle>{name}</CardTitle>
          <CardDescription>
            {beginDate} - {endDate}
          </CardDescription>

          {/* MOBILE: button -> fullscreen modal */}
          <div className="block sm:hidden pt-2">
            <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full">
                  {t("iSpindelDashboard.openChart", "Open chart")}
                </Button>
              </DialogTrigger>

              <DialogContent className="mx-0 px-0">
                <div className="flex flex-col bg-background mx-0">
                  <div className="flex items-center gap-3 pt-4 pb-3">
                    <div className="w-full flex items-center flex-col">
                      <DialogHeader className="px-0">
                        <DialogTitle className="text-base truncate">
                          {name || t("iSpindelDashboard.chartTitle", "Chart")}
                        </DialogTitle>
                        <DialogDescription className="text-sm">
                          {beginDate} - {endDate}
                        </DialogDescription>
                      </DialogHeader>

                      <div className="w-full flex gap-2 p-3">
                        <Select
                          onValueChange={handleGravityUnits}
                          value={gravityUnits}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SG">{t("SG")}</SelectItem>
                            <SelectItem value="Brix">{t("BRIX")}</SelectItem>
                          </SelectContent>
                        </Select>

                        <Select
                          onValueChange={handleTempUnits}
                          value={currentTempUnits}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="F">{t("FAR")}</SelectItem>
                            <SelectItem value="C">{t("CEL")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-full flex p-3">
                        <Button
                          onClick={handleMobileDownload}
                          className="w-full"
                        >
                          {t("downloadPNG")}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex-1 w-screen my-4" ref={mobileRef}>
                    <MobileModalChart />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* DESKTOP selects (keep your original) */}
          <CardContent className="hidden sm:flex gap-2">
            <Select onValueChange={handleGravityUnits} value={gravityUnits}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SG">{t("SG")}</SelectItem>
                <SelectItem value="Brix">{t("BRIX")}</SelectItem>
              </SelectContent>
            </Select>

            <Select onValueChange={handleTempUnits} value={currentTempUnits}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">{t("FAR")}</SelectItem>
                <SelectItem value="C">{t("CEL")}</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </CardHeader>

        {/* DESKTOP chart (your original) */}
        <CardContent className="hidden sm:block">
          <ChartContainer config={chartConfig}>
            <LineChart
              accessibilityLayer
              data={data}
              margin={{ left: 12, right: 12 }}
            >
              <CartesianGrid vertical={false} stroke="hsl(210, 13%, 35%)" />
              <XAxis
                dataKey="date"
                tickMargin={8}
                tickFormatter={(value) =>
                  new Date(value).toLocaleString(lang, {
                    month: "short",
                    weekday: "short",
                    day: "numeric"
                  })
                }
                minTickGap={50}
                padding={xPadding}
              />
              <YAxis
                domain={[
                  (dataMin: number) => roundToNearest005(dataMin - 0.005),
                  (dataMax: number) => roundToNearest005(dataMax + 0.005)
                ]}
                ticks={generateTicks(dataMin, dataMax, 0.005)}
                allowDecimals
                tickMargin={8}
                dataKey={"gravity"}
                yAxisId={"gravity"}
                tickFormatter={(val) => val.toFixed(3)}
                padding={yPadding}
                hide={!checkObj.gravity}
              />
              <YAxis
                domain={["dataMin - 5", "dataMax + 5"]}
                orientation="right"
                dataKey={"temperature"}
                yAxisId={"temperature"}
                tickCount={10}
                tickFormatter={(val) => val.toFixed()}
                padding={yPadding}
                unit={`°${currentTempUnits}`}
                hide={!checkObj.temperature}
              />
              <YAxis
                domain={[0, "dataMax + 0.5"]}
                orientation="right"
                dataKey={"abv"}
                yAxisId={"abv"}
                ticks={abvTicks}
                padding={yPadding}
                unit={"%"}
                hide={!checkObj.abv}
              />
              {showBattery && (
                <YAxis
                  dataKey={"battery"}
                  yAxisId={"battery"}
                  tickFormatter={(val) => val.toFixed(2)}
                  mirror
                  padding={yPadding}
                  hide={!checkObj.battery}
                />
              )}
              {showSignalStrength && (
                <YAxis
                  orientation="right"
                  dataKey={"signalStrength"}
                  yAxisId={"signalStrength"}
                  tickCount={10}
                  tickFormatter={(val) => val.toFixed()}
                  mirror
                  tickMargin={10}
                  padding={yPadding}
                  unit={"dB"}
                  hide={!checkObj.signalStrength}
                />
              )}
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    labelFormatter={(val) => {
                      const date = new Date(val);
                      return date.toLocaleString(lang, {
                        timeStyle: "medium",
                        dateStyle: "short"
                      });
                    }}
                  />
                }
              />
              {showSignalStrength && (
                <Line
                  dataKey="signalStrength"
                  type="monotone"
                  stroke="var(--color-signalStrength)"
                  strokeWidth={2}
                  dot={false}
                  yAxisId={"signalStrength"}
                  unit={"dB"}
                  hide={!checkObj.signalStrength}
                />
              )}
              {showBattery && (
                <Line
                  dataKey="battery"
                  type="monotone"
                  stroke="var(--color-battery)"
                  strokeWidth={2}
                  dot={false}
                  yAxisId={"battery"}
                  hide={!checkObj.battery}
                />
              )}
              <Line
                dataKey="abv"
                type="monotone"
                stroke="var(--color-abv)"
                strokeWidth={2}
                dot={false}
                yAxisId={"abv"}
                unit={"%"}
                hide={!checkObj.abv}
              />
              <Line
                dataKey="temperature"
                type="monotone"
                stroke="var(--color-temperature)"
                strokeWidth={2}
                dot={false}
                yAxisId={"temperature"}
                unit={`°${currentTempUnits}`}
                hide={!checkObj.temperature}
              />
              <Line
                dataKey="gravity"
                type="monotone"
                stroke="var(--color-gravity)"
                strokeWidth={2}
                dot={false}
                yAxisId={"gravity"}
                hide={!checkObj.gravity}
              />
              <ChartLegend
                content={
                  <ChartLegendContent
                    checkObj={checkObj}
                    updateCheckObj={(newCheckObj: {
                      checkObj: { [key: string]: boolean };
                    }) => setCheckObj(newCheckObj.checkObj)}
                  />
                }
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </CardContent>

      <CardFooter className="hidden sm:block">
        {/* <ChartDownload data={data} /> */}
        <Button onClick={handleDivDownload} className="w-full my-4">
          {t("downloadPNG")}
        </Button>
      </CardFooter>
    </Card>
  );
}
