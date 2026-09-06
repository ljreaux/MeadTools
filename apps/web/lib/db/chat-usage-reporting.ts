import "server-only";

import { Prisma } from "@prisma/client";
import { PICOUSD_PER_CREDIT } from "@meadtools/credit-accounting";
import prisma from "@/lib/prisma";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_RANGE_DAYS = 30;
const ZERO_BIGINT = BigInt(0);

export type ChatUsageReportFilters = {
  from?: Date;
  to?: Date;
  environment?: string;
  model?: string;
  status?: "completed" | "failed" | "reserved";
  userId?: number;
  query?: string;
  page?: number;
  limit?: number;
};

export type NormalizedChatUsageReportFilters = Required<
  Pick<ChatUsageReportFilters, "from" | "to">
> & {
  environment: string | null;
  model: string | null;
  status: "completed" | "failed" | "reserved" | null;
  userId: number | null;
  query: string | null;
  page: number;
  limit: number;
};

export type ChatUsageMetrics = {
  requestCount: number;
  completedTurns: number;
  failedTurns: number;
  pendingTurns: number;
  unpricedCompletedTurns: number;
  providerCalls: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  chargedCredits: number;
  providerCostPicousd: string;
  creditEquivalentPicousd: string;
  estimatedSpreadPicousd: string;
};

export type ChatUsageReport = {
  filters: NormalizedChatUsageReportFilters;
  summary: ChatUsageMetrics & {
    activeUsers: number;
    paymentRestrictedAccounts: number;
    pendingPaymentRecoveries: number;
  };
  daily: Array<ChatUsageMetrics & { day: string }>;
  models: Array<ChatUsageMetrics & { provider: string; model: string }>;
  users: Array<
    ChatUsageMetrics & {
      userId: number;
      email: string;
      publicUsername: string | null;
      active: boolean;
      chatEnabled: boolean;
      paymentRestricted: boolean;
      availableCredits: number;
      lastActivityAt: Date | null;
    }
  >;
  totalUsers: number;
};

/**
 * Returns operational reporting from immutable chat usage and credit-ledger
 * data. Chat transcript text and provider prompts intentionally never enter
 * this query surface.
 */
