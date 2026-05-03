"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";

export function BrewTrackingUnavailable() {
  const { t } = useTranslation();

  return (
    <div className="mx-auto mt-16 w-11/12 max-w-xl rounded-xl border border-border bg-card p-6 text-center">
      <h2 className="text-xl font-semibold">
        {t("brews.unavailableTitle", "Brew tracking is not available yet.")}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {t(
          "brews.unavailableDescription",
          "This area is still in progress. For now, account navigation only exposes settings and logout."
        )}
      </p>
      <Button asChild className="mt-4" variant="secondary">
        <Link href="/account">{t("back", "Back")}</Link>
      </Button>
    </div>
  );
}
