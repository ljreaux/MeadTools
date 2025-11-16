"use client";

import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import Image from "next/image";

function Register() {
  const { t } = useTranslation();
  const { register, loginWithGoogle, user } = useAuth();
  const router = useRouter();
  const { theme, resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    if (user) {
      router.push("/account");
    }
  }, [user, router]);

  if (!isMounted) return null;

  const googleLogo =
    (theme || resolvedTheme) === "dark"
      ? "/assets/web_dark_rd_ctn.svg"
      : "/assets/web_light_rd_ctn.svg";

  return (
    <div className="h-screen flex items-center pt-24 flex-col space-y-4">
      <AuthForm
        formText={t("accountPage.register")}
        authFunction={register}
        formType="register"
      />

      <button
        onClick={() => router.push("/login")}
        className="font-bold underline transition-all text-foreground hover:text-sidebar"
      >
        {t("accountPage.buttonMessage.login")}
      </button>

      <div className="flex flex-col items-center space-y-2">
        <span className="text-lg">{t("accountPage.or")}</span>

        <button
          onClick={loginWithGoogle}
          className="relative w-64 h-14 rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t("accountPage.buttonMessage.googleLogin")}
        >
          <Image
            src={googleLogo}
            alt=""
            fill
            className="object-contain"
            sizes="256px"
          />
          <span className="sr-only">
            {t("accountPage.buttonMessage.googleLogin")}
          </span>
        </button>
      </div>
    </div>
  );
}

export default Register;