export async function getAdminChatUsageReport(
  input: ChatUsageReportFilters = {},
): Promise<ChatUsageReport> {
  const filters = normalizeFilters(input);
  const base = usageTurnsCte(filters);

  const [
    summaryRows,
    dailyRows,
    modelRows,
    userRows,
    totalUserRows,
    alertRows,
  ] = await Promise.all([
    prisma.$queryRaw<MetricRow[]>(Prisma.sql`
      ${base}
      SELECT
        COUNT(*)::bigint AS "request_count",
        COUNT(*) FILTER (WHERE "status" = 'completed')::bigint AS "completed_turns",
        COUNT(*) FILTER (WHERE "status" = 'failed')::bigint AS "failed_turns",
        COUNT(*) FILTER (WHERE "status" = 'reserved')::bigint AS "pending_turns",
        COUNT(*) FILTER (WHERE "status" = 'completed' AND NOT "has_settlement")::bigint AS "unpriced_completed_turns",
        COALESCE(SUM("provider_calls"), 0)::bigint AS "provider_calls",
        COALESCE(SUM("input_tokens"), 0)::bigint AS "input_tokens",
        COALESCE(SUM("cached_input_tokens"), 0)::bigint AS "cached_input_tokens",
        COALESCE(SUM("output_tokens"), 0)::bigint AS "output_tokens",
        COALESCE(SUM("total_tokens"), 0)::bigint AS "total_tokens",
        COALESCE(SUM("charged_credits"), 0)::bigint AS "charged_credits",
        COALESCE(SUM("provider_cost_picousd"), 0)::bigint AS "provider_cost_picousd",
        COUNT(DISTINCT "user_id") FILTER (WHERE "active")::bigint AS "active_users"
      FROM "turns"
    `),
    prisma.$queryRaw<Array<MetricRow & { day: string }>>(Prisma.sql`
      ${base}
      SELECT
        TO_CHAR("occurred_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS "day",
        COUNT(*)::bigint AS "request_count",
        COUNT(*) FILTER (WHERE "status" = 'completed')::bigint AS "completed_turns",
        COUNT(*) FILTER (WHERE "status" = 'failed')::bigint AS "failed_turns",
        COUNT(*) FILTER (WHERE "status" = 'reserved')::bigint AS "pending_turns",
        COUNT(*) FILTER (WHERE "status" = 'completed' AND NOT "has_settlement")::bigint AS "unpriced_completed_turns",
        COALESCE(SUM("provider_calls"), 0)::bigint AS "provider_calls",
        COALESCE(SUM("input_tokens"), 0)::bigint AS "input_tokens",
        COALESCE(SUM("cached_input_tokens"), 0)::bigint AS "cached_input_tokens",
        COALESCE(SUM("output_tokens"), 0)::bigint AS "output_tokens",
        COALESCE(SUM("total_tokens"), 0)::bigint AS "total_tokens",
        COALESCE(SUM("charged_credits"), 0)::bigint AS "charged_credits",
        COALESCE(SUM("provider_cost_picousd"), 0)::bigint AS "provider_cost_picousd"
      FROM "turns"
      GROUP BY "day"
      ORDER BY "day" ASC
    `),
    prisma.$queryRaw<
      Array<MetricRow & { provider: string; model: string }>
    >(Prisma.sql`
      ${base}
      SELECT
        "provider",
        "model",
        COUNT(*)::bigint AS "request_count",
        COUNT(*) FILTER (WHERE "status" = 'completed')::bigint AS "completed_turns",
        COUNT(*) FILTER (WHERE "status" = 'failed')::bigint AS "failed_turns",
        COUNT(*) FILTER (WHERE "status" = 'reserved')::bigint AS "pending_turns",
        COUNT(*) FILTER (WHERE "status" = 'completed' AND NOT "has_settlement")::bigint AS "unpriced_completed_turns",
        COALESCE(SUM("provider_calls"), 0)::bigint AS "provider_calls",
        COALESCE(SUM("input_tokens"), 0)::bigint AS "input_tokens",
        COALESCE(SUM("cached_input_tokens"), 0)::bigint AS "cached_input_tokens",
        COALESCE(SUM("output_tokens"), 0)::bigint AS "output_tokens",
        COALESCE(SUM("total_tokens"), 0)::bigint AS "total_tokens",
        COALESCE(SUM("charged_credits"), 0)::bigint AS "charged_credits",
        COALESCE(SUM("provider_cost_picousd"), 0)::bigint AS "provider_cost_picousd"
      FROM "turns"
      GROUP BY "provider", "model"
      ORDER BY "provider_cost_picousd" DESC, "model" ASC
    `),
    prisma.$queryRaw<UserMetricRow[]>(Prisma.sql`
      ${base}
      , "balances" AS (
        SELECT
          "accounts"."user_id",
          COALESCE(SUM("entries"."credits_delta"), 0)::bigint AS "available_credits",
          BOOL_OR("accounts"."payment_restricted_at" IS NOT NULL) AS "payment_restricted"
        FROM "credit_accounts" AS "accounts"
        LEFT JOIN "credit_ledger_entries" AS "entries"
          ON "entries"."account_id" = "accounts"."id"
        GROUP BY "accounts"."user_id"
      )
      SELECT
        "turns"."user_id",
        MAX("turns"."email") AS "email",
        MAX("turns"."public_username") AS "public_username",
        BOOL_OR("turns"."active") AS "active",
        BOOL_OR("turns"."chat_enabled") AS "chat_enabled",
        COALESCE(MAX("balances"."payment_restricted"::int), 0)::int = 1 AS "payment_restricted",
        COALESCE(MAX("balances"."available_credits"), 0)::bigint AS "available_credits",
        MAX("turns"."occurred_at") AS "last_activity_at",
        COUNT(*)::bigint AS "request_count",
        COUNT(*) FILTER (WHERE "turns"."status" = 'completed')::bigint AS "completed_turns",
        COUNT(*) FILTER (WHERE "turns"."status" = 'failed')::bigint AS "failed_turns",
        COUNT(*) FILTER (WHERE "turns"."status" = 'reserved')::bigint AS "pending_turns",
        COUNT(*) FILTER (WHERE "turns"."status" = 'completed' AND NOT "turns"."has_settlement")::bigint AS "unpriced_completed_turns",
        COALESCE(SUM("turns"."provider_calls"), 0)::bigint AS "provider_calls",
        COALESCE(SUM("turns"."input_tokens"), 0)::bigint AS "input_tokens",
        COALESCE(SUM("turns"."cached_input_tokens"), 0)::bigint AS "cached_input_tokens",
        COALESCE(SUM("turns"."output_tokens"), 0)::bigint AS "output_tokens",
        COALESCE(SUM("turns"."total_tokens"), 0)::bigint AS "total_tokens",
        COALESCE(SUM("turns"."charged_credits"), 0)::bigint AS "charged_credits",
        COALESCE(SUM("turns"."provider_cost_picousd"), 0)::bigint AS "provider_cost_picousd"
      FROM "turns"
      LEFT JOIN "balances" ON "balances"."user_id" = "turns"."user_id"
      GROUP BY "turns"."user_id"
      ORDER BY "provider_cost_picousd" DESC, "last_activity_at" DESC, "email" ASC
      LIMIT ${filters.limit}
      OFFSET ${(filters.page - 1) * filters.limit}
    `),
    prisma.$queryRaw<Array<{ total_users: bigint }>>(Prisma.sql`
      ${base}
      SELECT COUNT(DISTINCT "user_id")::bigint AS "total_users"
      FROM "turns"
    `),
    prisma.$queryRaw<
      Array<{
        payment_restricted_accounts: bigint;
        pending_payment_recoveries: bigint;
      }>
    >(Prisma.sql`
      SELECT
        (SELECT COUNT(*)::bigint FROM "credit_accounts" WHERE "payment_restricted_at" IS NOT NULL) AS "payment_restricted_accounts",
        (SELECT COUNT(*)::bigint FROM "credit_payment_recoveries" WHERE "status" = 'review_required') AS "pending_payment_recoveries"
    `),
  ]);

  const summary = metricFromRow(summaryRows[0]);
  const alerts = alertRows[0];
  return {
    filters,
    summary: {
      ...summary,
      activeUsers: toSafeNumber(summaryRows[0]?.active_users ?? ZERO_BIGINT),
      paymentRestrictedAccounts: toSafeNumber(
        alerts?.payment_restricted_accounts ?? ZERO_BIGINT,
      ),
      pendingPaymentRecoveries: toSafeNumber(
        alerts?.pending_payment_recoveries ?? ZERO_BIGINT,
      ),
    },
    daily: dailyRows.map((row) => ({ ...metricFromRow(row), day: row.day })),
    models: modelRows.map((row) => ({
      ...metricFromRow(row),
      provider: row.provider,
      model: row.model,
    })),
    users: userRows.map((row) => ({
      ...metricFromRow(row),
      userId: row.user_id,
      email: row.email,
      publicUsername: row.public_username,
      active: row.active,
      chatEnabled: row.chat_enabled,
      paymentRestricted: row.payment_restricted,
      availableCredits: toSafeNumber(row.available_credits),
      lastActivityAt: row.last_activity_at,
    })),
    totalUsers: toSafeNumber(totalUserRows[0]?.total_users ?? ZERO_BIGINT),
  };
}

