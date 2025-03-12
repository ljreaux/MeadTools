"use client";

import { useEffect, useState } from "react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useISpindel } from "@/components/providers/ISpindelProvider";
import LogTable from "@/components/ispindel/LogTable";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import { ArrowDownUp } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import { HydrometerData } from "@/components/ispindel/HydrometerData";
import { calcABV } from "@/lib/utils/unitConverter";
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
      abv: Math.max(abv, 0),
    };
  });
};
function Brew() {
  const params = useParams();
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const formatter = new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    dateStyle: "short",
    timeStyle: "short",
  });
  const formatDate = (date: Date) => formatter.format(new Date(date));

  const { brews, deleteBrew, getBrewLogs, updateBrewName } = useISpindel();

  const [brew, setBrew] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [fileName, setFileName] = useState("");

  const brewId = params.brewId || "";

  // Fetch brew and logs when the component mounts or brewId changes
  useEffect(() => {
    const fetchBrewData = async () => {
      const currentBrew = brews.find((b) => b.id === brewId);
      setBrew(currentBrew);

      if (brewId) {
        const logsData = await getBrewLogs(brewId as string);
        setLogs(logsData);
      }
    };

    fetchBrewData();
  }, [brewId, brews]);

  const handleFileNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileName(e.target.value);
  };

  const handleUpdateBrewName = async () => {
    if (!brew || !fileName.trim()) return;

    try {
      await updateBrewName(brew.id, fileName);
      setBrew((prev: any) => ({ ...prev, name: fileName }));
      toast({ description: t("Brew name updated successfully.") });
    } catch (error) {
      console.error("Error updating brew name:", error);
      toast({
        description: t("Failed to update brew name."),
        variant: "destructive",
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
        variant: "destructive",
      });
    }
  };

  const chartData = transformData(logs);

  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="w-full p-4 m-4">
        <h1>{t("iSpindelDashboard.brews.details")}:</h1>

        <div>
          {brew?.name ? (
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

        {brew?.recipe_id ? (
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

      {logs.length > 0 && (
        <HydrometerData chartData={chartData} tempUnits={logs[0]?.temp_units} />
      )}

      <div className="max-w-full">
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
              removeLog={(id) => setLogs(logs.filter((log) => log.id !== id))}
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
                <Button onClick={handleDeleteBrew}>
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
