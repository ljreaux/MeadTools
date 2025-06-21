"use client";

import { useEffect, useState } from "react";
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
} from "@/components/ui/alert-dialog";

function SupportDialog() {
  const { t } = useTranslation();
  const [isDialogOpen, setDialogOpen] = useState(false);

  // Check local storage for visibility condition
  useEffect(() => {
    const hasSeenSupportDialog = localStorage.getItem("hasSeenSupportDialog");
    if (!hasSeenSupportDialog) {
      setDialogOpen(true);
      localStorage.setItem("hasSeenSupportDialog", "true");
    }
  }, []);

  const splitText = (text: string) => {
    const paragraphs = text.split("\n");
    return paragraphs.map((p, i) => <span key={i}>{p}</span>);
  };

  const handleCancel = () => {
    setDialogOpen(false);
  };

  const handleSupport = () => {
    setDialogOpen(false);
    window.open("https://ko-fi.com/meadtools", "_blank");
  };

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setDialogOpen}>
      <AlertDialogContent className="z-[1010] overflow-y-scroll max-h-screen">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("donate.dialog.title")}</AlertDialogTitle>
          <AlertDialogDescription className="flex flex-col gap-2">
            {splitText(t("donate.dialog.content"))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {t("donate.dialog.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleSupport}>
            {t("donate.dialog.support")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default SupportDialog;
