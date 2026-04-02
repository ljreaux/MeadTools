"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useRecipe } from "@/components/providers/RecipeProvider";
import { isValidNumber, parseNumber } from "@/lib/utils/validateInput";

import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon
} from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import Tooltip from "@/components/Tooltips";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";

import { toSG } from "@/lib/utils/unitConverter";
import { VOLUME_TO_L } from "@/lib/utils/recipeDataCalculations";

type RatioDraft = {
  lineId: string;
  name: string;
  pct: string; // "25"
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function pct2(n: number) {
  return Math.round(n * 100) / 100;
}

function toPctStr(n: number) {
  return String(pct2(n));
}

// “sugar contribution” proxy: gravity points * liters (constant factor cancels for ratios)
function sugarContribution(volumeL: number, sg: number) {
  return Math.max(0, (sg - 1) * volumeL);
}

export default function PrimaryTargetsButton() {
  const { t } = useTranslation();

  const {
    data: { unitDefaults, ingredients },
    setPrimaryTargetsWithRatios
  } = useRecipe();

  const [open, setOpen] = useState(false);
  const [{ og, volume }, setOgAndVolume] = useState({ og: "", volume: "" });

  const primaryLines = useMemo(() => {
    return ingredients.filter((l) => {
      if (l.secondary) return false;
      if (l.category === "water") return false;
      return true;
    });
  }, [ingredients]);

  const currentRatios = useMemo<RatioDraft[]>(() => {
    const fermentables = primaryLines
      .map((l) => {
        const sg = toSG(parseNumber(l.brix));
        const volL =
          parseNumber(l.amounts.volume.value) *
          VOLUME_TO_L[l.amounts.volume.unit];

        return {
          lineId: l.lineId,
          name: l.name || t("unnamedIngredient"),
          contrib: sugarContribution(volL, sg)
        };
      })
      .filter((x) => Number.isFinite(x.contrib) && x.contrib > 0);

    const total = fermentables.reduce((s, x) => s + x.contrib, 0);

    // fallback: equal split if we can’t infer
    if (!Number.isFinite(total) || total <= 0 || fermentables.length === 0) {
      const n = primaryLines.length;
      const eq = n > 0 ? toPctStr(100 / n) : "0";
      return primaryLines.map((l) => ({
        lineId: l.lineId,
        name: l.name || t("unnamedIngredient"),
        pct: eq
      }));
    }

    const drafts = fermentables.map((x) => ({
      lineId: x.lineId,
      name: x.name,
      pct: toPctStr((x.contrib / total) * 100)
    }));

    // include any fermentable lines that had 0 contrib as 0% so UI doesn’t lose them
    const zeroes = primaryLines
      .filter((l) => !drafts.some((d) => d.lineId === l.lineId))
      .map((l) => ({
        lineId: l.lineId,
        name: l.name || t("unnamedIngredient"),
        pct: "0"
      }));

    return [...drafts, ...zeroes];
  }, [primaryLines, t]);

  const [draftRatios, setDraftRatios] = useState<RatioDraft[]>([]);
  const [lockToCurrent, setLockToCurrent] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLockToCurrent(true);
    setDraftRatios(currentRatios);
  }, [open, currentRatios]);

  useEffect(() => {
    if (!open) return;
    if (lockToCurrent) setDraftRatios(currentRatios);
  }, [lockToCurrent, currentRatios, open]);

  const resetRatios = () => setDraftRatios(currentRatios);

  const ratiosSum = useMemo(
    () => draftRatios.reduce((sum, r) => sum + (parseNumber(r.pct) || 0), 0),
    [draftRatios]
  );

  const setPct = (lineId: string, next: string) => {
    if (!isValidNumber(next)) return;
    setDraftRatios((prev) =>
      prev.map((r) => (r.lineId === lineId ? { ...r, pct: next } : r))
    );
  };

  const normalize = () => {
    const total = ratiosSum;
    if (!Number.isFinite(total) || total <= 0) return;

    setDraftRatios((prev) => {
      const scaled = prev.map((r) => ({
        ...r,
        pct: String(round2((parseNumber(r.pct) / total) * 100))
      }));

      const newSum = scaled.reduce((s, r) => s + parseNumber(r.pct), 0);
      const drift = round2(100 - newSum);
      if (scaled.length > 0 && Math.abs(drift) > 0) {
        const last = scaled[scaled.length - 1]!;
        scaled[scaled.length - 1] = {
          ...last,
          pct: String(round2(parseNumber(last.pct) + drift))
        };
      }

      return scaled;
    });
  };

  // --- NEW: compute achievable OG range for current ratio settings ---
  const ogBounds = useMemo(() => {
    // Map lineId -> sg (from brix)
    const sgById = new Map<string, number>();
    primaryLines.forEach((l) => {
      sgById.set(l.lineId, toSG(parseNumber(l.brix)));
    });

    // Use only ratios > 0
    const pctSum = draftRatios.reduce((s, r) => {
      const p = parseNumber(r.pct);
      return s + (Number.isFinite(p) && p > 0 ? p : 0);
    }, 0);

    if (!Number.isFinite(pctSum) || pctSum <= 0) {
      return { minOg: 1.0, maxOg: NaN, reason: "no-ratios" as const };
    }

    // K = Σ (r_i / gpPerL_i)
    let K = 0;
    for (const r of draftRatios) {
      const p = parseNumber(r.pct);
      if (!Number.isFinite(p) || p <= 0) continue;

      const sg = sgById.get(r.lineId);
      if (!Number.isFinite(sg!))
        return { minOg: 1.0, maxOg: NaN, reason: "bad-sg" as const };
      if (sg! <= 1)
        return { minOg: 1.0, maxOg: 1.0, reason: "non-fermentable" as const };

      const gpPerL = (sg! - 1) * 1000;
      if (!Number.isFinite(gpPerL) || gpPerL <= 0)
        return { minOg: 1.0, maxOg: NaN, reason: "bad-gp" as const };

      const frac = p / pctSum; // normalized ratio
      K += frac / gpPerL;
    }

    if (!Number.isFinite(K) || K <= 0) {
      return { minOg: 1.0, maxOg: NaN, reason: "bad-k" as const };
    }

    const maxOg = 1 + 1 / (1000 * K);

    // keep it sane for display; logic uses raw maxOg
    return {
      minOg: 1.0,
      maxOg,
      reason: null
    };
  }, [draftRatios, primaryLines]);

  const ogNum = useMemo(() => {
    const n = parseNumber(og);
    return Number.isFinite(n) ? n : NaN;
  }, [og]);

  const ogMaxFinite = Number.isFinite(ogBounds.maxOg);
  const ogTooHigh =
    og.trim() !== "" &&
    ogMaxFinite &&
    Number.isFinite(ogNum) &&
    ogNum > ogBounds.maxOg + 0.0005; // tiny tolerance

  const ogWarningText = useMemo(() => {
    if (!ogMaxFinite) {
      if (ogBounds.reason === "non-fermentable")
        return t("primaryTargets.ogImpossible");
      return t("primaryTargets.ogUnknown");
    }

    const maxDisp = ogBounds.maxOg.toFixed(3);
    if (ogTooHigh) {
      return t("primaryTargets.ogTooHigh", {
        maxDisp
      });
    }

    return t("primaryTargets.ogRange", { maxDisp });
  }, [ogMaxFinite, ogBounds, ogTooHigh, t]);

  const canSubmit =
    og.trim() !== "" &&
    volume.trim() !== "" &&
    primaryLines.length > 0 &&
    Number.isFinite(ratiosSum) &&
    Math.abs(ratiosSum - 100) < 0.5 &&
    !ogTooHigh; // NEW: block impossible OG (remove if you truly only want warning)

  const handleSubmit = () => {
    setPrimaryTargetsWithRatios({
      targetOg: parseNumber(og),
      targetVolume: parseNumber(volume),
      ratios: draftRatios.map((r) => ({
        lineId: r.lineId,
        pct: parseNumber(r.pct)
      }))
    });

    setOpen(false);
    setOgAndVolume({ og: "", volume: "" });
  };

  const handleClose = () => {
    setOpen(false);
    setOgAndVolume({ og: "", volume: "" });
  };

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setOpen(true)}
        disabled={primaryLines.length === 0}
      >
        {t("primaryTargets.open")}
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {t("primaryTargets.dialogTitle")}
              <Tooltip body={t("primaryTargets.tooltip")} />
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("primaryTargets.dialogDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-4 py-2">
            {/* OG */}
            <div className="grid gap-1">
              <InputGroup className="h-12">
                <InputGroupInput
                  placeholder={t("placeholder.og")}
                  value={og}
                  onChange={(e) => {
                    if (isValidNumber(e.target.value)) {
                      setOgAndVolume({ og: e.target.value, volume });
                    }
                  }}
                  inputMode="decimal"
                  onFocus={(e) => e.target.select()}
                  className="text-lg"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="mr-1 text-xs sm:text-sm"
                >
                  {t("SG")}
                </InputGroupAddon>
              </InputGroup>

              <p
                className={[
                  "text-xs",
                  ogTooHigh ? "text-destructive" : "text-muted-foreground"
                ].join(" ")}
              >
                {ogWarningText}
              </p>
            </div>

            {/* Volume */}
            <InputGroup className="h-12">
              <InputGroupInput
                placeholder={t("placeholder.volume")}
                value={volume}
                onChange={(e) => {
                  if (isValidNumber(e.target.value)) {
                    setOgAndVolume({ og, volume: e.target.value });
                  }
                }}
                inputMode="decimal"
                onFocus={(e) => e.target.select()}
                className="text-lg"
              />
              <InputGroupAddon
                align="inline-end"
                className="mr-1 text-xs sm:text-sm"
              >
                {unitDefaults.volume}
              </InputGroupAddon>
            </InputGroup>

            {/* Ratios header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {t("primaryTargets.ratios")}
                </p>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setLockToCurrent((v) => !v)}
                  aria-pressed={lockToCurrent}
                >
                  {!lockToCurrent
                    ? t("primaryTargets.locked")
                    : t("primaryTargets.unlocked")}
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={resetRatios}
                  disabled={lockToCurrent}
                >
                  {t("reset")}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  {t("primaryTargets.sum")}: {round2(ratiosSum)}%
                </p>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={normalize}
                  disabled={lockToCurrent}
                >
                  {t("primaryTargets.normalize")}
                </Button>
              </div>
            </div>

            {/* Ratios list */}
            <div className="grid gap-3">
              {draftRatios.map((r) => (
                <div
                  key={r.lineId}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center"
                >
                  <p className="text-sm truncate sm:col-span-2">{r.name}</p>

                  <InputGroup className="h-10">
                    <InputGroupInput
                      value={r.pct}
                      disabled={lockToCurrent}
                      onChange={(e) => setPct(r.lineId, e.target.value)}
                      inputMode="decimal"
                      onFocus={(e) => e.target.select()}
                      className="text-sm"
                    />
                    <InputGroupAddon
                      align="inline-end"
                      className="mr-1 text-xs"
                    >
                      %
                    </InputGroupAddon>
                  </InputGroup>
                </div>
              ))}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleClose}>
              {t("cancel")}
            </AlertDialogCancel>

            <AlertDialogAction asChild>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {t("SUBMIT")}
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
