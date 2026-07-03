"use client";

import { useEffect } from "react";
import { useBanner } from "@/components/ui/banner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/auth/useAuth";

const STORAGE_KEY = "hasSeenBrewTrackerBanner";
const EXPIRES_AT = new Date("January 1, 2027").getTime();

export default function BrewTrackerBanner() {
  const { showBanner, dismissBanner } = useBanner();
  const { t } = useTranslation();
  const { isLoggedIn, loading } = useAuth();

  useEffect(() => {
    // early return if auth state isn't done loading
    if (loading) return;

    // Stop entirely after expiration
    if (Date.now() > EXPIRES_AT) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (hasSeen) return;

    localStorage.setItem(STORAGE_KEY, "true");

    // show action button for logged in users
    const action = isLoggedIn
      ? {
          label: t("brewTrackerDialog.actionButton"),
          onClick: () => {
            window.location.href = "/account/brews";
            dismissBanner(id);
          }
        }
      : undefined;

    const id = showBanner({
      title: t("brewTrackerDialog.title"),
      description: t("brewTrackerDialog.description"),
      variant: "default",
      dismissible: true,
      duration: 12000,
      action
    });
  }, [showBanner, dismissBanner, loading]);

  return null;
}
