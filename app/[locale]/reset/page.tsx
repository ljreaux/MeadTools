"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

async function requestPasswordReset(email: string) {
  const res = await fetch("/api/auth/request-reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });

  const result = await res.json();

  if (!res.ok) {
    throw new Error(result.error || "Failed to send reset link.");
  }

  return result;
}

export default function ResetRequestPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");

  const resetMutation = useMutation({
    mutationFn: requestPasswordReset,
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Check your email for a reset link."
      });
      setEmail("");
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : t("error.generic", "Something went wrong.");

      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    resetMutation.mutate(email);
  };

  const loading = resetMutation.isPending;

  return (
    <div className="h-screen flex items-center pt-24 flex-col space-y-4">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-3 items-center justify-center gap-4 p-8 my-8 w-11/12 max-w-[50rem] rounded-xl bg-background"
      >
        <h1 className="col-span-3 text-center text-2xl">
          {t(
            "accountPage.buttonMessage.forgotPassword",
            "Forgot your password?"
          )}
        </h1>

        <Label htmlFor="email">{t("accountPage.email")}</Label>
        <Input
          id="email"
          type="email"
          className="col-span-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />

        <LoadingButton
          type="submit"
          variant="secondary"
          className="col-span-3"
          loading={loading}
        >
          {t("accountPage.reset", "Send reset link")}
        </LoadingButton>
      </form>
    </div>
  );
}
