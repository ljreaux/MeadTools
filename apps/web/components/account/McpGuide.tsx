"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import type { PremiumAccessResponse } from "@meadtools/api-contract/contracts";
import {
  mcpTokenCreateResponseSchema,
  mcpTokenListResponseSchema
} from "@meadtools/api-contract/mcp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from "@/components/ui/accordion";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText
} from "@/components/ui/input-group";
import { Copy, CopyCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-6">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ol>
  );
}

function subscribeOrigin() {
  return () => {};
}

function browserOrigin() {
  return window.location.origin;
}

function serverOrigin() {
  return "";
}

export function McpGuide({ endpoint }: { endpoint: string }) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const token = useAuthToken();
  const { status: sessionStatus } = useSession();
  const origin = useSyncExternalStore(
    subscribeOrigin,
    browserOrigin,
    serverOrigin
  );
  const isVercelPreview = new URL(endpoint).hostname.endsWith(".vercel.app");
  const [accountRead, setAccountRead] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [createdToken, setCreatedToken] = useState("");
  const [copied, setCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The origin store stays empty for SSR and the first hydration render.
  // Wait for its browser snapshot before rendering localStorage-backed auth UI.
  const signedIn = Boolean(origin) && (Boolean(token) || sessionStatus === "authenticated");

  const headers = useCallback(
    () => ({
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }),
    [token]
  );

  const premiumQuery = useQuery({
    queryKey: ["premium-access", token ? "bearer" : "session"],
    queryFn: async () => {
      const response = await fetch("/api/account/premium", {
        headers: headers(),
        cache: "no-store"
      });
      if (!response.ok) throw new Error("Premium status request failed");
      return (await response.json()) as PremiumAccessResponse;
    },
    enabled: signedIn,
    retry: false,
    staleTime: 5_000
  });

  const connectionsQuery = useQuery({
    queryKey: ["premium-mcp-tokens", token ? "bearer" : "session"],
    queryFn: async () => {
      const response = await fetch("/api/account/premium/mcp/tokens", {
        headers: headers(),
        cache: "no-store"
      });
      if (!response.ok) throw new Error("MCP connections request failed");
      return mcpTokenListResponseSchema.parse(await response.json());
    },
    enabled: signedIn,
    retry: false
  });

  const createToken = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCreatedToken("");
    setTokenCopied(false);
    try {
      const response = await fetch("/api/account/premium/mcp/tokens", {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ label: tokenName, accountRead })
      });
      if (!response.ok) throw new Error("MCP token creation failed");
      const created = mcpTokenCreateResponseSchema.parse(await response.json());
      setCreatedToken(created.token);
      setTokenName("");
      setAccountRead(false);
      await connectionsQuery.refetch();
    } catch {
      setError(t("mcpGuide.failed"));
    } finally {
      setBusy(false);
    }
  };

  const revokeConnection = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/account/premium/mcp/tokens/${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers: headers()
        }
      );
      if (!response.ok) throw new Error("MCP connection revocation failed");
      setCreatedToken("");
      setTokenCopied(false);
      await connectionsQuery.refetch();
    } catch {
      setError(t("mcpGuide.failed"));
    } finally {
      setBusy(false);
    }
  };

  const copyEndpoint = async () => {
    try {
      await navigator.clipboard.writeText(
        connectionsQuery.data?.endpoint ?? endpoint
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const copyPersonalToken = async () => {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken);
      setTokenCopied(true);
      toast({ description: t("mcpGuide.copiedToken") });
      setTimeout(() => setTokenCopied(false), 1_500);
    } catch {
      toast({ description: t("mcpGuide.copyFailed"), variant: "destructive" });
    }
  };

  return (
    <main className="mx-auto w-11/12 max-w-[1200px] pb-32 pt-24 sm:pb-36">
      <div className="space-y-8 rounded-xl bg-background px-4 py-6 sm:px-12 sm:py-8">
        <header className="mx-auto max-w-3xl space-y-3 text-center">
          <h1 className="text-3xl font-semibold">{t("mcpGuide.title")}</h1>
          <p className="text-muted-foreground">{t("mcpGuide.intro")}</p>
        </header>

        <section
          className="space-y-3 border-t pt-6"
          aria-labelledby="mcp-before-title"
        >
          <h2 id="mcp-before-title" className="text-xl font-semibold">
            {t("mcpGuide.beforeTitle")}
          </h2>
          <div className="max-w-3xl space-y-3">
            <p>{t("mcpGuide.beforeBody")}</p>
            <p>{t("mcpGuide.readOnly")}</p>
            <p>{t("mcpGuide.accountReadHelp")}</p>
            <p className="text-sm text-muted-foreground">
              {t("mcpGuide.credits")}
            </p>
            <Link
              className="inline-block text-primary underline"
              href="/account/premium"
            >
              {t("mcpGuide.premiumLink")}
            </Link>
          </div>
        </section>

        <section
          className="space-y-3 border-t pt-6"
          aria-labelledby="mcp-server-title"
        >
          <h2 id="mcp-server-title" className="text-xl font-semibold">
            {t("mcpGuide.serverTitle")}
          </h2>
          <p className="max-w-3xl">{t("mcpGuide.serverBody")}</p>
          {endpoint && (
            <InputGroup className="h-12 w-full max-w-2xl">
              <InputGroupAddon>
                <InputGroupText>{t("mcpGuide.serverLabel")}</InputGroupText>
              </InputGroupAddon>
              <InputGroupInput
                readOnly
                value={connectionsQuery.data?.endpoint ?? endpoint}
                aria-label={t("mcpGuide.serverTitle")}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  onClick={() => void copyEndpoint()}
                  aria-label={t(copied ? "mcpGuide.copied" : "mcpGuide.copy")}
                >
                  {copied ? (
                    <CopyCheck className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          )}
          {(origin.startsWith("http://localhost") ||
            origin.startsWith("http://127.0.0.1")) && (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {t("mcpGuide.localNote")}
            </p>
          )}
          {isVercelPreview && (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {t("mcpGuide.previewNote")}
            </p>
          )}
        </section>

        <section
          className="space-y-4 border-t pt-6"
          aria-labelledby="mcp-clients-title"
        >
          <h2 id="mcp-clients-title" className="text-xl font-semibold">
            {t("mcpGuide.clientsTitle")}
          </h2>
          <Tabs defaultValue="chatgpt" className="w-full">
            <TabsList className="h-auto max-w-full flex-wrap">
              <TabsTrigger value="chatgpt">
                {t("mcpGuide.chatgptTab")}
              </TabsTrigger>
              <TabsTrigger value="claude">
                {t("mcpGuide.claudeTab")}
              </TabsTrigger>
              <TabsTrigger value="other">{t("mcpGuide.otherTab")}</TabsTrigger>
            </TabsList>
            <TabsContent value="chatgpt" className="mt-5 max-w-3xl space-y-4">
              <h3 className="text-lg font-semibold">
                {t("mcpGuide.chatgptTitle")}
              </h3>
              <Steps
                items={[
                  t("mcpGuide.chatgptStep1"),
                  t("mcpGuide.chatgptStep2"),
                  t("mcpGuide.chatgptStep3"),
                  t("mcpGuide.chatgptStep4")
                ]}
              />
              <a
                className="inline-block text-sm text-primary underline"
                href="https://developers.openai.com/plugins/quickstart"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("mcpGuide.chatgptDocs")}
              </a>
            </TabsContent>
            <TabsContent value="claude" className="mt-5 max-w-3xl space-y-4">
              <h3 className="text-lg font-semibold">
                {t("mcpGuide.claudeTitle")}
              </h3>
              <Steps
                items={[
                  t("mcpGuide.claudeStep1"),
                  t("mcpGuide.claudeStep2"),
                  t("mcpGuide.claudeStep3"),
                  t("mcpGuide.claudeStep4")
                ]}
              />
              <a
                className="inline-block text-sm text-primary underline"
                href="https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp"
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("mcpGuide.claudeDocs")}
              </a>
            </TabsContent>
            <TabsContent value="other" className="mt-5 max-w-3xl space-y-3">
              <h3 className="text-lg font-semibold">
                {t("mcpGuide.otherTitle")}
              </h3>
              <p>{t("mcpGuide.otherBody")}</p>
              <p className="text-sm text-muted-foreground">
                {t("mcpGuide.otherLimit")}
              </p>
            </TabsContent>
          </Tabs>
        </section>

        <section
          className="space-y-3 border-t pt-6"
          aria-labelledby="mcp-connections-title"
        >
          <h2 id="mcp-connections-title" className="text-xl font-semibold">
            {t("mcpGuide.connectionsTitle")}
          </h2>
          {!signedIn && (
            <p>
              <Link
                className="text-primary underline"
                href="/login?next=%2Fintegrations%2Fmcp"
              >
                {t("mcpGuide.signIn")}
              </Link>
            </p>
          )}
          {signedIn && premiumQuery.data && !premiumQuery.data.mcpEnabled && (
            <p>{t("mcpGuide.unavailable")}</p>
          )}
          {connectionsQuery.data?.tokens.length === 0 && (
            <p>{t("mcpGuide.empty")}</p>
          )}
          {connectionsQuery.data?.tokens.map((connection) => (
            <div
              key={connection.id}
              className="flex items-center justify-between gap-3 rounded-md border p-3"
            >
              <div>
                <p>{connection.label}</p>
                <p className="text-sm text-muted-foreground">{t(connection.accountRead ? "mcpGuide.accountReadEnabled" : "mcpGuide.publicToolsOnly")}</p>
                <p className="text-sm text-muted-foreground">
                  {t("mcpGuide.expires", {
                    date: new Intl.DateTimeFormat(i18n.resolvedLanguage, {
                      dateStyle: "medium"
                    }).format(new Date(connection.expiresAt))
                  })}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void revokeConnection(connection.id)}
              >
                {t("mcpGuide.revoke")}
              </Button>
            </div>
          ))}
          {(premiumQuery.isError || connectionsQuery.isError || error) && (
            <p role="alert" className="text-destructive">
              {error || t("mcpGuide.failed")}
            </p>
          )}
        </section>

        {premiumQuery.data?.mcpEnabled && (
          <Accordion
            type="single"
            collapsible
            className="rounded-md border px-4"
          >
            <AccordionItem value="manual-token" className="border-none">
              <AccordionTrigger>{t("mcpGuide.advancedTitle")}</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <p>{t("mcpGuide.advancedBody")}</p>
                <form onSubmit={createToken} className="space-y-2">
                  <label
                    htmlFor="mcp-token-name"
                    className="block text-sm font-medium"
                  >
                    {t("mcpGuide.tokenName")}
                  </label>
                  <Input
                    id="mcp-token-name"
                    required
                    maxLength={80}
                    value={tokenName}
                    onChange={(event) => setTokenName(event.target.value)}
                  />
                  <label className="flex items-start gap-2">
                    <input type="checkbox" checked={accountRead} disabled={busy}
                      onChange={event => setAccountRead(event.target.checked)} />
                    <span>{t("mcpGuide.accountReadChoice")}</span>
                  </label>
                  <Button type="submit" disabled={busy}>
                    {t("mcpGuide.create")}
                  </Button>
                </form>
                {createdToken && (
                  <div role="status" className="space-y-2">
                    <p>{t("mcpGuide.tokenOnce")}</p>
                    <InputGroup className="h-12 w-full max-w-2xl">
                      <InputGroupAddon>
                        <InputGroupText>{t("mcpGuide.tokenLabel")}</InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        readOnly
                        value={createdToken}
                        aria-label={t("mcpGuide.tokenLabel")}
                      />
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          type="button"
                          onClick={() => void copyPersonalToken()}
                          aria-label={t(tokenCopied ? "mcpGuide.copiedToken" : "mcpGuide.copyToken")}
                        >
                          {tokenCopied ? (
                            <CopyCheck className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        <section
          className="space-y-3 border-t pt-6"
          aria-labelledby="mcp-help-title"
        >
          <h2 id="mcp-help-title" className="text-xl font-semibold">
            {t("mcpGuide.helpTitle")}
          </h2>
          <Accordion type="single" collapsible className="max-w-3xl">
            <AccordionItem value="url">
              <AccordionTrigger>{t("mcpGuide.helpUrlTitle")}</AccordionTrigger>
              <AccordionContent>{t("mcpGuide.helpUrl")}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="auth">
              <AccordionTrigger>{t("mcpGuide.helpAuthTitle")}</AccordionTrigger>
              <AccordionContent>{t("mcpGuide.helpAuth")}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="premium">
              <AccordionTrigger>
                {t("mcpGuide.helpPremiumTitle")}
              </AccordionTrigger>
              <AccordionContent>{t("mcpGuide.helpPremium")}</AccordionContent>
            </AccordionItem>
            <AccordionItem value="refresh">
              <AccordionTrigger>
                {t("mcpGuide.helpRefreshTitle")}
              </AccordionTrigger>
              <AccordionContent>{t("mcpGuide.helpRefresh")}</AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>
      </div>
    </main>
  );
}
