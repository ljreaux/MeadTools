"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { usePremiumAccess } from "@/hooks/reactQuery/usePremiumAccess";
import Header from "./header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PremiumAccount() {
  const { t, i18n } = useTranslation();
  const searchParams = useSearchParams();
  const token = useAuthToken();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const claimed = useRef(false);

  const headers = useCallback(
    () => ({
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }),
    [token]
  );

  const premiumQuery = usePremiumAccess();
  const status = premiumQuery.data ?? null;
  const { refetch } = premiumQuery;

  useEffect(() => {
    const claim = searchParams.get("claim");
    if (!claim || claimed.current) return;
    claimed.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("claim");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    void (async () => {
      setBusy(true);
      try {
        const response = await fetch("/api/account/premium/kofi/claim", {
          method: "POST",
          headers: { ...headers(), "Content-Type": "application/json" },
          body: JSON.stringify({ token: claim })
        });
        if (!response.ok) throw new Error("Ko-fi claim failed");
        setNotice(t("premium.linked"));
        await refetch();
      } catch {
        setError(t("premium.claimFailed"));
      } finally {
        setBusy(false);
      }
    })();
  }, [headers, refetch, searchParams, t]);

  const sendLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/account/premium/kofi/link", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      if (!response.ok) throw new Error("Ko-fi link request failed");
      setNotice(t("premium.sent"));
    } catch {
      setError(t("premium.requestFailed"));
    } finally {
      setBusy(false);
    }
  };

  const openStripe = async (path: "checkout" | "portal") => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/account/premium/stripe/${path}`, {
        method: "POST",
        headers: headers()
      });
      if (!response.ok) throw new Error("Stripe billing request failed");
      const result = (await response.json()) as { url: string };
      const destination = new URL(result.url);
      if (
        destination.protocol !== "https:" ||
        !["checkout.stripe.com", "billing.stripe.com"].includes(
          destination.hostname
        )
      ) {
        throw new Error("Unexpected Stripe destination");
      }
      window.location.assign(destination.toString());
    } catch {
      setError(t("premium.stripeFailed"));
      setBusy(false);
    }
  };

  return (
    <main className="relative w-11/12 max-w-[1200px] rounded-xl bg-background px-4 py-6 sm:px-12 sm:py-8 space-y-5">
      <Header />
      <h1 className="text-2xl font-semibold sm:pt-10">{t("premium.title")}</h1>
      <p className="text-muted-foreground">
        {t(
          status ? (status.subscriptionsEnabled
            ? "premium.bundleAvailable"
            : "premium.bundleComingSoon") : "premium.bundleSummary"
        )}
      </p>
      {status && (
        <p role="status">
          {status.paymentRestricted
            ? t("premium.restricted")
            : status.premiumEnabled && status.paidThrough
              ? t("premium.active", {
                  date: new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                    dateStyle: "medium"
                  }).format(new Date(status.paidThrough))
                })
              : status.entitled
                ? t("premium.pendingLaunch")
                : t("premium.inactive")}
        </p>
      )}
      {status?.stripeLinked && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void openStripe("portal")}
        >
          {t("premium.manageStripe")}
        </Button>
      )}
      {status?.subscriptionsEnabled &&
        !status.premiumEnabled &&
        !status.paymentRestricted && (
          <div className="space-y-2">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void openStripe("checkout")}
            >
              {t("premium.subscribeStripe")}
            </Button>
            {status.kofiJoinUrl && (
              <div>
                <a
                  className="text-primary underline"
                  href={status.kofiJoinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("premium.subscribeKofi")}
                </a>
                <p className="text-sm text-muted-foreground">
                  {t("premium.kofiSubscribeHelp")}
                </p>
              </div>
            )}
          </div>
        )}
      <section aria-labelledby="premium-benefits-title" className="space-y-3">
        <h2 id="premium-benefits-title" className="text-xl font-semibold">{t("premium.benefits.title")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {(["inventory", "equipment", "images", "qr", "credits", "mcp"] as const).map((benefit) => (
            <li key={benefit} className="rounded-lg border p-4 space-y-1">
              <h3 className="font-medium">{t(`premium.benefits.${benefit}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`premium.benefits.${benefit}.description`)}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground">{t("premium.benefits.free")}</p>
        <p className="text-sm text-muted-foreground">{t("premium.benefits.creditsHelp")}</p>
        <p className="text-sm text-muted-foreground">{t("premium.benefits.retention")}</p>
      </section>
      {status?.kofiLinked ? (
        <p>{t("premium.kofiLinked")}</p>
      ) : status ? (
        <form onSubmit={sendLink} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("premium.supporterLinkHelp")}
          </p>
          <label
            htmlFor="kofi-payer-email"
            className="block text-sm font-medium"
          >
            {t("premium.kofiEmail")}
          </label>
          <Input
            id="kofi-payer-email"
            type="email"
            autoComplete="email"
            required
            maxLength={255}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <Button type="submit" disabled={busy}>
            {t(busy ? "premium.sending" : "premium.sendLink")}
          </Button>
        </form>
      ) : null}
      <Link className="block w-fit text-primary underline" href="/integrations/mcp">
        {t("premium.mcpGuideLink")}
      </Link>
      {premiumQuery.isError && (
        <p role="alert" className="text-destructive">
          {t("premium.loadFailed")}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </main>
  );
}
