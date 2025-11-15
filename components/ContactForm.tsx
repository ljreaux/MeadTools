"use client";

import { FormEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";

const ContactUs = () => {
  const { toast } = useToast();
  const { t } = useTranslation();
  const form = useRef<HTMLFormElement | null>(null);
  const [disabled, setDisabled] = useState(false);

  const sendEmail = async (e: FormEvent) => {
    e.preventDefault();
    setDisabled(true);

    if (!form.current) return;

    const formData = new FormData(form.current);

    const payload = {
      user_name: formData.get("user_name") as string,
      user_email: formData.get("user_email") as string,
      message: formData.get("message") as string
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        toast({ description: t("success") });
        form.current.reset();
      } else {
        toast({
          description: result.error || t("error"),
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast({ description: t("error"), variant: "destructive" });
    } finally {
      setDisabled(false);
    }
  };

  return (
    <form ref={form} onSubmit={sendEmail} className="grid w-full gap-6">
      {/* Name Field */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="user_name"
          className="font-medium text-sm text-foreground"
        >
          {t("name")}
        </label>
        <Input
          id="user_name"
          name="user_name"
          type="text"
          required
          disabled={disabled}
        />
      </div>

      {/* Email Field */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="user_email"
          className="font-medium text-sm text-foreground"
        >
          {t("email")}
        </label>
        <Input
          id="user_email"
          name="user_email"
          type="email"
          required
          disabled={disabled}
        />
      </div>

      {/* Message Field */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="message"
          className="font-medium text-sm text-foreground"
        >
          {t("message")}
        </label>
        <Textarea id="message" name="message" required disabled={disabled} />
      </div>

      {/* Submit Button */}
      <div className="flex justify-center">
        <Button
          variant={"secondary"}
          type="submit"
          disabled={disabled}
          className="px-10"
        >
          {disabled ? <Spinner /> : t("send")}
        </Button>
      </div>
    </form>
  );
};

export default ContactUs;
