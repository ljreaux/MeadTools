"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Coins,
  CreditCard,
  DollarSign,
  Search,
  TrendingUp,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminChatUsage } from "@/hooks/reactQuery/useAdminDashboard";
import { cn } from "@/lib/utils";

type RangePreset = 7 | 30 | 90;
const ZERO_BIGINT = BigInt(0);
const HALF_CENT_PICOUSD = BigInt(5_000_000_000);
const PICOUSD_PER_CENT = BigInt(10_000_000_000);
const CENTS_PER_USD = BigInt(100);

export default function ChatOperationsAdmin() {
  const { t } = useTranslation();
  const [range, setRange] = useState(() => dateRangeForDays(30));
  const [environment, setEnvironment] = useState("");
  const [model, setModel] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filters = useMemo(
    () => ({
      from: new Date(`${range.from}T00:00:00.000Z`).toISOString(),
      to: endOfDateExclusive(range.to).toISOString(),
      environment: environment || undefined,
      model: model || undefined,
      status: status || undefined,
      query: query || undefined,
      page,
      limit: 25,
    }),
    [environment, model, page, query, range.from, range.to, status],
  );
  const usage = useAdminChatUsage(filters);
  const data = usage.data;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.totalUsers / data.filters.limit))
    : 1;

  const selectPreset = (days: RangePreset) => {
    setRange(dateRangeForDays(days));
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={t("admin.chatOperations.title")}
        description={t("admin.chatOperations.description")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/chat-access">
                <UsersRound className="size-4" />
                {t("admin.chatOperations.manageAccess")}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/chat-access#payment-recovery">
                <CreditCard className="size-4" />
                {t("admin.chatOperations.managePayments")}
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">
                {t("admin.chatOperations.filters")}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                {data
                  ? t("admin.chatOperations.matchingUsers", {
                      count: data.totalUsers,
                    })
                  : t("admin.chatOperations.loading")}
              </p>
            </div>
            {usage.isFetching ? (
              <span className="text-xs text-muted-foreground">
                {t("admin.chatOperations.updating")}
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(16rem,1.5fr)_repeat(3,minmax(10rem,1fr))]">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              {t("admin.chatOperations.query")}
              <InputGroup>
                <InputGroupAddon>
                  <Search className="size-4" />
                </InputGroupAddon>
                <InputGroupInput
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  placeholder={t("admin.chatOperations.queryPlaceholder")}
                  value={query}
                />
                {query ? (
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      aria-label={t("admin.chatOperations.clearSearch")}
                      onClick={() => {
                        setQuery("");
                        setPage(1);
                      }}
                    >
                      <X className="size-4" />
                    </InputGroupButton>
                  </InputGroupAddon>
                ) : null}
              </InputGroup>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              {t("admin.chatOperations.status")}
              <Select
                onValueChange={(value) => {
                  setStatus(value === "all" ? "" : value);
                  setPage(1);
                }}
                value={status || "all"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("admin.chatOperations.allStatuses")}
                  </SelectItem>
                  <SelectItem value="completed">
                    {t("admin.chatOperations.completedTurns")}
                  </SelectItem>
                  <SelectItem value="failed">
                    {t("admin.chatOperations.failed")}
                  </SelectItem>
                  <SelectItem value="reserved">
                    {t("admin.chatOperations.pending")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              {t("admin.chatOperations.environment")}
              <Input
                onChange={(event) => {
                  setEnvironment(event.target.value);
                  setPage(1);
                }}
                placeholder={t("admin.chatOperations.environmentPlaceholder")}
                value={environment}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              {t("admin.chatOperations.model")}
              <Input
                onChange={(event) => {
                  setModel(event.target.value);
                  setPage(1);
                }}
                placeholder={t("admin.chatOperations.modelPlaceholder")}
                value={model}
              />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">
            {t("admin.chatOperations.filterHelp")}
          </p>
          <div className="flex flex-col gap-3 border-t pt-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                {t("admin.chatOperations.dateFrom")}
                <Input
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setRange((current) => ({
                      from: event.target.value,
                      to:
                        event.target.value > current.to
                          ? event.target.value
                          : current.to,
                    }));
                    setPage(1);
                  }}
                  type="date"
                  value={range.from}
                />
              </label>
              <label className="grid gap-1 text-xs font-medium text-muted-foreground">
                {t("admin.chatOperations.dateTo")}
                <Input
                  min={range.from}
                  onChange={(event) => {
                    if (!event.target.value) return;
                    setRange((current) => ({
                      ...current,
                      to: event.target.value,
                    }));
                    setPage(1);
                  }}
                  type="date"
                  value={range.to}
                />
              </label>
            </div>
            <div className="grid gap-1 text-xs font-medium text-muted-foreground">
              <span>{t("admin.chatOperations.dateRange")}</span>
              <div className="flex flex-wrap gap-1">
                {([7, 30, 90] as const).map((days) => (
                  <Button
                    key={days}
                    onClick={() => selectPreset(days)}
                    size="sm"
                    type="button"
                    variant={
                      sameRange(range, dateRangeForDays(days))
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {days === 7
                      ? t("admin.chatOperations.sevenDays")
                      : days === 30
                        ? t("admin.chatOperations.thirtyDays")
                        : t("admin.chatOperations.ninetyDays")}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {usage.isError ? (
        <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
          {usage.error.message}
        </div>
      ) : null}

      <div className="grid border-l border-t sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard
          icon={DollarSign}
          label={t("admin.chatOperations.providerCost")}
          value={
            data ? formatPicoUsd(data.summary.providerCostPicousd) : undefined
          }
          detail={t("admin.chatOperations.providerCostHelp")}
        />
        <MetricCard
          icon={WalletCards}
          label={t("admin.chatOperations.creditEquivalent")}
          value={
            data
              ? formatPicoUsd(data.summary.creditEquivalentPicousd)
              : undefined
          }
        />
        <MetricCard
          icon={TrendingUp}
          label={t("admin.chatOperations.estimatedSpread")}
          value={
            data
              ? formatPicoUsd(data.summary.estimatedSpreadPicousd)
              : undefined
          }
          valueClassName={
            data && BigInt(data.summary.estimatedSpreadPicousd) < ZERO_BIGINT
              ? "text-destructive"
              : "text-emerald-600 dark:text-emerald-400"
          }
        />
        <MetricCard
          icon={Coins}
          label={t("admin.chatOperations.chargedCredits")}
          value={data ? formatInteger(data.summary.chargedCredits) : undefined}
        />
        <MetricCard
          icon={Bot}
          label={t("admin.chatOperations.completedTurns")}
          value={data ? formatInteger(data.summary.completedTurns) : undefined}
          detail={
            data
              ? `${formatInteger(data.summary.providerCalls)} ${t("admin.chatOperations.providerCalls").toLowerCase()}`
              : undefined
          }
        />
        <MetricCard
          icon={UsersRound}
          label={t("admin.chatOperations.activeUsers")}
          value={data ? formatInteger(data.summary.activeUsers) : undefined}
        />
      </div>

      {data &&
      (data.summary.failedTurns > 0 ||
        data.summary.pendingTurns > 0 ||
        data.summary.unpricedCompletedTurns > 0 ||
        data.summary.paymentRestrictedAccounts > 0 ||
        data.summary.pendingPaymentRecoveries > 0) ? (
        <Card className="border-warning/40">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" />
              {t("admin.chatOperations.warning")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            <WarningPill
              count={data.summary.failedTurns}
              label={t("admin.chatOperations.failed")}
            />
            <WarningPill
              count={data.summary.pendingTurns}
              label={t("admin.chatOperations.pending")}
            />
            <WarningPill
              count={data.summary.unpricedCompletedTurns}
              label={t("admin.chatOperations.unpricedCompletedTurns")}
            />
            <WarningPill
              count={data.summary.paymentRestrictedAccounts}
              label={t("admin.chatOperations.paymentRestrictedAccounts")}
            />
            <WarningPill
              count={data.summary.pendingPaymentRecoveries}
              label={t("admin.chatOperations.pendingPaymentRecoveries")}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportTable
          empty={t("admin.chatOperations.noUsage")}
          rows={data?.daily ?? []}
          title={t("admin.chatOperations.dailyActivity")}
          renderHead={() => (
            <>
              <TableHead>{t("date")}</TableHead>
              <TableHead className="text-right">
                {t("admin.chatOperations.requestCount")}
              </TableHead>
              <TableHead className="text-right">
                {t("admin.chatOperations.providerCost")}
              </TableHead>
            </>
          )}
          renderRow={(row) => (
            <>
              <TableCell>{row.day}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInteger(row.requestCount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPicoUsd(row.providerCostPicousd)}
              </TableCell>
            </>
          )}
        />
        <ReportTable
          empty={t("admin.chatOperations.noUsage")}
          rows={data?.models ?? []}
          title={t("admin.chatOperations.modelBreakdown")}
          renderHead={() => (
            <>
              <TableHead>{t("admin.chatOperations.model")}</TableHead>
              <TableHead className="text-right">
                {t("admin.chatOperations.requestCount")}
              </TableHead>
              <TableHead className="text-right">
                {t("admin.chatOperations.providerCost")}
              </TableHead>
            </>
          )}
          renderRow={(row) => (
            <>
              <TableCell>
                <span className="block truncate font-medium">{row.model}</span>
                <span className="text-xs text-muted-foreground">
                  {row.provider}
                </span>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInteger(row.requestCount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPicoUsd(row.providerCostPicousd)}
              </TableCell>
            </>
          )}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin.chatOperations.usageByUser")}</CardTitle>
          <CardDescription>
            {t("admin.chatOperations.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {usage.isLoading && !data ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : null}
          {data && !data.users.length ? (
            <p className="text-sm text-muted-foreground">
              {t("admin.chatOperations.noUsage")}
            </p>
          ) : null}
          {data?.users.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin.chatOperations.user")}</TableHead>
                  <TableHead>{t("admin.chatOperations.status")}</TableHead>
                  <TableHead className="text-right">
                    {t("admin.chatOperations.requestCount")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("admin.chatOperations.chargedCredits")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("admin.chatOperations.providerCost")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("admin.chatOperations.lastActivity")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((user) => (
                  <TableRow key={user.userId}>
                    <TableCell className="min-w-56">
                      <Link
                        className="font-medium hover:underline"
                        href={`/admin/users/${user.userId}`}
                      >
                        {user.publicUsername || user.email}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <StatusPill
                          active={user.chatEnabled}
                          label={
                            user.chatEnabled
                              ? t("admin.chatOperations.chatEnabled")
                              : t("admin.chatOperations.chatUnavailable")
                          }
                        />
                        <StatusPill
                          active={!user.paymentRestricted}
                          destructive={user.paymentRestricted}
                          label={
                            user.paymentRestricted
                              ? t("admin.chatOperations.restricted")
                              : t("admin.chatOperations.availableCredits", {
                                  credits: formatInteger(user.availableCredits),
                                })
                          }
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInteger(user.requestCount)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInteger(user.chargedCredits)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPicoUsd(user.providerCostPicousd)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatDateTime(user.lastActivityAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
          {data && totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-end gap-3 text-sm">
              <span className="text-muted-foreground">
                {t("admin.chatOperations.page", { page, pages: totalPages })}
              </span>
              <Button
                disabled={page === 1}
                onClick={() => setPage((current) => current - 1)}
                size="sm"
                variant="outline"
              >
                {t("admin.chatOperations.previous")}
              </Button>
              <Button
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                size="sm"
                variant="outline"
              >
                {t("admin.chatOperations.next")}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  valueClassName,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  detail?: string;
  valueClassName?: string;
}) {
  return (
    <div className="min-h-36 border-b border-r p-5">
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>{label}</p>
        <Icon className="size-4" />
      </div>
      {value === undefined ? (
        <Skeleton className="mt-5 h-9 w-20" />
      ) : (
        <p
          className={cn(
            "mt-5 text-3xl font-semibold tabular-nums",
            valueClassName,
          )}
        >
          {value}
        </p>
      )}
      {detail ? (
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

function WarningPill({ count, label }: { count: number; label: string }) {
  if (!count) return null;
  return (
    <span className="rounded-full bg-warning/15 px-2 py-1 text-xs font-medium text-warning-foreground">
      {formatInteger(count)} {label}
    </span>
  );
}

function StatusPill({
  active,
  destructive,
  label,
}: {
  active: boolean;
  destructive?: boolean;
  label: string;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-1 text-xs font-medium",
        destructive
          ? "bg-destructive/15 text-destructive"
          : active
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function ReportTable<T>({
  title,
  rows,
  empty,
  renderHead,
  renderRow,
}: {
  title: string;
  rows: T[];
  empty: string;
  renderHead: () => ReactNode;
  renderRow: (row: T) => ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>{renderHead()}</TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>{renderRow(row)}</TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function dateRangeForDays(days: RangePreset) {
  const now = new Date();
  const to = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

function sameRange(
  left: { from: string; to: string },
  right: { from: string; to: string },
) {
  return left.from === right.from && left.to === right.to;
}

function toDateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function endOfDateExclusive(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatPicoUsd(value: string) {
  const picoUsd = BigInt(value);
  const sign = picoUsd < ZERO_BIGINT ? "-" : "";
  const absolute = picoUsd < ZERO_BIGINT ? -picoUsd : picoUsd;
  const cents = (absolute + HALF_CENT_PICOUSD) / PICOUSD_PER_CENT;
  return `${sign}$${(cents / CENTS_PER_USD).toString()}.${(cents % CENTS_PER_USD).toString().padStart(2, "0")}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
