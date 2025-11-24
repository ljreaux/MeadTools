"use client";

import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/hooks/useAuth";
import { useLoginWithCredentials } from "@/hooks/useLoginWithCredentials";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import Image from "next/image";
import { signIn } from "next-auth/react";

function Login() {
  const { t } = useTranslation();
  const { isLoggedIn, loading } = useAuth();
  const loginMutation = useLoginWithCredentials();
  const router = useRouter();
  const { theme, resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  // avoid hydration issues with next-themes
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // if already logged in, bounce to account
  useEffect(() => {
    if (!loading && isLoggedIn) {
      router.replace("/account");
    }
  }, [loading, isLoggedIn, router]);

  if (!isMounted) {
    return null;
  }

  const googleLogo =
    (theme || resolvedTheme) === "dark"
      ? "/assets/web_dark_rd_ctn.svg"
      : "/assets/web_light_rd_ctn.svg";

  // Adapter so AuthForm gets the old-style signature
  const handleCredentialsLogin = async (
    email: string,
    password: string
  ): Promise<void> => {
    await loginMutation.mutateAsync({ email, password });
    // if the mutation succeeded, account-info will refetch
    // and the effect above will redirect to /account
  };

  return (
    <div className="h-screen flex items-center pt-24 flex-col space-y-4">
      <AuthForm
        formText={t("accountPage.login")}
        authFunction={handleCredentialsLogin}
      />

      <button
        onClick={() => router.push("/register")}
        className="font-bold underline transition-all text-foreground hover:text-sidebar"
      >
        {t("accountPage.buttonMessage.register")}
      </button>

      <div className="flex flex-col items-center space-y-2">
        <span className="text-lg">{t("accountPage.or")}</span>
        <button
          onClick={() => signIn("google")}
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

export default Login;
