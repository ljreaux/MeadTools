"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthToken } from "@/hooks/auth/useAuthToken";
import { useToast } from "@/hooks/use-toast";
import {
  fetchCreditActivityPage,
  useCreditAccount,
  type CreditActivityPage,
} from "@/hooks/reactQuery/useCreditAccount";
import { cn } from "@/lib/utils";
import { CREDIT_PACKS, type CreditPack } from "@meadtools/credit-accounting";
import {
  CHAT_TURN_CREDIT_WARNING_CREDITS,
  CHAT_TURN_PREAUTHORIZATION_CREDITS,
} from "@meadtools/chat-domain";
import {
  CircleAlert,
  History,
  LoaderCircle,
  Plus,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type WalletActivity = CreditActivityPage["activities"][number];

export default function CreditWallet({
  embedded = false,
  paymentRestricted = false,
}: {
  embedded?: boolean;
  paymentRestricted?: boolean;
}) {
  const { t } = useTranslation();
  const token = useAuthToken();
  const { toast } = useToast();
  const wallet = useCreditAccount();
  const [olderActivities, setOlderActivities] = useState<WalletActivity[]>([]);
  // `undefined` means no older page has been requested yet; `null` means the
  // server explicitly reported the end of history.
  const [nextCursor, setNextCursor] = useState<string | null | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [checkoutPackId, setCheckoutPackId] = useState<string | null>(null);

  const activities = useMemo(
    () => [...(wallet.data?.activities ?? []), ...olderActivities],
    [olderActivities, wallet.data?.activities],
  );
  const effectiveNextCursor =
    nextCursor === undefined ? (wallet.data?.nextCursor ?? null) : nextCursor;
  const availableCredits = wallet.data?.availableCredits ?? 0;
  const creditBalanceIsNegative = availableCredits < 0;
  const creditBalanceBelowPreauthorization =
    availableCredits < CHAT_TURN_PREAUTHORIZATION_CREDITS;
  const creditBalanceWarning =
    !creditBalanceBelowPreauthorization &&
    availableCredits <= CHAT_TURN_CREDIT_WARNING_CREDITS;

  async function loadMore() {
    if (!effectiveNextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchCreditActivityPage({
        token,
        cursor: effectiveNextCursor,
      });
      setOlderActivities((current) => [...current, ...page.activities]);
      setNextCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  function refresh() {
    setOlderActivities([]);
    setNextCursor(undefined);
    void wallet.refetch();
  }

  async function startCheckout(pack: CreditPack) {
    if (checkoutPackId) return;
    setCheckoutPackId(pack.id);
    try {
      const response = await fetch("/api/account/credits/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ packId: pack.id }),
      });
      const payload = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;
      if (!response.ok || !payload?.url)
        throw new Error(payload?.error ?? "checkout-unavailable");
      window.location.assign(payload.url);
    } catch {
      toast({
        description: t("credits.checkoutFailed"),
        variant: "destructive",
      });
      setCheckoutPackId(null);
    }
  }

  return (
    <main
      className={
        embedded
          ? "w-full"
          : "relative mx-auto mt-24 mb-24 w-11/12 max-w-4xl rounded-xl bg-background p-6 pt-16 sm:p-10 sm:pt-20"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl">{t("credits.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t("credits.description")}
          </p>
        </div>
        <Button
          disabled={wallet.isFetching}
          onClick={refresh}
          type="button"
          variant="outline"
        >
          <RefreshCw className={cn(wallet.isFetching && "animate-spin")} />
          {t("credits.refresh")}
        </Button>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <WalletCards className="size-4" />
            <CardDescription>{t("credits.available")}</CardDescription>
          </div>
          {wallet.isLoading ? (
            <Skeleton className="h-10 w-36" />
          ) : (
            <CardTitle
              className={cn(
                "text-4xl tabular-nums",
                creditBalanceBelowPreauthorization
                  ? "text-destructive"
                  : creditBalanceWarning
                    ? "text-warning"
                    : undefined,
              )}
            >
              {availableCredits.toLocaleString()}
            </CardTitle>
          )}
        </CardHeader>
      </Card>
      {creditBalanceIsNegative ? (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {t("credits.negativeBalance")}
        </p>
      ) : null}

      {wallet.data?.purchasesEnabled && !paymentRestricted ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">{t("credits.purchase")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("credits.purchaseDescription")}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {CREDIT_PACKS.map((pack) => {
              const price = new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: "USD",
              }).format(pack.amountCents / 100);
              const purchasing = checkoutPackId === pack.id;
              return (
                <Button
                  disabled={Boolean(checkoutPackId)}
                  key={pack.id}
                  onClick={() => void startCheckout(pack)}
                  type="button"
                  variant="outline"
                >
                  {purchasing ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    <Plus />
                  )}
                  {purchasing
                    ? t("credits.purchaseProcessing")
                    : t("credits.purchasePack", {
                        credits: pack.credits.toLocaleString(),
                        price,
                      })}
                </Button>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-6">
        <div className="flex items-center gap-2">
          <History className="size-4" />
          <h2 className="text-lg font-semibold">{t("credits.activity")}</h2>
        </div>
        {wallet.isError ? (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <CircleAlert className="size-4 shrink-0" />
            {t("credits.loadFailed")}
          </div>
        ) : wallet.isLoading ? (
          <div className="mt-3 space-y-2">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : activities.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {t("credits.noActivity")}
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-md border">
            <ul className="divide-y">
              {activities.map((activity) => (
                <CreditActivityRow
                  activity={activity}
                  key={activity.operationId}
                />
              ))}
            </ul>
          </div>
        )}
        {effectiveNextCursor ? (
          <Button
            className="mt-3"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            type="button"
            variant="outline"
          >
            {loadingMore ? <RefreshCw className="animate-spin" /> : <Plus />}
            {t("credits.loadMore")}
          </Button>
        ) : null}
      </section>
    </main>
  );
}

function CreditActivityRow({ activity }: { activity: WalletActivity }) {
  const { t } = useTranslation();
  const label =
    activity.kind === "usage"
      ? t("credits.activityUsage")
      : activity.kind === "purchase"
        ? t("credits.activityPurchase")
        : activity.kind === "grant"
          ? t("credits.activityGrant")
          : activity.kind === "refund"
            ? t("credits.activityRefund")
            : t("credits.activityAdjustment");
  const isCredit = activity.creditsDelta >= 0;
  const isDestructiveAdjustment =
    activity.kind === "adjustment" && activity.creditsDelta < 0;
  const timestamp = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(activity.occurredAt));

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{timestamp}</p>
      </div>
      <span
        className={cn(
          "shrink-0 font-medium tabular-nums",
          isDestructiveAdjustment
            ? "text-destructive"
            : isCredit
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-foreground",
        )}
      >
        {isCredit ? "+" : "−"}
        {Math.abs(activity.creditsDelta).toLocaleString()}
      </span>
    </li>
  );
}
