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
import { useRouter } from "next/navigation";

function DesktopDialog() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isDialogOpen, setDialogOpen] = useState(false);

  // Check if the user is on a mobile device
  const isMobileDevice = () => {
    const userAgent =
      typeof window !== "undefined" ? window.navigator.userAgent : "";
    return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(
      userAgent
    );
  };

  // Check local storage and device type
  useEffect(() => {
    const hasSeenDialog = localStorage.getItem("hasSeenDesktopDialog");
    if (!hasSeenDialog && !isMobileDevice()) {
      setDialogOpen(true);
      localStorage.setItem("hasSeenDesktopDialog", "true");
    }
  }, []);

  const handleCancel = () => {
    setDialogOpen(false);
  };

  const handleDownload = () => {
    setDialogOpen(false);
    router.push("/desktop");
  };

  return (
    <AlertDialog open={isDialogOpen} onOpenChange={setDialogOpen}>
      <AlertDialogContent className="z-[1010] max-h-screen">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("desktop.dialog.title")}</AlertDialogTitle>
          <AlertDialogDescription className="flex flex-col gap-2"></AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {t("donate.dialog.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={handleDownload}>
            {t("desktop.dialog.download")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default DesktopDialog;
