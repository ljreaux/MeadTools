"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReleaseEmailPreferencesUpdateBody } from "@meadtools/api-contract/contracts";
import { useReleaseEmails } from "@/hooks/reactQuery/useReleaseEmails";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export function ReleaseEmailPreferences({
  prompt = false,
}: {
  prompt?: boolean;
}) {
  const { t } = useTranslation();
  const { preferences, save } = useReleaseEmails();
  const [edit, setEdit] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const optedIn = edit ?? preferences.data?.optedIn ?? false;

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
        setEdit(null);
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
      <label className="flex items-center gap-2 text-sm">
        <Switch
          checked={optedIn}
          disabled={save.isPending}
          onCheckedChange={(checked) => { setEdit(checked); setSaved(false); }}
          aria-label={t("releaseEmails.optIn")}
        />
        {t("releaseEmails.optIn")}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={save.isPending || !preferences.data}
          onClick={() => saveChoices({ optedIn })}
        >
          {t("releaseEmails.save")}
        </Button>
        {prompt && (
          <Button
            type="button"
            variant="ghost"
            disabled={save.isPending}
            onClick={() => saveChoices({ optedIn: false })}
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
