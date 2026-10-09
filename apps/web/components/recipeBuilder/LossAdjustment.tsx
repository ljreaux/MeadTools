"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRecipe } from "@/components/providers/RecipeProvider";
import { isValidNumber, normalizeNumberString, parseNumber } from "@/lib/utils/validateInput";
import { isValidLossPercentage } from "@meadtools/core/loss";
import Tooltip from "../Tooltips";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";

export default function LossAdjustment() {
  const { t, i18n } = useTranslation();
  const {
    data: { lossAdjustment },
    derived: { postLossPrimaryVolume, bottlingVolume, volumeUnit },
    loss
  } = useRecipe();
  const [draft, setDraft] = useState<string | null>(null);
  const [secondaryDraft, setSecondaryDraft] = useState<string | null>(null);
  const editing = draft !== null;

  const parsedDraft = parseNumber(draft ?? "");
  const invalid =
    draft === "" ||
    (draft !== null && !isValidNumber(draft)) ||
    !isValidLossPercentage(parsedDraft);
  const parsedSecondaryDraft = parseNumber(secondaryDraft ?? "");
  const secondaryInvalid =
    secondaryDraft === "" ||
    (secondaryDraft !== null && !isValidNumber(secondaryDraft)) ||
    !isValidLossPercentage(parsedSecondaryDraft);

  return (
    <section className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <h4 className="font-medium">{t("recipeBuilder.loss.title")}</h4>
          <Tooltip body={t("recipeBuilder.loss.disclaimer")} variant="muted" />
        </div>
        <Switch
          checked={lossAdjustment?.enabled ?? false}
          onCheckedChange={loss.setEnabled}
          aria-label={t("recipeBuilder.loss.title")}
        />
      </div>

      {lossAdjustment?.enabled ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {t("recipeBuilder.loss.percentage")}
              </span>
              <div className="flex items-center gap-2">
                <Input
                  className="w-20"
                  value={draft ?? String(lossAdjustment.percentage)}
                  inputMode="decimal"
                  aria-invalid={editing && invalid}
                  onFocus={() => setDraft(String(lossAdjustment.percentage))}
                  onBlur={() => setDraft(null)}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDraft(next);
                    const value = parseNumber(next);
                    if (
                      next.trim() !== "" &&
                      isValidNumber(next) &&
                      isValidLossPercentage(value)
                    ) {
                      loss.setManualPercentage(value);
                    }
                  }}
                />
                <span>%</span>
              </div>
            </label>
            {lossAdjustment.mode === "manual" && loss.estimatedPercentage != null ? (
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => loss.setMode("estimated")}
              >
                {t("recipeBuilder.loss.useEstimate", {
                  percentage: loss.estimatedPercentage
                })}
              </Button>
            ) : lossAdjustment.mode === "estimated" && loss.estimatedPercentage != null ? (
              <span className="text-xs text-muted-foreground">
                {t("recipeBuilder.loss.automatic")}
              </span>
            ) : null}
            <span className="text-sm">
              {t("recipeBuilder.loss.postTransfer", {
                volume: normalizeNumberString(postLossPrimaryVolume, 2, i18n.language),
                unit: volumeUnit
              })}
            </span>
          </div>
          {editing && invalid ? (
            <p className="text-sm text-destructive" role="alert">
              {t("recipeBuilder.loss.invalid")}
            </p>
          ) : null}
          {loss.estimatedPercentage == null ? (
            <p className="text-xs text-muted-foreground">
              {t("recipeBuilder.loss.unavailable")}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {t("recipeBuilder.loss.shortDisclaimer")}
          </p>
        </div>
      ) : null}

      <div className="border-t border-border pt-2">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1">
            <h4 className="font-medium">{t("recipeBuilder.loss.secondaryTitle")}</h4>
            <Tooltip body={t("recipeBuilder.loss.secondaryDisclaimer")} variant="muted" />
          </div>
          <Switch
            checked={lossAdjustment?.secondary?.enabled ?? false}
            onCheckedChange={loss.setSecondaryEnabled}
            aria-label={t("recipeBuilder.loss.secondaryTitle")}
          />
        </div>
        {lossAdjustment?.secondary?.enabled ? (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {t("recipeBuilder.loss.percentage")}
                </span>
                <Input
                  className="w-20"
                  value={secondaryDraft ?? String(lossAdjustment.secondary.percentage)}
                  inputMode="decimal"
                  aria-invalid={secondaryDraft !== null && secondaryInvalid}
                  onFocus={() => setSecondaryDraft(String(lossAdjustment.secondary?.percentage ?? 0))}
                  onBlur={() => setSecondaryDraft(null)}
                  onChange={(event) => {
                    const next = event.target.value;
                    setSecondaryDraft(next);
                    const value = parseNumber(next);
                    if (
                      next.trim() !== "" &&
                      isValidNumber(next) &&
                      isValidLossPercentage(value)
                    ) {
                      loss.setSecondaryPercentage(value);
                    }
                  }}
                />
                <span>%</span>
              </label>
              {loss.secondaryEstimatedPercentage != null ? (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => loss.setSecondaryPercentage(loss.secondaryEstimatedPercentage!)}
                >
                  {t("recipeBuilder.loss.useSecondaryEstimate", {
                    percentage: loss.secondaryEstimatedPercentage
                  })}
                </Button>
              ) : null}
              <span className="text-sm">
                {t("recipeBuilder.loss.bottlingVolume", {
                  volume: normalizeNumberString(bottlingVolume, 2, i18n.language),
                  unit: volumeUnit
                })}
              </span>
            </div>
            {secondaryDraft !== null && secondaryInvalid ? (
              <p className="text-sm text-destructive" role="alert">
                {t("recipeBuilder.loss.invalid")}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {t("recipeBuilder.loss.secondaryShortDisclaimer")}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
