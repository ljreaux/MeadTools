import { BREW_ENTRY_TYPE, type BrewStage } from "@/lib/brewEnums";
import { Path, PathActivePanel, PathContent, PathHeader, PathItem, PathList, PathTitle } from "@/components/ui/path";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { BrewEntry, getStageMoveDecision, STAGE_CONFIG, STAGE_FLOW, type StageStatus } from "./stageConfig";
import { OpenAddEntryArgs } from "./AddBrewEntryDialog";
import { useEffect, useState } from "react";
import { PatchAccountBrewMetadataInput } from "@/hooks/reactQuery/useAccountBrews";
import type { CreateBrewEntryInput } from "@/hooks/reactQuery/useAccountBrews";
import { RecordVolumeDialog } from "./RecordVolumeDialog";
import type { BrewRecipeStageData } from "@/lib/utils/buildBrewRecipeStageData";
import { entryPayload } from "@/lib/utils/entryPayload";
import { LogYeastDialog } from "@/components/brews/LogYeastDialog";
import { LogOriginalGravityDialog } from "@/components/brews/LogOriginalGravityDialog";

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
  addEntry,
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
    recipeAdditiveId?: string;
    kind?: "INGREDIENT" | "NUTRIENT" | "YEAST" | "OTHER";
    source?:
      | "recipe_ingredient"
      | "recipe_additive"
      | "recipe_nutrient"
      | "recipe_go_ferm"
      | "recipe_yeast"
      | "manual_yeast"
      | "manual";
    meta?: Record<string, any>;
  }) => Promise<void>;

  addAdditions: (
    inputs: Array<{
      name: string;
      amount?: number;
      unit?: string;
      note?: string;
      recipeIngredientId?: string;
      recipeAdditiveId?: string;
      kind?: "INGREDIENT" | "NUTRIENT" | "YEAST" | "OTHER";
      source?:
        | "recipe_ingredient"
        | "recipe_additive"
        | "recipe_nutrient"
        | "recipe_go_ferm"
        | "recipe_yeast"
        | "manual_yeast"
        | "manual";
      meta?: Record<string, any>;
    }>
  ) => Promise<void>;
  addEntry: (input: CreateBrewEntryInput) => Promise<void>;
  hasRecipeLinked: boolean;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const currentIdx = idxOf(stage);
  const [activeId, setActiveId] = useState<BrewStage>(stage);
  const [recordVolumeOpen, setRecordVolumeOpen] = useState(false);
  const [originalGravityOpen, setOriginalGravityOpen] = useState(false);
  const [reviewStage, setReviewStage] = useState<BrewStage | null>(null);

  const numericRecipeFg =
    typeof recipe.recipeData?.fg === "string" ? Number(recipe.recipeData.fg) : recipe.recipeData?.fg;
  const suggestedOg = recipe.actual.suggestedOriginalGravity ?? recipe.derived?.gravity.ogPrimary ?? null;
  const suggestedOgSource = recipe.actual.suggestedOriginalGravitySource ?? "recipe";
  const estimatedFg =
    typeof numericRecipeFg === "number" && Number.isFinite(numericRecipeFg) && numericRecipeFg > 0
      ? numericRecipeFg
      : null;

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
          <div className="text-base font-semibold">{t(`brewStage.${stage}`)}</div>
        </div>

        <div className="text-sm text-muted-foreground">{t("brews.stagePathHint", "Click a stage to see actions.")}</div>
      </PathHeader>

      <PathContent className="space-y-3">
        <PathList>
          {STAGE_FLOW.map((s, i) => {
            const state = i < currentIdx ? "complete" : i === currentIdx ? "current" : "upcoming";

            return <PathItem key={s} id={s} label={t(`brewStage.${s}`)} state={state} />;
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
                recipeData: recipe.recipeData,
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
              openStageMoveReview: (to: BrewStage) => {
                setActiveId(to);
                setReviewStage(to);
              },
              openRecordVolume: () => setRecordVolumeOpen(true),
              openOriginalGravityDialog: () => setOriginalGravityOpen(true),
              openFinalGravityDialog: () => {
                const recipeFg = recipe.recipeData?.fg;
                const numericRecipeFg = typeof recipeFg === "string" ? Number(recipeFg) : recipeFg;
                openAddEntry?.({
                  presetType: BREW_ENTRY_TYPE.GRAVITY,
                  gravityRole: "FG",
                  gravityDefaultValue:
                    typeof numericRecipeFg === "number" && Number.isFinite(numericRecipeFg) && numericRecipeFg > 0
                      ? numericRecipeFg
                      : undefined,
                  gravitySource: "measured"
                });
              },
              acceptRecipeOriginalGravity: async () => {
                const recipeOg = recipe.derived?.gravity.ogPrimary;
                if (typeof recipeOg !== "number" || !Number.isFinite(recipeOg) || recipeOg <= 1) {
                  return;
                }
                await addEntry(
                  entryPayload.gravity(recipeOg, null, {
                    readingRole: "OG",
                    source: "recipe",
                    recipeValue: recipeOg
                  })
                );
              },
              patchBrewMetadata,
              openLinkRecipePage: () => {
                if (linkRecipeHref) router.push(linkRecipeHref);
              },
              addAddition,
              addAdditions,
              addEntry,
              openAddEntry
            };
            const prereqs = cfg.prereqs ?? [];
            const moveDecision = getStageMoveDecision(s, stage, ctx);
            const unmet = moveDecision.unmet;

            const actions = (cfg.actions ?? []).filter((a) => (a.when ? a.when(status, ctx) : true));
            const visiblePrereqs =
              stage === "PRIMARY" && s === "SECONDARY" && !ctx.recipe.actual.originalGravity
                ? prereqs.filter((p) => p.id !== "primaryHasFinalGravity")
                : prereqs;

            const Panel = cfg.Panel;
            const isBlocked = !moveDecision.allowed && !moveDecision.isNoOp;
            const warnings = (cfg.warnings ?? []).filter((w) => w.isActive(ctx) && w.when(status, ctx));
            return (
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{cfg.title(t)}</div>

                  <Button
                    size="sm"
                    onClick={async () => {
                      if (stage === "PRIMARY" && s === "SECONDARY") {
                        setReviewStage(s);
                        return;
                      }
                      if (!moveDecision.allowed) return;
                      await onMoveToStage(s);
                      setActiveId(s);
                    }}
                    disabled={moveDecision.isNoOp || (isBlocked && !(stage === "PRIMARY" && s === "SECONDARY"))}
                    title={
                      isBlocked
                        ? t("brews.prereqsNotMet", "Some items are not complete yet.")
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

                {cfg.description ? <div className="text-sm text-muted-foreground">{cfg.description(t)}</div> : null}

                {status === "future" && visiblePrereqs.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{t("brews.beforeYouProceed", "Before you proceed")}</div>

                    <ul className="text-sm text-muted-foreground list-disc pl-5">
                      {visiblePrereqs.map((p) => {
                        const ok = p.isMet(ctx);
                        return (
                          <li key={p.id} className={ok ? "opacity-70" : ""}>
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <span>{p.label(t)}</span>
                                {!ok && p.hint ? (
                                  <span className="block text-xs opacity-90 mt-1">{p.hint(t)}</span>
                                ) : null}
                              </div>

                              {!ok && p.id === "primaryHasGravity" ? (
                                <Button size="sm" variant="secondary" onClick={() => p.run?.(helpers, ctx)}>
                                  {t("brews.actions.logOg", "Log OG")}
                                </Button>
                              ) : null}

                              {!ok && p.id !== "primaryHasGravity" && p.run && p.actionLabel ? (
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
                        {t("brews.prereqsNotMet", "Some items are not complete yet.")}
                      </div>
                    )}
                  </div>
                )}

                {actions.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium">{t("brews.actions", "Actions")}</div>
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
                {Panel ? <Panel t={t} status={status} ctx={ctx} helpers={helpers} warnings={warnings} /> : null}

                {!Panel && warnings.length > 0 && (
                  <div className="space-y-2">
                    {warnings.map((w) => (
                      <div key={w.id} className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm">
                        {w.message(t)}
                      </div>
                    ))}
                  </div>
                )}

                <StageMoveReviewDialog
                  open={reviewStage === s}
                  onOpenChange={(open) => {
                    if (!open) setReviewStage(null);
                  }}
                  title={t("brews.moveToSecondary", "Move to Secondary")}
                  required={STAGE_CONFIG.SECONDARY.prereqs ?? []}
                  warnings={[...(STAGE_CONFIG.PRIMARY.warnings ?? []), ...(STAGE_CONFIG.SECONDARY.warnings ?? [])]}
                  ctx={ctx}
                  helpers={helpers}
                  onMove={async () => {
                    const decision = getStageMoveDecision("SECONDARY", stage, ctx);
                    if (!decision.allowed) return;
                    await onMoveToStage("SECONDARY");
                    setActiveId("SECONDARY");
                    setReviewStage(null);
                  }}
                />
              </div>
            );
          }}
        />
        <RecordVolumeDialog
          t={t}
          open={recordVolumeOpen}
          onOpenChange={setRecordVolumeOpen}
          currentVolumeLiters={current_volume_liters ?? recipe.effective.currentVolumeL}
          intent="secondaryVolume"
          onSave={async (volume, meta) => {
            await patchBrewMetadata({ current_volume_liters: volume });
            await addEntry(
              entryPayload.volume({
                liters: volume,
                displayValue: meta.displayValue,
                displayUnit: meta.displayUnit,
                startingLiters: meta.startingLiters
              })
            );
          }}
        />
        <LogOriginalGravityDialog
          open={originalGravityOpen}
          onOpenChange={setOriginalGravityOpen}
          suggestedOg={
            typeof suggestedOg === "number" && Number.isFinite(suggestedOg) && suggestedOg > 1 ? suggestedOg : null
          }
          suggestedOgSource={suggestedOgSource}
          estimatedFg={estimatedFg}
          onSave={async (input) => {
            await addEntry(
              entryPayload.gravity(input.chosenOg, input.note ?? null, {
                readingRole: "OG",
                source: "measured"
              })
            );
            await addEntry(
              entryPayload.gravity(input.fermentableSg, null, {
                readingRole: "GENERAL",
                source: "nutrient_basis",
                hidden: true,
                nutrientBasis: {
                  chosenOg: input.chosenOg,
                  suggestedOg: input.suggestedOg,
                  suggestedOgSource: input.suggestedOgSource,
                  estimatedFg: input.estimatedFg,
                  fermentableSg: input.fermentableSg,
                  warningAcknowledged: input.warningAcknowledged
                }
              })
            );
          }}
        />
      </PathContent>
    </Path>
  );
}

function StageMoveReviewDialog({
  open,
  onOpenChange,
  title,
  required,
  warnings,
  ctx,
  helpers,
  onMove
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  required: NonNullable<(typeof STAGE_CONFIG)["SECONDARY"]["prereqs"]>;
  warnings: NonNullable<(typeof STAGE_CONFIG)["PRIMARY"]["warnings"]>;
  ctx: Parameters<NonNullable<(typeof warnings)[number]["isActive"]>>[0];
  helpers: Parameters<NonNullable<(typeof required)[number]["run"]>>[0];
  onMove: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [yeastOpen, setYeastOpen] = useState(false);
  const unmet = required.filter((item) => !item.isMet(ctx));
  const hasOriginalGravity = required.find((item) => item.id === "primaryHasGravity")?.isMet(ctx) ?? true;
  const visibleRequired = required.filter((item) => item.id !== "primaryHasFinalGravity" || hasOriginalGravity);
  const activeWarnings = warnings
    .filter((warning, index, all) => all.findIndex((item) => item.id === warning.id) === index)
    .filter((warning) => warning.isActive(ctx));
  const canMove = unmet.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">{t("brews.requiredBeforeMoving", "Required before moving")}</div>
            <ul className="space-y-2">
              {visibleRequired.map((item) => {
                const ok = item.isMet(ctx);
                return (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-2 text-sm"
                  >
                    <div className={ok ? "text-muted-foreground" : ""}>
                      <span>
                        {ok ? "✓ " : ""}
                        {item.label(t)}
                      </span>
                      {!ok && item.hint ? (
                        <div className="mt-1 text-xs text-muted-foreground">{item.hint(t)}</div>
                      ) : null}
                    </div>
                    {!ok && item.id === "primaryHasGravity" ? (
                      <Button size="sm" variant="secondary" onClick={() => item.run?.(helpers, ctx)}>
                        {t("brews.actions.logOg", "Log OG")}
                      </Button>
                    ) : null}
                    {!ok && item.id === "primaryHasYeast" ? (
                      <Button size="sm" variant="secondary" onClick={() => setYeastOpen(true)}>
                        {t("brews.actions.logYeast", "Log yeast")}
                      </Button>
                    ) : null}
                    {!ok && item.id !== "primaryHasGravity" && item.run && item.actionLabel ? (
                      <Button size="sm" variant="secondary" onClick={() => item.run?.(helpers, ctx)}>
                        {item.actionLabel(t)}
                      </Button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">{t("brews.warnings", "Warnings")}</div>
            {activeWarnings.length ? (
              <ul className="space-y-2">
                {activeWarnings.map((warning) => (
                  <li
                    key={warning.id}
                    className="rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-sm"
                  >
                    {warning.message(t)}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-muted-foreground">{t("brews.noWarnings", "No active warnings.")}</div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("cancel", "Cancel")}
          </Button>
          <Button disabled={!canMove} onClick={onMove}>
            {t("brews.moveToSecondary", "Move to Secondary")}
          </Button>
        </DialogFooter>
      </DialogContent>
      <LogYeastDialog
        open={yeastOpen}
        onOpenChange={setYeastOpen}
        planned={ctx.recipe.yeast}
        forceManual={false}
        onSave={async (input) => {
          await helpers.addAddition(input);
          setYeastOpen(false);
        }}
      />
    </Dialog>
  );
}
