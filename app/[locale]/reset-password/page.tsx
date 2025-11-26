"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useToast } from "@/hooks/use-toast";
import { PasswordInput } from "@/components/PasswordInput";
import { useTranslation } from "react-i18next";

type ResetPayload = {
  token: string;
  password: string;
};

async function resetPassword({ token, password }: ResetPayload) {
  const res = await fetch("/api/auth/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, password })
  });

  const result = await res.json();

  if (!res.ok) {
    throw new Error(result.error || "Failed to reset password.");
  }

  return result;
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const resetMutation = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Password updated. Please log in."
      });
      router.push("/login");
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : "Failed to reset password.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast({
        title: "Error",
        description: "Missing or invalid reset token.",
        variant: "destructive"
      });
      return;
    }

    if (password !== confirm) {
      toast({
        title: "Error",
        description: "Passwords do not match.",
        variant: "destructive"
      });
      return;
    }

    resetMutation.mutate({ token, password });
  };

  const loading = resetMutation.isPending;

  return (
    <div className="h-screen flex items-center pt-24 flex-col space-y-4">
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-3 items-center justify-center gap-4 p-8 my-8 w-11/12 max-w-[50rem] rounded-xl bg-background"
      >
        <h1 className="col-span-3 text-center text-2xl">
          {t("accountPage.reset", "Reset Your Password")}
        </h1>

        <Label htmlFor="password">{t("accountPage.password")}</Label>
        <PasswordInput
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="col-span-2"
          required
          disabled={loading}
        />

        <Label htmlFor="confirm">
          {t("accountPage.confirmPassword", "Confirm")}
        </Label>
        <PasswordInput
          id="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="col-span-2"
          required
          disabled={loading}
        />

        <LoadingButton
          type="submit"
          variant="secondary"
          className="col-span-3"
          loading={loading}
        >
          {t("accountPage.reset", "Reset Password")}
        </LoadingButton>
      </form>
    </div>
  );
}
