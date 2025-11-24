"use client";

import { useTranslation } from "react-i18next";
import { Input } from "./ui/input";
import { useState } from "react";
import { PasswordInput } from "./PasswordInput";
import { LoadingButton } from "./ui/LoadingButton";
import Tooltip from "./Tooltips";
import { useRouter } from "next/navigation";

function AuthForm({
  formText,
  authFunction,
  formType
}: {
  formText: string;
  authFunction: (
    email: string,
    password: string,
    public_username?: string
  ) => Promise<void>;
  formType?: "register";
}) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    public_username?: string;
  }>({
    email: "",
    password: "",
    public_username: ""
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { email, password, public_username } = formData;
    setLoading(true);
    try {
      await authFunction(email, password, public_username);
    } catch (error) {
      console.error("Authentication failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className="grid grid-cols-3 items-center justify-center gap-4 p-8 my-8 w-11/12 max-w-[50rem] rounded-xl bg-background"
      onSubmit={handleSubmit}
    >
      <h1 className="col-span-3 text-center text-2xl">{formText}</h1>
      <label htmlFor="email">{t("accountPage.email")}</label>

      <Input
        type="email"
        id="email"
        required
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        className="col-span-2"
        disabled={loading} // Disable input during loading
      />

      {formType === "register" && (
        <>
          <label htmlFor="public_username">
            {t("publicUsername.label")}
            <Tooltip body={t("publicUsername.description")}></Tooltip>
          </label>
          <Input
            type="text"
            id="public_username"
            value={formData.public_username}
            onChange={(e) =>
              setFormData({ ...formData, public_username: e.target.value })
            }
            className="col-span-2"
            disabled={loading} // Disable input during loading
          />
        </>
      )}

      <label htmlFor="password">{t("accountPage.password")}</label>
      <PasswordInput
        id="password"
        value={formData.password}
        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        className="col-span-2"
        disabled={loading} // Disable input during loading
      />

      <LoadingButton
        type="submit"
        variant={"secondary"}
        className="col-span-3"
        loading={loading}
      >
        {formText}
      </LoadingButton>
      {formType !== "register" && (
        <button
          onClick={() => router.push("/reset")}
          className="text-sm text-muted-foreground hover:text-foreground underline self-center col-span-full"
        >
          {t(
            "accountPage.buttonMessage.forgotPassword",
            "Forgot your password?"
          )}
        </button>
      )}
    </form>
  );
}

export default AuthForm;
