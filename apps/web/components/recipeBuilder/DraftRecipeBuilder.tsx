"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DraftHandoff } from "@meadtools/recipe-workflows/draft-handoff";
import { openDraftHandoff } from "@/lib/draft-handoff";
import { RecipeProvider } from "../providers/RecipeProvider";
import RecipeBuilder from "./RecipeBuilder";
import { CardWrapper } from "../CardWrapper";

export default function DraftRecipeBuilder() {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<{
    handoff: DraftHandoff;
    key: string;
    returnPath: string;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const opened = openDraftHandoff(
          window.location.href,
          localStorage,
          () => crypto.randomUUID()
        );
        window.history.replaceState(null, "", opened.returnPath);
        setDraft(opened);
      } catch {
        setFailed(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (failed)
    return (
      <p role="alert" className="mx-auto max-w-xl px-4 py-28">
        {t("draftHandoff.invalid")}
      </p>
    );
  if (!draft) return null;
  return (
    <RecipeProvider>
      <aside
        className="flex w-full justify-center pt-24"
        aria-label={t("draftHandoff.title")}
      >
        <CardWrapper>
          <h1 className="text-2xl">{draft.handoff.name}</h1>
          <p>{t("draftHandoff.unsaved")}</p>
          <ul className="list-disc pl-5">
            {[...draft.handoff.warnings, ...draft.handoff.assumptions].map(
              (message, index) => (
                <li key={index}>{message}</li>
              )
            )}
          </ul>
        </CardWrapper>
      </aside>
      <RecipeBuilder
        compactTop
        storageKey={draft.key}
        draftName={draft.handoff.name}
        draftAdvanced={draft.handoff.recipeData.flags?.advanced}
        returnPath={draft.returnPath}
      />
    </RecipeProvider>
  );
}
