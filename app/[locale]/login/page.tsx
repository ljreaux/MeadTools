"use client";

import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/hooks/auth/useAuth";
import { useLoginWithCredentials } from "@/hooks/reactQuery/useLoginWithCredentials";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

function Login() {
  const { t } = useTranslation();
  const { isLoggedIn, loading } = useAuth();
  const loginMutation = useLoginWithCredentials();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
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

  const isDark = resolvedTheme === "dark"; // use resolvedTheme only
  const googleLogo = isDark
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

      <Button onClick={() => router.push("/register")} variant="link">
        {t("accountPage.buttonMessage.register")}
      </Button>

      <div className="flex flex-col items-center mt-6">
        <span className="text-sm text-muted-foreground leading-none">
          {t("accountPage.or")}
        </span>
      </div>
      <button
        onClick={() => signIn("google")}
        className="relative w-64 h-14 overflow-hidden rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Image
          src={googleLogo}
          alt={t("accountPage.buttonMessage.googleLogin")}
          fill
          className="object-cover" // <— key change from contain
          sizes="256px"
          priority
        />
      </button>
    </div>
  );
}

export default Login;
