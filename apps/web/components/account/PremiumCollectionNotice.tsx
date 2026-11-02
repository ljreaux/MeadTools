"use client";

import { useId, useState, useRef, type ReactNode } from "react";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** Acknowledge the premium restriction while preserving access to retained records. */
export function PremiumCollectionNotice({
  canManage,
  description,
  children,
}: {
  canManage: boolean;
  description: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  const [revealed, setRevealed] = useState(false);
  const readOnlyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  function revealItems() {
    setRevealed(true);
    requestAnimationFrame(() => readOnlyRef.current?.focus());
  }
  function hideItems() {
    setRevealed(false);
    requestAnimationFrame(() => titleRef.current?.focus());
  }
  if (canManage) return children;

  const premiumLink = (
    <Button asChild>
      <Link href="/account/premium">{t("equipment.premiumLink")}</Link>
    </Button>
  );
  return (
    <div className={`relative isolate ${revealed ? "space-y-4" : "min-h-80"}`}>
      {revealed ? (
        <div
          ref={readOnlyRef}
          tabIndex={-1}
          role="region"
          aria-label={t("inventory.access.readOnlyTitle")}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-4 text-sm"
        >
          <p className="min-w-0 basis-full sm:flex-1">{description}</p>
          {premiumLink}
          <Button variant="ghost" onClick={hideItems}>
            {t("inventory.access.hideItems")}
          </Button>
        </div>
      ) : null}
      <div
        inert={!revealed}
        aria-hidden={!revealed ? true : undefined}
        className={
          !revealed ? "pointer-events-none select-none blur-sm" : undefined
        }
      >
        {children}
      </div>
      {!revealed ? (
        <div className="absolute inset-0 z-10 p-3 sm:p-6">
          <Card
            className="mx-auto max-w-md bg-background/95 shadow-lg"
            role="region"
            aria-labelledby={titleId}
          >
            <CardContent className="space-y-4 p-5 sm:p-6">
              <h2
                ref={titleRef}
                tabIndex={-1}
                id={titleId}
                className="flex items-center gap-2 text-lg font-semibold"
              >
                <LockKeyhole aria-hidden className="h-5 w-5 shrink-0" />
                {t("inventory.access.title")}
              </h2>
              <p className="text-sm text-muted-foreground">{description}</p>
              <div className="flex flex-wrap gap-3">
                {premiumLink}
                <Button variant="outline" onClick={revealItems}>
                  {t("inventory.access.viewReadOnly")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
