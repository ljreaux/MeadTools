"use client";

import { useTranslation } from "react-i18next";
import { Input } from "./ui/input";
import { useState } from "react";
import { PasswordInput } from "./PasswordInput";
import { LoadingButton } from "./ui/LoadingButton";
import Tooltip from "./Tooltips";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";

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
      className="flex flex-col md:p-12 p-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1200px]"
      onSubmit={handleSubmit}
    >
      <h1 className="col-span-3 text-center text-2xl">{formText}</h1>
      <label htmlFor="email">
        {t("accountPage.email")}

        <Input
          type="email"
          id="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="col-span-2"
          disabled={loading} // Disable input during loading
        />
      </label>

      {formType === "register" && (
        <>
          <label htmlFor="public_username">
            <span className="flex items-center">
              {t("publicUsername.label")}
              <Tooltip body={t("publicUsername.description")}></Tooltip>
            </span>
            <Input
              type="text"
              id="public_username"
              value={formData.public_username}
              onChange={(e) =>
                setFormData({ ...formData, public_username: e.target.value })
              }
              className="col-span-2"
              disabled={loading} // Disable input during loading
            />{" "}
          </label>
        </>
      )}

      <label htmlFor="password">
        {t("accountPage.password")}
        <PasswordInput
          id="password"
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
          className="col-span-2"
          disabled={loading} // Disable input during loading
        />
      </label>

      <LoadingButton
        type="submit"
        variant={"secondary"}
        className="col-span-3"
        loading={loading}
      >
        {formText}
      </LoadingButton>
      {formType !== "register" && (
        <Button onClick={() => router.push("/reset")} variant="link">
          {t(
            "accountPage.buttonMessage.forgotPassword",
            "Forgot your password?"
          )}
        </Button>
      )}
    </form>
  );
}

export default AuthForm;
