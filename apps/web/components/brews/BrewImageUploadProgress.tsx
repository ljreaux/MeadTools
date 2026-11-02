"use client";

import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";

export function BrewImageUploadProgress({
  value,
  current,
  total,
}: {
  value: number;
  current?: number;
  total?: number;
}) {
  const { t } = useTranslation();
  const processing = value >= 100;
  return (
    <div
      className="space-y-2"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {current !== undefined && total !== undefined && (
        <p className="text-sm font-medium">
          {t("brewImages.uploadingPhoto", { current, total })}
        </p>
      )}
      <Progress
        value={value}
        aria-label={t("brewImages.uploading")}
        aria-valuetext={
          processing
            ? t("brewImages.processing")
            : t("brewImages.progress", { progress: value })
        }
        className={processing ? "motion-safe:animate-pulse" : undefined}
      />
      <p className="text-sm text-muted-foreground">
        {processing
          ? t("brewImages.processing")
          : t("brewImages.progress", { progress: value })}
      </p>
    </div>
  );
}