function normalizeFilters(
  input: ChatUsageReportFilters,
): NormalizedChatUsageReportFilters {
  const to = input.to ?? new Date();
  const from =
    input.from ??
    new Date(to.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from >= to
  ) {
    throw new RangeError("The chat usage date range is invalid.");
  }

  const page = input.page ?? 1;
  const limit = input.limit ?? DEFAULT_LIMIT;
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_LIMIT
  ) {
    throw new RangeError("The chat usage page is invalid.");
  }

  return {
    from,
    to,
    environment: input.environment?.trim() || null,
    model: input.model?.trim() || null,
    status: input.status ?? null,
    userId: input.userId ?? null,
    query: input.query?.trim() || null,
    page,
    limit,
  };
}

function usageTurnsCte(filters: NormalizedChatUsageReportFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`"events"."created_at" >= ${filters.from}`,
    Prisma.sql`"events"."created_at" < ${filters.to}`,
  ];
  if (filters.environment) {
    const environment = `%${filters.environment}%`;
    conditions.push(Prisma.sql`"events"."environment" ILIKE ${environment}`);
  }
  if (filters.model) {
    const model = `%${filters.model}%`;
    conditions.push(Prisma.sql`"events"."model" ILIKE ${model}`);
  }
  if (filters.status)
    conditions.push(Prisma.sql`"events"."status" = ${filters.status}`);
  if (filters.userId)
    conditions.push(Prisma.sql`"events"."user_id" = ${filters.userId}`);
  if (filters.query) {
    const query = `%${filters.query}%`;
    conditions.push(Prisma.sql`(
      "users"."email" ILIKE ${query}
      OR COALESCE("users"."public_username", '') ILIKE ${query}
      OR "users"."id"::text ILIKE ${query}
    )`);
  }

  return Prisma.sql`
    WITH "filtered_events" AS (
      SELECT
        "events"."request_id",
        "events"."user_id",
        "events"."environment",
        "events"."model",
        "events"."status",
        "events"."provider_calls",
        "events"."input_tokens",
        "events"."cached_input_tokens",
        "events"."output_tokens",
        "events"."total_tokens",
        COALESCE("events"."completed_at", "events"."created_at") AS "occurred_at",
        "users"."email",
        "users"."public_username",
        "users"."active",
        (
          "users"."active"
          AND (
            COALESCE((SELECT "mode"::text FROM "chat_access_settings" LIMIT 1), 'beta_allowlist') = 'all_active_users'
            OR EXISTS (
              SELECT 1 FROM "chat_access_grants" AS "grants"
              WHERE "grants"."user_id" = "users"."id"
                AND "grants"."revoked_at" IS NULL
            )
          )
        ) AS "chat_enabled"
      FROM "chatbot_usage_events" AS "events"
      INNER JOIN "users" ON "users"."id" = "events"."user_id"
      WHERE ${Prisma.join(conditions, " AND ")}
    ),
    "ledger_operations" AS (
      SELECT
        "entries"."operation_id",
        COALESCE(SUM("entries"."credits_delta") FILTER (
          WHERE "entries"."entry_type" IN ('reservation', 'settlement', 'reversal')
        ), 0)::bigint AS "net_chat_credits",
        COALESCE(MAX("entries"."provider_cost_picousd") FILTER (
          WHERE "entries"."entry_type" = 'settlement'
        ), 0)::bigint AS "provider_cost_picousd",
        BOOL_OR("entries"."entry_type" = 'settlement') AS "has_settlement",
        COALESCE(MAX("pricing"."provider") FILTER (
          WHERE "entries"."entry_type" = 'settlement'
        ), 'unpriced') AS "provider"
      FROM "credit_ledger_entries" AS "entries"
      LEFT JOIN "credit_pricing_versions" AS "pricing"
        ON "pricing"."id" = "entries"."pricing_version_id"
      WHERE "entries"."operation_id" IN (SELECT "request_id" FROM "filtered_events")
        AND "entries"."entry_type" IN ('reservation', 'settlement', 'reversal')
      GROUP BY "entries"."operation_id"
    ),
    "turns" AS (
      SELECT
        "events".*,
        COALESCE("ledger"."provider_cost_picousd", 0)::bigint AS "provider_cost_picousd",
        CASE
          WHEN COALESCE("ledger"."has_settlement", false)
            THEN GREATEST(-COALESCE("ledger"."net_chat_credits", 0), 0)::bigint
          ELSE 0::bigint
        END AS "charged_credits",
        COALESCE("ledger"."has_settlement", false) AS "has_settlement",
        COALESCE("ledger"."provider", 'unpriced') AS "provider"
      FROM "filtered_events" AS "events"
      LEFT JOIN "ledger_operations" AS "ledger"
        ON "ledger"."operation_id" = "events"."request_id"
    )
  `;
}

