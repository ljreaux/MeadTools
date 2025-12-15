"use client";

import AuthForm from "@/components/AuthForm";
import { useAuth } from "@/hooks/auth/useAuth";
import { useRegister } from "@/hooks/reactQuery/useRegister";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import Image from "next/image";
import { signIn } from "next-auth/react";

function Register() {
  const { t } = useTranslation();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  const { user } = useAuth();
  const registerMutation = useRegister();

  // avoid hydration issues with next-themes
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // if already logged in, bounce to account
  useEffect(() => {
    if (user) {
      router.replace("/account");
    }
  }, [user, router]);

  if (!isMounted) return null;

  const isDark = resolvedTheme === "dark";
  const googleLogo = isDark
    ? "/assets/web_dark_rd_ctn.svg"
    : "/assets/web_light_rd_ctn.svg";

  return (
    <div className="h-screen flex items-center pt-24 flex-col space-y-4">
      <AuthForm
        formText={t("accountPage.register")}
        formType="register"
        authFunction={async (email, password, public_username) => {
          await registerMutation.mutateAsync({
            email,
            password,
            public_username
          });
        }}
      />

      <Button onClick={() => router.push("/login")} variant="link">
        {t("accountPage.buttonMessage.login")}
      </Button>

      <div className="flex flex-col items-center mt-6">
        <span className="text-sm text-muted-foreground leading-none">
          {t("accountPage.or")}
        </span>
      </div>

      <button
        onClick={() =>
          signIn("google", {
            callbackUrl: "/account"
          })
        }
        className="relative w-64 h-14 overflow-hidden rounded-full focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Image
          src={googleLogo}
          alt={t("accountPage.buttonMessage.googleLogin")}
          fill
          className="object-cover"
          sizes="256px"
          priority
        />
      </button>
    </div>
  );
}

export default Register;
