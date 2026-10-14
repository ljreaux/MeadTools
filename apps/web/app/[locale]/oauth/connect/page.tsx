"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type Consent = { accountRead: boolean; clientName: string; redirectHost: string; redirectUri: string; signedRequest: string };

function ConnectContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const query = searchParams.toString();
  const token = useAuthToken();
  const { status } = useSession();
  const [consent, setConsent] = useState<Consent | null>(null);
  const [accountRead, setAccountRead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/oauth/authorize?${query}`, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          const next = window.location.pathname + window.location.search;
          router.replace(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
        if (!response.ok) throw new Error("Authorization request failed");
        const result = await response.json() as Consent;
        if (!result.clientName || !result.redirectHost || !result.redirectUri || !result.signedRequest) {
          throw new Error("Invalid authorization request");
        }
        setAccountRead(false);
        setConsent(result);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    })();
    return () => controller.abort();
  }, [query, router, status, token]);

  const decide = async (decision: "approve" | "deny") => {
    if (!consent) return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/oauth/authorize", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: new URLSearchParams({
          authorization_request: consent.signedRequest,
          decision,
          account_read: String(accountRead),
        }),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Authorization failed");
      const result = await response.json() as { redirectUrl?: string };
      if (!result.redirectUrl) throw new Error("Missing callback");
      window.location.assign(result.redirectUrl);
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto mt-24 w-11/12 max-w-xl space-y-5 rounded-xl bg-background p-6">
      <h1 className="text-2xl font-semibold">{t("premium.mcpConsentTitle")}</h1>
      {consent && <>
        <p>{t("premium.mcpConsentRequest", {
          client: consent.clientName, host: consent.redirectHost,
        })}</p>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{t("premium.mcpConsentCallback")}</p>
          <code className="block break-all rounded-md border border-border bg-background p-3 text-sm text-foreground">
            {consent.redirectUri}
          </code>
        </div>
        <div className="space-y-3 rounded-md border p-4">
          <p id="mcp-consent-access-title" className="text-sm font-medium">{t("premium.mcpConsentAccessTitle")}</p>
          <RadioGroup value={accountRead ? "account" : "basic"} disabled={busy}
            aria-labelledby="mcp-consent-access-title" className="gap-4"
            onValueChange={value => setAccountRead(value === "account")}>
            <div className="flex items-start gap-3">
              <RadioGroupItem value="basic" id="mcp-access-basic" className="mt-1"
                aria-describedby="mcp-access-basic-description" />
              <div className="space-y-1">
                <Label htmlFor="mcp-access-basic" className="block leading-normal">{t("premium.mcpConsentBasicLabel")}</Label>
                <p id="mcp-access-basic-description" className="text-sm text-muted-foreground">{t("premium.mcpConsentBasicChoice")}</p>
              </div>
            </div>
            {consent.accountRead && <div className="flex items-start gap-3">
              <RadioGroupItem value="account" id="mcp-access-account" className="mt-1"
                aria-describedby="mcp-access-account-description" />
              <div className="space-y-1">
                <Label htmlFor="mcp-access-account" className="block leading-normal">{t("premium.mcpConsentAccountChoice")}</Label>
                <p id="mcp-access-account-description" className="text-sm text-muted-foreground">{t("premium.mcpConsentAccountRead")}</p>
              </div>
            </div>}
          </RadioGroup>
          {!consent.accountRead && <p className="text-sm text-muted-foreground">{t("premium.mcpConsentBasicOnly")}</p>}
        </div>
        <p className="text-sm text-muted-foreground">{t("premium.mcpConsentLimits")}</p>
        <div className="flex gap-3">
          <Button disabled={busy} onClick={() => void decide("approve")}>
            {t("premium.mcpConsentAllow")}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void decide("deny")}>
            {t("premium.mcpConsentDeny")}
          </Button>
        </div>
      </>}
      {!consent && !error && <p role="status">{t("premium.mcpConsentLoading")}</p>}
      {error && <p role="alert">{t("premium.mcpConsentFailed")}</p>}
    </main>
  );
}

export default function OAuthConnectPage() {
  return <Suspense fallback={null}><ConnectContent /></Suspense>;
}