type MetricRow = {
  request_count: bigint;
  completed_turns: bigint;
  failed_turns: bigint;
  pending_turns: bigint;
  unpriced_completed_turns: bigint;
  provider_calls: bigint;
  input_tokens: bigint;
  cached_input_tokens: bigint;
  output_tokens: bigint;
  total_tokens: bigint;
  charged_credits: bigint;
  provider_cost_picousd: bigint;
  active_users?: bigint;
};

type UserMetricRow = MetricRow & {
  user_id: number;
  email: string;
  public_username: string | null;
  active: boolean;
  chat_enabled: boolean;
  payment_restricted: boolean;
  available_credits: bigint;
  last_activity_at: Date | null;
};

function metricFromRow(row: MetricRow | undefined): ChatUsageMetrics {
  const providerCostPicousd = toBigInt(
    row?.provider_cost_picousd ?? ZERO_BIGINT,
  );
  const chargedCredits = toSafeNumber(row?.charged_credits ?? ZERO_BIGINT);
  const creditEquivalentPicousd = BigInt(chargedCredits) * PICOUSD_PER_CREDIT;
  return {
    requestCount: toSafeNumber(row?.request_count ?? ZERO_BIGINT),
    completedTurns: toSafeNumber(row?.completed_turns ?? ZERO_BIGINT),
    failedTurns: toSafeNumber(row?.failed_turns ?? ZERO_BIGINT),
    pendingTurns: toSafeNumber(row?.pending_turns ?? ZERO_BIGINT),
    unpricedCompletedTurns: toSafeNumber(
      row?.unpriced_completed_turns ?? ZERO_BIGINT,
    ),
    providerCalls: toSafeNumber(row?.provider_calls ?? ZERO_BIGINT),
    inputTokens: toSafeNumber(row?.input_tokens ?? ZERO_BIGINT),
    cachedInputTokens: toSafeNumber(row?.cached_input_tokens ?? ZERO_BIGINT),
    outputTokens: toSafeNumber(row?.output_tokens ?? ZERO_BIGINT),
    totalTokens: toSafeNumber(row?.total_tokens ?? ZERO_BIGINT),
    chargedCredits,
    providerCostPicousd: providerCostPicousd.toString(),
    creditEquivalentPicousd: creditEquivalentPicousd.toString(),
    estimatedSpreadPicousd: (
      creditEquivalentPicousd - providerCostPicousd
    ).toString(),
  };
}

function toBigInt(value: bigint | number | string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  return BigInt(value);
}

function toSafeNumber(value: bigint | number): number {
  const numeric = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isSafeInteger(numeric))
    throw new RangeError(
      "Chat usage metric exceeds JavaScript's safe integer range.",
    );
  return numeric;
}
