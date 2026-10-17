"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useBanner } from "@/components/ui/banner";
import { useAuth } from "@/hooks/auth/useAuth";
import {
  RAPT_CLOUD_NOTICE_EXPIRES_AT,
  shouldShowRaptCloudNotice,
} from "@/lib/utils/rapt-cloud-notice";

export default function RaptCloudUpdateBanner() {
  const { user, loading } = useAuth();
  const { showBanner, dismissBanner } = useBanner();
  const { t } = useTranslation();
  const dismissedThisVisit = useRef(new Set<string>());
  const userId = user?.id;

  useEffect(() => {
    if (loading || userId == null) return;

    const storageKey = `rapt-cloud-update-v1:${userId}`;
    let dismissed = dismissedThisVisit.current.has(storageKey);
    try {
      dismissed ||= localStorage.getItem(storageKey) === "true";
    } catch {
      // The notice still works when browser storage is unavailable.
    }
    if (!shouldShowRaptCloudNotice({ isLoggedIn: true, dismissed })) return;

    const id = showBanner({
      title: t("rapt.cloud.notice.title"),
      description: (
        <span>
          {t("rapt.cloud.notice.description")} {" "}
          <Link href="/account/hydrometer/setup" className="underline" onClick={() => dismissBanner(id)}>
            {t("rapt.cloud.notice.setupLink")}
          </Link>
        </span>
      ),
      variant: "warning",
      dismissible: true,
      action: {
        label: t("rapt.cloud.notice.dontShowAgain"),
        onClick: () => {
          dismissedThisVisit.current.add(storageKey);
          try {
            localStorage.setItem(storageKey, "true");
          } catch {
            // Keep the dismissal for this visit if persistence is blocked.
          }
          dismissBanner(id);
        },
      },
    });

    let timer: ReturnType<typeof setTimeout>;
    const expire = () => {
      const remaining = RAPT_CLOUD_NOTICE_EXPIRES_AT - Date.now();
      if (remaining <= 0) dismissBanner(id);
      else timer = setTimeout(expire, Math.min(remaining, 24 * 60 * 60 * 1000));
    };
    expire();

    return () => {
      clearTimeout(timer);
      dismissBanner(id);
    };
  }, [userId, loading, t, showBanner, dismissBanner]);

  return null;
}
