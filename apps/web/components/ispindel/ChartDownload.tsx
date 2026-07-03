"use client";
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
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useTranslation } from "react-i18next";

function ChartDownload({ data }: { data: any[] }) {
  const { t } = useTranslation();
  const [fileName, setFileName] = useState("");
  return (
    <span className="flex items-center justify-center gap-4">
      {t("iSpindelDashboard.chartDownload.desc")}
      <AlertDialog>
        <AlertDialogTrigger className={buttonVariants({ variant: "default" })}>
          {t("download")}
        </AlertDialogTrigger>
        <AlertDialogContent className="z-[1000] w-11/12">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("iSpindelDashboard.enter")}</AlertDialogTitle>
            <AlertDialogDescription className="flex flex-col gap-2">
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
              />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction asChild>
              <a
                href={`data:text/json;charset=utf-8,${encodeURIComponent(
                  JSON.stringify(
                    data.map((data, i) => ({ ...data, id: i + 1 }))
                  )
                )}`}
                download={`${
                  fileName.length > 0 ? fileName : "meadtools"
                }.hydro`}
              >
                {t("download")}
              </a>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
}

export default ChartDownload;
