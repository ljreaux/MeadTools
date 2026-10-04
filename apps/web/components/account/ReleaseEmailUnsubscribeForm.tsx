"use client";

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export default function ReleaseEmailUnsubscribeForm({
  token,
}: {
  token: string;
}) {
  const { t } = useTranslation();
  const [state, setState] = useState<"ready" | "saving" | "done" | "error">(
    "ready",
  );

  const unsubscribe = async () => {
    setState("saving");
    try {
      const response = await fetch("/api/release-emails/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      setState(response.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  };

  if (state === "done")
    return (
      <p role="status">
        {t("releaseEmails.unsubscribeDone")}
      </p>
    );
  return (
    <div className="space-y-4">
      <p>
        {t("releaseEmails.unsubscribeDescription")}
      </p>
      <Button type="button" disabled={state === "saving"} onClick={unsubscribe}>
        {t("releaseEmails.unsubscribeButton")}
      </Button>
      {state === "error" && (
        <p className="text-destructive" role="alert">
          {t("releaseEmails.unsubscribeError")}
        </p>
      )}
    </div>
  );
}
