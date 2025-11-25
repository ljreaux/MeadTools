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

import { useISpindel } from "@/components/providers/ISpindelProvider";
import LogTable from "@/components/ispindel/LogTable";
import RecentLogsForm from "@/components/ispindel/RecentLogsForm";
import { useParams, useRouter } from "next/navigation";

function Device() {
  const params = useParams();
  const router = useRouter();

  const deviceId = params.deviceId as string;
  const { t } = useTranslation();
  const {
    deviceList,
    fetchLogs,
    logs,
    setLogs,
    startBrew,
    endBrew,
    updateCoeff,
    brews,
    deleteDevice
  } = useISpindel();

  const [device, setDevice] = useState<any>(null);
  const [coefficients, setCoefficients] = useState<string[]>(["", "", "", ""]);
  const [showTable, setShowTable] = useState(false);
  const [fileName, setFileName] = useState("");

  // Get the current device from the device list
  useEffect(() => {
    setDevice(deviceList.find((device) => device.id === deviceId));
  }, [deviceId, deviceList]);

  // Initialize coefficients when the device is loaded
  useEffect(() => {
    if (device?.coefficients?.length === 4) {
      setCoefficients(device.coefficients);
    }
  }, [device]);
  useEffect(() => {
    const from = new Date();
    const to = new Date();
    from.setDate(from.getDate() - 1);

    const start_date = new Date(from.setUTCHours(0, 0, 0, 0)).toISOString();
    const end_date = new Date(to.setUTCHours(23, 59, 59, 999)).toISOString();

    fetchLogs(start_date, end_date, deviceId).then((logs) => {
      setLogs(logs!);
    });
  }, []);

  // Update coefficients locally
  const updateCoefficients = (index: number, value: string) => {
    const newCoefficients = [...coefficients];
    newCoefficients[index] = value;
    setCoefficients(newCoefficients);
  };

  // Validate coefficients
  const validateCoefficients = (arr: string[]) => {
    if (
      arr.length < 4 ||
      arr.some((item) => item === "" || isNaN(Number(item)))
    ) {
      return false;
    }
    return true;
  };

  // Handle coefficient submission
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateCoefficients(coefficients)) {
      return toast({
        description: t(
          "Please fill in all coefficients with valid number values."
        ),
        variant: "destructive"
      });
    }
    updateCoeff(device.id, coefficients.map(Number));
    setShowTable(false);
  };

  const brewName = brews.find((brew) => brew?.id === device?.brew_id)?.name;

  if (!device) return null;

  return (
    <div className="w-full">
      <div className="grid items-center justify-center sm:grid-cols-2">
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
                      variant={"secondary"}
                      onClick={() => startBrew(device.id, fileName)}
                    >
                      {t("iSpindelDashboard.startBrew")}
                    </Button>
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <Button
              variant={"destructive"}
              onClick={() => endBrew(device.id, device.brew_id)}
            >
              {t("iSpindelDashboard.endBrew", { brew_name: brewName })}
            </Button>
          )}
        </div>
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
                      ></Input>
                    </TableCell>
                    <TableCell>
                      &#215; angle<sup>3</sup> +
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Input
                        value={coefficients[1]}
                        onChange={(e) => updateCoefficients(1, e.target.value)}
                      ></Input>
                    </TableCell>
                    <TableCell>
                      &#215; angle<sup>2</sup> +
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Input
                        value={coefficients[2]}
                        onChange={(e) => updateCoefficients(2, e.target.value)}
                      ></Input>
                    </TableCell>
                    <TableCell>&#215; angle +</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>
                      <Input
                        value={coefficients[3]}
                        onChange={(e) => updateCoefficients(3, e.target.value)}
                      ></Input>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Button type="submit">{t("Submit")}</Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowTable(false)}
              >
                {t("Cancel")}
              </Button>
            </form>
          ) : (
            <Button onClick={() => setShowTable(true)}>
              {t("iSpindelDashboard.updateCoefficients")}
            </Button>
          )}
        </div>
        <RecentLogsForm deviceId={device.id} />
      </div>
      <div className="max-w-full">
        <LogTable
          logs={logs}
          removeLog={(id) => setLogs(logs.filter((log) => log.id !== id))}
          deviceId={deviceId}
        />
      </div>
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
                onClick={() =>
                  deleteDevice(device.id).then(() => {
                    router.push("/account/hydrometer/devices");
                  })
                }
              >
                {t("iSpindelDashboard.deleteDevice")}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default Device;
