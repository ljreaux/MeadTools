"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useBanner } from "@/components/ui/banner"; // <- adjust import path to wherever BannerProvider lives

function SupportDialog() {
  const { t } = useTranslation();
  const { showBanner, dismissBanner } = useBanner();

  useEffect(() => {
    const hasSeenSupportDialog = localStorage.getItem("hasSeenSupportDialog");
    if (hasSeenSupportDialog) return;

    localStorage.setItem("hasSeenSupportDialog", "true");

    const id = showBanner({
      title: t("donate.dialog.title"),
      description: (
        <span className="text-sm opacity-90">
          {t("donate.dialog.content").split("\n").filter(Boolean).join(" ")}
        </span>
      ),
      variant: "default",
      dismissible: true,
      duration: 10000,
      action: {
        label: t("donate.dialog.support"),
        onClick: () => {
          window.open("https://ko-fi.com/meadtools", "_blank");
          dismissBanner(id);
        }
      }
    });
    void id;
  }, [showBanner, dismissBanner, t]);

  return null;
}

export default SupportDialog;
