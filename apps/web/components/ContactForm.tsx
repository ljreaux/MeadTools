"use client";

import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";
import { useMutation } from "@tanstack/react-query";

const ContactUs = ({ purpose = "contact" }: { purpose?: "contact" | "account-deletion" }) => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const formRef = useRef<HTMLFormElement | null>(null);
  const deletingAccount = purpose === "account-deletion";

  // --- React Query Mutation ---
  const sendMessage = useMutation({
    mutationFn: async (payload: {
      user_name: string;
      user_email: string;
      message: string;
    }) => {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to send message.");
      }

      return result;
    },

    onSuccess: () => {
      if (!deletingAccount) toast({ description: t("success") });
      formRef.current?.reset();
    },

    onError: (err) => {
      toast({
        description: deletingAccount ? t("accountDeletion.sendError") : err.message || t("error"),
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;

    const formData = new FormData(formRef.current);

    sendMessage.mutate({
      user_name: formData.get("user_name") as string,
      user_email: formData.get("user_email") as string,
      message: deletingAccount ? "Request to delete my MeadTools account and associated data." : formData.get("message") as string
    });
  };

  return (
    <form method="post" ref={formRef} onSubmit={handleSubmit} className="grid w-full gap-4">
      {/* Name */}

      <label
        htmlFor="user_name"
        className="font-medium text-sm text-foreground"
      >
        {t("name")}
        <Input
          id="user_name"
          name="user_name"
          required
          disabled={sendMessage.isPending}
        />
      </label>

      {/* Email */}

      <label
        htmlFor="user_email"
        className="font-medium text-sm text-foreground"
      >
        {t(deletingAccount ? "accountDeletion.accountEmail" : "email")}
        <Input
          id="user_email"
          name="user_email"
          type="email"
          required
          disabled={sendMessage.isPending}
        />
      </label>

      {deletingAccount ? null : <label htmlFor="message" className="font-medium text-sm text-foreground">
        {t("message")}
        <Textarea
          id="message"
          name="message"
          required
          disabled={sendMessage.isPending}
        />
      </label>}

      {/* Submit Button */}

      <Button
        variant="secondary"
        type="submit"
        disabled={sendMessage.isPending}
      >
        {sendMessage.isPending ? <Spinner /> : t(deletingAccount ? "accountDeletion.submit" : "send")}
      </Button>
      {deletingAccount && sendMessage.isSuccess ? (
        <p role="status" className="text-sm text-foreground">{t("accountDeletion.submitted")}</p>
      ) : null}
    </form>
  );
};

export default ContactUs;
