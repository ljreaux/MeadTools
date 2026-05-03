import type { BrewStage } from "@/lib/brewEnums";
import {
  Path,
  PathActivePanel,
  PathContent,
  PathHeader,
  PathItem,
  PathList,
  PathTitle
} from "@/components/ui/path";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import {
  BrewEntry,
  getStageMoveDecision,
  STAGE_CONFIG,
  STAGE_FLOW,
  type StageStatus
} from "./stageConfig";
import { OpenAddEntryArgs } from "./AddBrewEntryDialog";
import { useEffect, useState } from "react";
import { PatchAccountBrewMetadataInput } from "@/hooks/reactQuery/useAccountBrews";
import { RecordVolumeDialog } from "./RecordVolumeDialog";
import type { BrewRecipeStageData } from "@/lib/utils/buildBrewRecipeStageData";

function idxOf(stage: BrewStage) {
  const i = STAGE_FLOW.indexOf(stage);
  return i === -1 ? 0 : i;
}

function statusFor(i: number, currentIdx: number): StageStatus {
  if (i < currentIdx) return "past";
  if (i === currentIdx) return "current";
  return "future";
}

export function BrewStagePath({
  brewId,
  stage,
  onMoveToStage,
  entries,
  current_volume_liters,
  recipe,
  patchBrewMetadata,
  linkRecipeHref,
  openAddEntry,
  addAddition,
  addAdditions,
  hasRecipeLinked
}: {
  brewId: string;
  stage: BrewStage;
  onMoveToStage: (to: BrewStage) => Promise<void>;
  entries: BrewEntry[];

  current_volume_liters: number | null; // ✅ add
  recipe: BrewRecipeStageData;
  patchBrewMetadata: (input: PatchAccountBrewMetadataInput) => Promise<void>; // ✅ add
  linkRecipeHref?: string;

  openAddEntry: (args?: OpenAddEntryArgs) => void;
  addAddition: (input: {
    name: string;
    amount?: number;
    unit?: string;
    note?: string;
    recipeIngredientId?: string;
  }) => Promise<void>;

  addAdditions: (
    inputs: Array<{
      name: string;
      amount?: number;
      unit?: string;
      note?: string;
      recipeIngredientId?: string;
    }>
  ) => Promise<void>;
  hasRecipeLinked: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const currentIdx = idxOf(stage);
  const [activeId, setActiveId] = useState<BrewStage>(stage);
  const [recordVolumeOpen, setRecordVolumeOpen] = useState(false);

  useEffect(() => {
    setActiveId(stage);
  }, [stage]);

  return (
    <Path
      currentId={stage} // ✅ truth: brew stage
      activeId={activeId} // ✅ control selected panel
      onActiveChange={(id) => setActiveId(id as BrewStage)}
      className="p-4"
    >
      <PathHeader>
        <div className="space-y-0.5">
          <PathTitle>{t("stage", "Stage")}</PathTitle>
          <div className="text-base font-semibold">
            {t(`brewStage.${stage}`)}
          </div>
        </div>

        <div className="text-sm text-muted-foreground">
          {t("brews.stagePathHint", "Click a stage to see actions.")}
        </div>
      </PathHeader>

      <PathContent className="space-y-3">
        <PathList>
          {STAGE_FLOW.map((s, i) => {
            const state =
              i < currentIdx
                ? "complete"
                : i === currentIdx
                  ? "current"
                  : "upcoming";

            return (
              <PathItem
                key={s}
                id={s}
                label={t(`brewStage.${s}`)}
                state={state}
              />
            );
          })}
        </PathList>

        <PathActivePanel
          className="mt-3"
          render={(activeId) => {
            const s = activeId as BrewStage;
            const cfg = STAGE_CONFIG[s];
            const activeIdx = idxOf(s);
            const status = statusFor(activeIdx, currentIdx);

            // ✅ build ctx with recipe data for panels
            const ctx = {
              brewStage: stage,
              hasRecipeLinked,
              recipe: {
                ...recipe.planned,
                derived: recipe.derived,
                snapshot: recipe.snapshot,
                actual: recipe.actual,
                effective: recipe.effective
              },
              brew: {
                id: brewId,
                entries,
                current_volume_liters,
                effective_current_volume_liters: recipe.effective.currentVolumeL,
                latest_gravity: recipe.actual.latestGravity,
                effective_latest_gravity: recipe.effective.latestGravity
              }
            };
            const helpers = {
              moveToStage: async (to: BrewStage) => {
                const decision = getStageMoveDecision(to, stage, ctx);
                if (!decision.allowed) return;
                await onMoveToStage(to);
                setActiveId(to);
              },
              openRecordVolume: () => setRecordVolumeOpen(true),
              patchBrewMetadata,
              openLinkRecipePage: () => {
                if (linkRecipeHref) router.push(linkRecipeHref);
              },
              addAddition,
              addAdditions,
              openAddEntry
            };
            const prereqs = cfg.prereqs ?? [];
            const moveDecision = getStageMoveDecision(s, stage, ctx);
            const unmet = moveDecision.unmet;

            const actions = (cfg.actions ?? []).filter((a) =>
              a.when ? a.when(status, ctx) : true
            );

            const Panel = cfg.Panel;
            const isBlocked = !moveDecision.allowed && !moveDecision.isNoOp;
            const warnings = (cfg.warnings ?? []).filter((w) =>
              w.isActive(ctx) && w.when(status, ctx)
            );
            return (
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{cfg.title(t)}</div>

                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!moveDecision.allowed) return;
                      await onMoveToStage(s);
                      setActiveId(s);
                    }}
                    disabled={moveDecision.isNoOp || isBlocked}
                    title={
                      isBlocked
                        ? t(
                            "brews.prereqsNotMet",
                            "Some items are not complete yet."
                          )
                        : moveDecision.isNoOp
                          ? t("brews.stayHere", "You are here")
                        : undefined
                    }
                  >
                    {status === "past"
                      ? t("brews.moveBack", "Move back to this stage")
                      : status === "current"
                        ? t("brews.stayHere", "You are here")
                        : t("brews.moveToStage", "Move to this stage")}
                  </Button>
                </div>

                {cfg.description ? (
                  <div className="text-sm text-muted-foreground">
                    {cfg.description(t)}
                  </div>
                ) : null}

                {warnings.length > 0 && (
                  <div className="space-y-2">
                    {warnings.map((w) => (
                      <div
                        key={w.id}
                        className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm"
                      >
                        {w.message(t)}
                      </div>
                    ))}
                  </div>
                )}

                {status === "future" && prereqs.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      {t("brews.beforeYouProceed", "Before you proceed")}
                    </div>

                    <ul className="text-sm text-muted-foreground list-disc pl-5">
                      {prereqs.map((p) => {
                        const ok = p.isMet(ctx);
                        return (
                          <li key={p.id} className={ok ? "opacity-70" : ""}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <span>{p.label(t)}</span>
                                {!ok && p.hint ? (
                                  <span className="block text-xs opacity-90 mt-1">
                                    {p.hint(t)}
                                  </span>
                                ) : null}
                              </div>

                              {!ok && p.run && p.actionLabel ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="shrink-0"
                                  onClick={() => p.run?.(helpers, ctx)}
                                >
                                  {p.actionLabel(t)}
                                </Button>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    {unmet.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {t(
                          "brews.prereqsNotMet",
                          "Some items are not complete yet."
                        )}
                      </div>
                    )}
                  </div>
                )}

                {actions.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      {t("brews.actions", "Actions")}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {actions.map((a) => (
                        <Button
                          key={a.id}
                          size="sm"
                          variant={a.variant ?? "secondary"}
                          onClick={() => a.run(helpers, ctx)}
                        >
                          {a.label(t)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ✅ stage-specific UI lives in the stage config now */}
                {Panel ? (
                  <Panel t={t} status={status} ctx={ctx} helpers={helpers} />
                ) : null}
              </div>
            );
          }}
        />
        <RecordVolumeDialog
          t={t}
          open={recordVolumeOpen}
          onOpenChange={setRecordVolumeOpen}
          currentVolumeLiters={current_volume_liters}
          onSave={(volume) =>
            patchBrewMetadata({ current_volume_liters: volume })
          }
        />
      </PathContent>
    </Path>
  );
}
