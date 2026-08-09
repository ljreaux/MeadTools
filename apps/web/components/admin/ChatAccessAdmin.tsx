"use client";

import { useMemo, useState } from "react";
import { Check, ExternalLink, Search, UsersRound, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import Loading from "@/components/loading";
import { useAdminUsersQuery } from "@/hooks/reactQuery/useAdminUsersQuery";
import {
  useAdminChatAccess,
  useAdminChatPaymentRecoveries,
  useGrantAdminChatAccess,
  useGrantAdminChatCredits,
  useRevokeAdminChatAccess,
  useResolveAdminChatPaymentRecovery,
  useUpdateAdminChatAccessMode
} from "@/hooks/reactQuery/useAdminChatAccess";

export default function ChatAccessAdmin() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [confirmGlobalEnable, setConfirmGlobalEnable] = useState(false);
  const access = useAdminChatAccess();
  const users = useAdminUsersQuery();
  const updateMode = useUpdateAdminChatAccessMode();
  const grant = useGrantAdminChatAccess();
  const grantCredits = useGrantAdminChatCredits();
  const revoke = useRevokeAdminChatAccess();
  const paymentRecoveries = useAdminChatPaymentRecoveries();
  const resolvePaymentRecovery = useResolveAdminChatPaymentRecovery();

  const grantsByUserId = useMemo(
    () => new Set(access.data?.grants.map((entry) => entry.userId) ?? []),
    [access.data?.grants]
  );
  const visibleUsers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return (users.data ?? [])
      .filter((user) => user.active)
      .filter((user) => !normalized || [user.email, user.public_username ?? ""].some((value) => value.toLowerCase().includes(normalized)))
      .sort((left, right) => left.email.localeCompare(right.email));
  }, [search, users.data]);

  if (access.isLoading || users.isLoading) return <Loading />;
  if (access.isError || users.isError || !access.data) {
    return <p className="text-destructive">Unable to load chat beta settings.</p>;
  }

  const allActive = access.data.mode === "all_active_users";
  const mutationError = grant.error ?? grantCredits.error ?? revoke.error ?? updateMode.error;
  return (
    <div className="w-full max-w-5xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Recipe chatbot beta</h1>
        <p className="mt-2 text-muted-foreground">Control access to the private recipe chatbot and grant evaluation credits.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rollout mode</CardTitle>
          <CardDescription>Beta grants are the safe default. Switching to all active users immediately shows chat to every active account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">{allActive ? "All active users" : "Beta allowlist"}</span>
            {!allActive ? <span className="text-sm text-muted-foreground">Only explicitly granted users can open chat.</span> : null}
          </div>
          {allActive ? (
            <Button variant="outline" disabled={updateMode.isPending} onClick={() => updateMode.mutate("beta_allowlist")}>Return to beta allowlist</Button>
          ) : (
            <Button disabled={updateMode.isPending} onClick={() => setConfirmGlobalEnable(true)}><UsersRound className="mr-2 size-4" />Enable for all active users</Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.chatPayments.title", "Payment recovery")}</CardTitle>
          <CardDescription>{t("admin.chatPayments.description", "Refunds reconcile automatically when possible. Disputes or overspent refunds restrict chat until you review them here.")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {paymentRecoveries.isLoading ? <p className="text-sm text-muted-foreground">{t("admin.chatPayments.loading", "Loading payment recoveries…")}</p> : null}
          {paymentRecoveries.isError ? <p className="text-sm text-destructive">{t("admin.chatPayments.loadFailed", "Could not load payment recoveries.")}</p> : null}
          {!paymentRecoveries.isLoading && !paymentRecoveries.isError && !paymentRecoveries.data?.recoveries.length ? (
            <p className="text-sm text-muted-foreground">{t("admin.chatPayments.empty", "No payment recoveries recorded.")}</p>
          ) : null}
          <div className="space-y-3">
            {paymentRecoveries.data?.recoveries.map((recovery) => (
              <div className="rounded-lg border p-3" key={recovery.id}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{recovery.publicUsername || recovery.email}</p>
                    <p className="text-xs text-muted-foreground">{recovery.kind === "stripe_refund" ? t("admin.chatPayments.refund", "Stripe refund") : t("admin.chatPayments.dispute", "Stripe dispute")} · {formatCurrency(recovery.amountCents, recovery.currency)} · {recovery.packCredits.toLocaleString()} {t("admin.chatPayments.packCredits", "credits")}</p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">{recovery.externalReference}</p>
                    {recovery.stripeDashboardUrl ? (
                      <a className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline" href={recovery.stripeDashboardUrl} rel="noreferrer" target="_blank">
                        <ExternalLink className="size-3" />
                        {t("admin.chatPayments.openStripeDispute", "Open dispute in Stripe")}
                      </a>
                    ) : null}
                  </div>
                  <span className={recovery.status === "review_required" ? "rounded-full bg-destructive/15 px-2 py-1 text-xs font-medium text-destructive" : "rounded-full bg-muted px-2 py-1 text-xs font-medium"}>
                    {recovery.status === "review_required" ? t("admin.chatPayments.reviewRequired", "Review required") : recovery.status === "resolved" ? t("admin.chatPayments.resolved", "Resolved") : t("admin.chatPayments.reconciled", "Reconciled")}
                  </span>
                </div>
                {recovery.status === "review_required" ? (
                  <PaymentRecoveryResolutionControl
                    disabled={resolvePaymentRecovery.isPending}
                    isDispute={recovery.kind === "stripe_dispute"}
                    onResolve={(input) => resolvePaymentRecovery.mutate({ recoveryId: recovery.id, ...input })}
                  />
                ) : null}
                {recovery.status === "resolved" && recovery.paymentRestricted ? (
                  <Button
                    className="mt-3"
                    disabled={resolvePaymentRecovery.isPending}
                    onClick={() => resolvePaymentRecovery.mutate({
                      recoveryId: recovery.id,
                      creditDelta: 0,
                      note: "Retry release after payment recovery resolution.",
                      releaseChat: true
                    })}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {t("admin.chatPayments.retryRelease", "Retry chat release")}
                  </Button>
                ) : null}
                {recovery.resolutionNote ? <p className="mt-2 text-xs text-muted-foreground">{recovery.resolutionNote}</p> : null}
              </div>
            ))}
          </div>
          {resolvePaymentRecovery.error ? <p className="text-sm text-destructive">{resolvePaymentRecovery.error.message}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Beta users and credits</CardTitle>
          <CardDescription>Chat access and prompt credits are separate. Add any whole number of credits without changing a user's access. Revoking access never removes ledger history or credits.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InputGroup>
            <InputGroupAddon><Search className="size-4" /></InputGroupAddon>
            <InputGroupInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search active users" aria-label="Search active users" />
            {search ? <InputGroupAddon align="inline-end"><InputGroupButton aria-label="Clear user search" onClick={() => setSearch("")}><X className="size-4" /></InputGroupButton></InputGroupAddon> : null}
          </InputGroup>
          <div className="divide-y rounded-lg border">
            {visibleUsers.map((user) => {
              const hasGrant = grantsByUserId.has(user.id);
              return (
                <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.public_username || user.email}</p>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasGrant ? <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium"><Check className="mr-1 size-3" />Beta granted</span> : null}
                    {hasGrant ? (
                      <Button variant="outline" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(user.id)}>Revoke</Button>
                    ) : (
                      <Button size="sm" disabled={grant.isPending} onClick={() => grant.mutate(user.id)}>Grant chat beta</Button>
                    )}
                    <CreditGrantControl
                      disabled={grantCredits.isPending}
                      onGrant={(creditAmount) => grantCredits.mutate({ userId: user.id, creditAmount })}
                    />
                  </div>
                </div>
              );
            })}
            {!visibleUsers.length ? <p className="p-4 text-sm text-muted-foreground">No active users match this search.</p> : null}
          </div>
          {mutationError ? <p className="text-sm text-destructive">{mutationError.message}</p> : null}
        </CardContent>
      </Card>

      <AlertDialog open={confirmGlobalEnable} onOpenChange={setConfirmGlobalEnable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable chat for every active user?</AlertDialogTitle>
            <AlertDialogDescription>Every active account will immediately see the chat link and floating chat button. This does not issue promotional credits automatically.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => updateMode.mutate("all_active_users")}>Enable for all active users</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CreditGrantControl({ disabled, onGrant }: { disabled: boolean; onGrant: (creditAmount: number) => void }) {
  const [creditAmount, setCreditAmount] = useState("1000");
  const parsedAmount = Number(creditAmount);
  const validAmount = Number.isInteger(parsedAmount) && parsedAmount >= 1 && parsedAmount <= 1_000_000;

  return (
    <div className="flex items-center gap-1">
      <InputGroup className="w-28">
        <InputGroupInput
          aria-label="Prompt credits to add"
          inputMode="numeric"
          min="1"
          max="1000000"
          onChange={(event) => setCreditAmount(event.target.value)}
          type="number"
          value={creditAmount}
        />
      </InputGroup>
      <Button disabled={disabled || !validAmount} onClick={() => onGrant(parsedAmount)} size="sm" variant="secondary">Add credits</Button>
    </div>
  );
}

function PaymentRecoveryResolutionControl({
  disabled,
  isDispute,
  onResolve
}: {
  disabled: boolean;
  isDispute: boolean;
  onResolve: (input: { creditDelta: number; note: string; releaseChat: boolean }) => void;
}) {
  const { t } = useTranslation();
  const [creditDelta, setCreditDelta] = useState("0");
  const [note, setNote] = useState("");
  const [releaseChat, setReleaseChat] = useState(true);
  const parsedCreditDelta = Number(creditDelta);
  const validCreditDelta = Number.isInteger(parsedCreditDelta) && Math.abs(parsedCreditDelta) <= 1_000_000;

  return (
    <div className="mt-3 grid gap-2 rounded-md bg-muted/50 p-2 md:grid-cols-[10rem_1fr_auto] md:items-end">
      {isDispute ? <p className="md:col-span-3 text-xs text-muted-foreground">{t("admin.chatPayments.disputeResolutionGuidance", "First accept or counter the dispute in Stripe. Then record the corresponding credit decision here.")}</p> : null}
      <label className="grid gap-1 text-xs font-medium">
        {t("admin.chatPayments.creditAdjustment", "Credit adjustment")}
        <input
          className="h-9 rounded-md border bg-background px-2 text-sm"
          inputMode="numeric"
          max="1000000"
          min="-1000000"
          onChange={(event) => setCreditDelta(event.target.value)}
          type="number"
          value={creditDelta}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium">
        {t("admin.chatPayments.resolutionNote", "Resolution note")}
        <input
          className="h-9 rounded-md border bg-background px-2 text-sm"
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("admin.chatPayments.resolutionNotePlaceholder", "Why was this resolved?")}
          value={note}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-xs">
          <input checked={releaseChat} onChange={(event) => setReleaseChat(event.target.checked)} type="checkbox" />
          {t("admin.chatPayments.releaseChat", "Release chat")}
        </label>
        <Button disabled={disabled || !validCreditDelta || note.trim().length < 3} onClick={() => onResolve({ creditDelta: parsedCreditDelta, note: note.trim(), releaseChat })} size="sm">
          {t("admin.chatPayments.resolve", "Resolve")}
        </Button>
      </div>
    </div>
  );
}

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amountCents / 100);
}
