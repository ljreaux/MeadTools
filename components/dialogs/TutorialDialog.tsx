"use client";

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { useBanner } from "@/components/ui/banner";

function TutorialDialog() {
  const { t } = useTranslation();
  const router = useRouter();
  const { showBanner, dismissBanner } = useBanner();

  useEffect(() => {
    const hasSeenDialog = !!JSON.parse(
      localStorage.getItem("hasSeenTutorialDialog") || "false"
    );

    if (hasSeenDialog) return;

    localStorage.setItem("hasSeenTutorialDialog", "true");

    const id = showBanner({
      variant: "default",
      title: t("tutorial.dialog.title"),
      description: t("tutorial.dialog.description"),
      duration: 12000,
      action: {
        label: t("tutorial.dialog.viewTutorial"),
        onClick: () => {
          dismissBanner(id);
          router.push("/tutorial");
        }
      }
    });
  }, [dismissBanner, router, showBanner, t]);

  return null;
}

export default TutorialDialog;
