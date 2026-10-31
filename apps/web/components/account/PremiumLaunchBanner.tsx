"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/auth/useAuth";
import { usePremiumAccess } from "@/hooks/reactQuery/usePremiumAccess";
import { useBanner } from "@/components/ui/banner";
import { shouldShowPremiumLaunchNotice } from "@/lib/utils/premium-launch-notice";

export default function PremiumLaunchBanner() {
  const { user, loading } = useAuth();
  const { data: status, isError } = usePremiumAccess();
  const { showBanner, dismissBanner } = useBanner();
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  const dismissedThisVisit = useRef(new Set<string>());
  const userId = user?.id;
  const locale = i18n.resolvedLanguage || "en";
  const href = `${locale === "en" ? "" : `/${locale}`}/account/premium`;
  const onPremiumPage = pathname?.replace(/\/$/, "").endsWith("/account/premium") ?? false;
  const subscriptionsEnabled = status?.subscriptionsEnabled;
  const entitled = status?.entitled;
  const paymentRestricted = status?.paymentRestricted;

  useEffect(() => {
    if (loading || isError || userId == null) return;
    const storageKey = `premium-launch-v1:${userId}`;
    let dismissed = dismissedThisVisit.current.has(storageKey);
    try {
      dismissed ||= localStorage.getItem(storageKey) === "true";
    } catch {
      // Keep the banner usable when browser storage is blocked.
    }
    if (!shouldShowPremiumLaunchNotice({
      signedIn: true, dismissed, onPremiumPage,
      status: subscriptionsEnabled === undefined ? undefined : {
        subscriptionsEnabled, entitled: entitled ?? false, paymentRestricted: paymentRestricted ?? false,
      },
    })) return;

    const rememberDismissal = () => {
      dismissedThisVisit.current.add(storageKey);
      try {
        localStorage.setItem(storageKey, "true");
      } catch {
        // The in-memory dismissal still lasts for this visit.
      }
    };
    const id = showBanner({
      title: t("premium.banner.title"),
      description: <span>
        {t("premium.banner.description")} {" "}
        <Link href={href} className="underline" onClick={() => {
          rememberDismissal();
          dismissBanner(id);
        }}>{t("premium.banner.link")}</Link>
      </span>,
      dismissLabel: t("premium.banner.dismiss"),
      onDismiss: rememberDismissal,
    });
    return () => dismissBanner(id);
  }, [loading, isError, userId, subscriptionsEnabled, entitled, paymentRestricted,
    onPremiumPage, href, t, showBanner, dismissBanner]);

  return null;
}
