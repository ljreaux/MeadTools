"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import type { DraftHandoff } from "@meadtools/recipe-workflows/draft-handoff";
import { openDraftHandoff } from "@/lib/draft-handoff";
import { getStoredAccessToken } from "@/lib/auth/client-token";
import { isMcpDraftId, mcpDraftIdFromFragment } from "@/lib/mcp/draft-link";
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

  const [signInHref, setSignInHref] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function open() {
      const url = new URL(window.location.href);
      try {
        let resolvedDraft: DraftHandoff | undefined;
        const id = mcpDraftIdFromFragment(url.hash);
        if (id !== null) {
          if (!isMcpDraftId(id)) throw new Error("Invalid draft ID");
          const token = getStoredAccessToken();
          const response = await fetch("/mcp/draft", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(id),
            signal: controller.signal
          });
          if (response.status === 401) {
            const next = url.pathname + url.search + url.hash;
            if (!controller.signal.aborted)
              setSignInHref(`/login?${new URLSearchParams({ next })}`);
            return;
          }
          if (!response.ok) throw new Error("Draft unavailable");
          resolvedDraft = await response.json();
        }
        if (controller.signal.aborted) return;
        const opened = openDraftHandoff(
          url.href,
          localStorage,
          () => crypto.randomUUID(),
          resolvedDraft
        );
        window.history.replaceState(null, "", opened.returnPath);
        setDraft(opened);
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    }

    const frame = window.requestAnimationFrame(() => void open());
    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, []);

  if (signInHref)
    return (
      <p className="mx-auto max-w-xl px-4 py-28">
        <Link href={signInHref} className="underline">
          {t("accountPage.login")}
        </Link>
      </p>
    );
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
