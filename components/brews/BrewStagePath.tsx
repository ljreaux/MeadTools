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
import { useTranslation } from "react-i18next";
import { STAGE_CONFIG, STAGE_FLOW, type StageStatus } from "./stageConfig";
import { useRecipe } from "@/components/providers/RecipeProvider";

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
  stage,
  onMoveToStage
}: {
  stage: BrewStage;
  onMoveToStage: (to: BrewStage) => Promise<void>;
}) {
  const { t } = useTranslation();
  const currentIdx = idxOf(stage);

  const {
    data: { ingredients }
  } = useRecipe();

  return (
    <Path currentId={stage} defaultActiveId={stage} className="p-4">
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
              hasRecipeLinked: true, // TODO wire to real brew.recipe_id presence
              recipe: { ingredients }
            };

            // ✅ helpers stay here; panels/actions can use them
            const helpers = {
              moveToStage: onMoveToStage,
              addAddition: async () => {},
              addAdditions: async () => {}
            };

            const prereqs = cfg.prereqs ?? [];
            const unmet = prereqs.filter((p) => !p.isMet(ctx));

            const actions = (cfg.actions ?? []).filter((a) =>
              a.when ? a.when(status, ctx) : true
            );

            const Panel = cfg.Panel;

            return (
              <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{cfg.title(t)}</div>

                  <Button size="sm" onClick={() => onMoveToStage(s)}>
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
                            {p.label(t)}
                            {!ok && p.hint ? (
                              <span className="block text-xs opacity-90 mt-1">
                                {p.hint(t)}
                              </span>
                            ) : null}
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
                          onClick={() => a.run(helpers)}
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
      </PathContent>
    </Path>
  );
}
