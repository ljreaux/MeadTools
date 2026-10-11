"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import type { PremiumAccessResponse } from "@meadtools/api-contract/contracts";
import {
  mcpTokenCreateResponseSchema,
  mcpTokenListResponseSchema,
} from "@meadtools/api-contract/mcp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PremiumAccount() {
  const { t, i18n } = useTranslation();
  const searchParams = useSearchParams();
  const token = useAuthToken();
  const { status: sessionStatus } = useSession();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [mcpTokenName, setMcpTokenName] = useState("");
  const [createdMcpToken, setCreatedMcpToken] = useState("");
  const claimed = useRef(false);

  const headers = useCallback(
    () => ({
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }),
    [token]
  );

  const refresh = useCallback(async () => {
    const response = await fetch("/api/account/premium", {
      headers: headers(),
      cache: "no-store"
    });
    if (!response.ok) throw new Error("Premium status request failed");
    return (await response.json()) as PremiumAccessResponse;
  }, [headers]);

  const premiumQuery = useQuery({
    queryKey: ["premium-access", token ? "bearer" : "session"],
    queryFn: refresh,
    enabled: Boolean(token) || sessionStatus === "authenticated",
    retry: false,
    staleTime: 5_000
  });
  const status = premiumQuery.data ?? null;
  const { refetch } = premiumQuery;
  const mcpQuery = useQuery({
    queryKey: ["premium-mcp-tokens", token ? "bearer" : "session"],
    queryFn: async () => {
      const response = await fetch("/api/account/premium/mcp/tokens", {
        headers: headers(),
        cache: "no-store",
      });
      if (!response.ok) throw new Error("MCP connections request failed");
      return mcpTokenListResponseSchema.parse(await response.json());
    },
    enabled: Boolean(status?.mcpEnabled),
    retry: false,
  });

  const createMcpToken = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCreatedMcpToken("");
    try {
      const response = await fetch("/api/account/premium/mcp/tokens", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ label: mcpTokenName }),
      });
      if (!response.ok) throw new Error("MCP connection creation failed");
      const created = mcpTokenCreateResponseSchema.parse(await response.json());
      setCreatedMcpToken(created.token);
      setMcpTokenName("");
      await mcpQuery.refetch();
    } catch {
      setError(t("premium.mcpFailed"));
    } finally {
      setBusy(false);
    }
  };

  const revokeMcpToken = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/account/premium/mcp/tokens/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!response.ok) throw new Error("MCP connection revocation failed");
      setCreatedMcpToken("");
      await mcpQuery.refetch();
    } catch {
      setError(t("premium.mcpFailed"));
    } finally {
      setBusy(false);
    }
  };

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
    <main className="w-11/12 max-w-2xl rounded-xl bg-background p-6 space-y-5">
      <h1 className="text-2xl font-semibold">{t("premium.title")}</h1>
      <p className="text-muted-foreground">
        {t(
          status?.subscriptionsEnabled
            ? "premium.descriptionReady"
            : "premium.description"
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
      {status?.kofiLinked ? (
        <p>{t("premium.kofiLinked")}</p>
      ) : status ? (
        <form onSubmit={sendLink} className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("premium.linkHelp")}
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
      {status?.mcpEnabled && (
        <section className="space-y-3" aria-labelledby="mcp-connections-title">
          <h2 id="mcp-connections-title" className="text-xl font-semibold">
            {t("premium.mcpTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("premium.mcpHelp")}</p>
          {mcpQuery.data && (
            <p className="text-sm">
              {t("premium.mcpEndpoint")}: <code>{mcpQuery.data.endpoint}</code>
            </p>
          )}
          <form onSubmit={createMcpToken} className="space-y-2">
            <label htmlFor="mcp-token-name" className="block text-sm font-medium">
              {t("premium.mcpTokenName")}
            </label>
            <Input
              id="mcp-token-name"
              required
              maxLength={80}
              value={mcpTokenName}
              onChange={(event) => setMcpTokenName(event.target.value)}
            />
            <Button type="submit" disabled={busy}>{t("premium.mcpCreate")}</Button>
          </form>
          {createdMcpToken && (
            <div role="status" className="space-y-1">
              <p>{t("premium.mcpTokenOnce")}</p>
              <Input readOnly value={createdMcpToken} aria-label={t("premium.mcpTokenOnce")} />
            </div>
          )}
          {mcpQuery.data?.tokens.length === 0 && <p>{t("premium.mcpEmpty")}</p>}
          {mcpQuery.data?.tokens.map((connection) => (
            <div key={connection.id} className="flex items-center justify-between gap-3">
              <div>
                <p>{connection.label}</p>
                <p className="text-sm text-muted-foreground">
                  {t("premium.mcpTokenExpires", {
                    date: new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                      dateStyle: "medium",
                    }).format(new Date(connection.expiresAt)),
                  })}
                </p>
              </div>
              <Button type="button" variant="outline" disabled={busy}
                onClick={() => void revokeMcpToken(connection.id)}>
                {t("premium.mcpRevoke")}
              </Button>
            </div>
          ))}
          {mcpQuery.isError && <p role="alert">{t("premium.mcpFailed")}</p>}
        </section>
      )}
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
