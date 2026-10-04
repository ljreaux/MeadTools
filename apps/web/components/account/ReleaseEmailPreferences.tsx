"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReleaseEmailPreferencesUpdateBody } from "@meadtools/api-contract/contracts";
import { useReleaseEmails } from "@/hooks/reactQuery/useReleaseEmails";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const products = ["web", "mobile", "chat", "api"] as const;
const emptyChoices: ReleaseEmailPreferencesUpdateBody = {
  web: false,
  mobile: false,
  chat: false,
  api: false,
};

export function ReleaseEmailPreferences({
  prompt = false,
}: {
  prompt?: boolean;
}) {
  const { t } = useTranslation();
  const { preferences, save } = useReleaseEmails();
  const [edits, setEdits] = useState<
    Partial<ReleaseEmailPreferencesUpdateBody>
  >({});
  const [saved, setSaved] = useState(false);
  const choices = {
    web: preferences.data?.web ?? false,
    mobile: preferences.data?.mobile ?? false,
    chat: preferences.data?.chat ?? false,
    api: preferences.data?.api ?? false,
    ...edits,
  };

  if (preferences.isLoading) return null;
  if (preferences.isError) {
    return (
      <p className="text-sm text-destructive">{t("releaseEmails.loadError")}</p>
    );
  }
  if (prompt && preferences.data?.prompted) return null;

  const saveChoices = (next: ReleaseEmailPreferencesUpdateBody) => {
    save.mutate(next, {
      onSuccess: () => {
        setEdits({});
        setSaved(true);
      },
    });
  };

  return (
    <section aria-label={t("releaseEmails.title")} className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">
          {t(prompt ? "releaseEmails.promptTitle" : "releaseEmails.title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            prompt
              ? "releaseEmails.promptDescription"
              : "releaseEmails.settingsDescription",
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-x-7 gap-y-3">
        {products.map((product) => (
          <label key={product} className="flex items-center gap-2 text-sm">
            <Switch
              checked={choices[product]}
              disabled={save.isPending}
              onCheckedChange={(checked) => {
                setEdits((current) => ({ ...current, [product]: checked }));
                setSaved(false);
              }}
              aria-label={t(`releaseNotes.products.${product}`)}
            />
            {t(`releaseNotes.products.${product}`)}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={save.isPending || !preferences.data}
          onClick={() => saveChoices(choices)}
        >
          {t("releaseEmails.save")}
        </Button>
        {prompt && (
          <Button
            type="button"
            variant="ghost"
            disabled={save.isPending}
            onClick={() => saveChoices(emptyChoices)}
          >
            {t("releaseEmails.noThanks")}
          </Button>
        )}
        {saved && !prompt && (
          <span className="text-sm" role="status">
            {t("releaseEmails.saved")}
          </span>
        )}
        {save.isError && (
          <span className="text-sm text-destructive" role="alert">
            {t("releaseEmails.saveError")}
          </span>
        )}
      </div>
    </section>
  );
}
