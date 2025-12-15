"use client";

import { useEffect } from "react";
import { useBanner } from "@/components/ui/banner";

const STORAGE_KEY = "hasSeenTaplistBanner_v1";
const EXPIRES_AT = new Date("2026-06-15T00:00:00.000Z").getTime(); // 6 months

export default function TaplistReleaseBanner() {
  const { showBanner, dismissBanner } = useBanner();

  useEffect(() => {
    // Stop entirely after expiration
    if (Date.now() > EXPIRES_AT) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const hasSeen = localStorage.getItem(STORAGE_KEY);
    if (hasSeen) return;

    localStorage.setItem(STORAGE_KEY, "true");

    const id = showBanner({
      title: "MeadTools Taplist",
      description: (
        <span className="text-sm opacity-90">
          The MeadTools Taplist is a lightweight, self-hosted tap list display
          built for TVs, menu boards, and low-power hardware like Raspberry Pi.
        </span>
      ),
      variant: "default",
      dismissible: true,
      duration: 12000,
      action: {
        label: "View Taplist",
        onClick: () => {
          window.location.href = "/taplist";
          dismissBanner(id);
        }
      }
    });

    void id;
  }, [showBanner, dismissBanner]);

  return null;
}
