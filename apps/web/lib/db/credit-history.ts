import "server-only";

import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export type CreditActivityKind =
  | "purchase"
  | "grant"
  | "usage"
  | "refund"
  | "adjustment";

export type CreditActivity = {
  operationId: string;
  occurredAt: Date;
  creditsDelta: number;
  kind: CreditActivityKind;
  entryTypes: string[];
  paymentAmountCents: number | null;
  paymentCurrency: string | null;
};

export type CreditActivityPage = {
  activities: CreditActivity[];
  nextCursor: string | null;
};

export class InvalidCreditActivityCursorError extends Error {
  constructor() {
    super("The credit history cursor is invalid.");
    this.name = "InvalidCreditActivityCursorError";
  }
}

/**
 * Pages wallet activity by operation rather than individual ledger rows. A
 * completed chat turn, for example, has a reservation and settlement but is
 * returned as one net usage item.
 */
export async function getCreditActivityPage(options: {
  userId: number;
  cursor?: string;
  limit?: number;
}): Promise<CreditActivityPage> {
  const limit = normalizeLimit(options.limit);
  const cursor = options.cursor ? decodeCursor(options.cursor) : undefined;
  const cursorCondition = cursor
    ? Prisma.sql`WHERE ("last_occurred_at", "operation_id") < (${cursor.occurredAt}, ${cursor.operationId}::uuid)`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<CreditActivityRow[]>(Prisma.sql`
    WITH "grouped_credit_activity" AS (
      SELECT
        "entries"."operation_id",
        MAX("entries"."created_at") AS "last_occurred_at",
        SUM("entries"."credits_delta")::bigint AS "credits_delta",
        ARRAY_AGG(DISTINCT "entries"."entry_type"::text ORDER BY "entries"."entry_type"::text) AS "entry_types",
        MAX("entries"."source_amount_cents") AS "source_amount_cents",
        MAX("entries"."source_currency") AS "source_currency"
      FROM "credit_ledger_entries" AS "entries"
      INNER JOIN "credit_accounts" AS "accounts"
        ON "accounts"."id" = "entries"."account_id"
      WHERE "accounts"."user_id" = ${options.userId}
      GROUP BY "entries"."operation_id"
    )
    SELECT
      "operation_id",
      "last_occurred_at",
      "credits_delta",
      "entry_types",
      "source_amount_cents",
      "source_currency"
    FROM "grouped_credit_activity"
    ${cursorCondition}
    ORDER BY "last_occurred_at" DESC, "operation_id" DESC
    LIMIT ${limit + 1}
  `);

  const hasNextPage = rows.length > limit;
  const visibleRows = hasNextPage ? rows.slice(0, limit) : rows;
  const lastRow = visibleRows.at(-1);

  return {
    activities: visibleRows.map(toCreditActivity),
    nextCursor:
      hasNextPage && lastRow
        ? encodeCursor({
            occurredAt: lastRow.last_occurred_at,
            operationId: lastRow.operation_id,
          })
        : null,
  };
}

type CreditActivityRow = {
  operation_id: string;
  last_occurred_at: Date;
  credits_delta: bigint;
  entry_types: string[];
  source_amount_cents: number | null;
  source_currency: string | null;
};

function toCreditActivity(row: CreditActivityRow): CreditActivity {
  if (
    row.credits_delta > BigInt(Number.MAX_SAFE_INTEGER) ||
    row.credits_delta < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new RangeError(
      "The credit activity amount exceeds JavaScript's safe integer range.",
    );
  }

  return {
    operationId: row.operation_id,
    occurredAt: row.last_occurred_at,
    creditsDelta: Number(row.credits_delta),
    kind: activityKindFor(row.entry_types),
    entryTypes: row.entry_types,
    paymentAmountCents: row.source_amount_cents,
    paymentCurrency: row.source_currency,
  };
}

function activityKindFor(entryTypes: readonly string[]): CreditActivityKind {
  if (entryTypes.includes("purchase")) return "purchase";
  if (entryTypes.includes("grant")) return "grant";
  if (entryTypes.includes("refund")) return "refund";
  if (entryTypes.includes("reservation")) return "usage";
  return "adjustment";
}

function normalizeLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_PAGE_SIZE;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new RangeError(
      `Credit history limit must be between 1 and ${MAX_PAGE_SIZE}.`,
    );
  }
  return limit;
}

function encodeCursor(cursor: {
  occurredAt: Date;
  operationId: string;
}): string {
  return Buffer.from(
    JSON.stringify({
      occurredAt: cursor.occurredAt.toISOString(),
      operationId: cursor.operationId,
    }),
  ).toString("base64url");
}

function decodeCursor(value: string): {
  occurredAt: Date;
  operationId: string;
} {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    );
    if (!isCreditActivityCursor(parsed))
      throw new InvalidCreditActivityCursorError();
    const occurredAt = new Date(parsed.occurredAt);
    if (Number.isNaN(occurredAt.getTime()))
      throw new InvalidCreditActivityCursorError();
    return { occurredAt, operationId: parsed.operationId };
  } catch (error) {
    if (error instanceof InvalidCreditActivityCursorError) throw error;
    throw new InvalidCreditActivityCursorError();
  }
}

function isCreditActivityCursor(
  value: unknown,
): value is { occurredAt: string; operationId: string } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.occurredAt === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      typeof candidate.operationId === "string" ? candidate.operationId : "",
    )
  );
}
