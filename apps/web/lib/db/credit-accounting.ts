import "server-only";

import {
  assertSufficientCredits,
  availableCreditsFromLedger,
  reservationCreditsDelta,
  reverseReservedCredits,
  settleReservedCredits,
  type CreditSettlement,
} from "@meadtools/credit-accounting";
import {
  failedProviderReservationAction,
  quoteCreditsForChatUsage,
} from "@meadtools/chat-domain";
import { Prisma, credit_ledger_entry_type } from "@prisma/client";
import {
  completeChatbotUsage,
  getChatbotUsageCheckpoint,
} from "@/lib/db/chatbot-usage";
import prisma from "@/lib/prisma";

export class CreditReservationNotFoundError extends Error {
  constructor() {
    super("The credit reservation is not available.");
    this.name = "CreditReservationNotFoundError";
  }
}

export class CreditReservationFinalizedError extends Error {
  constructor() {
    super("The credit reservation has already been finalized.");
    this.name = "CreditReservationFinalizedError";
  }
}

export class CreditLedgerIdempotencyConflictError extends Error {
  constructor() {
    super("This credit operation conflicts with a prior request.");
    this.name = "CreditLedgerIdempotencyConflictError";
  }
}

/** A payment recovery is awaiting review, so new provider spend is blocked. */
export class CreditPaymentRestrictedError extends Error {
  constructor() {
    super(
      "Chat credits are temporarily unavailable while a payment adjustment is reviewed.",
    );
    this.name = "CreditPaymentRestrictedError";
  }
}

export type StoredCreditBalance = {
  accountId: string | null;
  availableCredits: number;
  paymentRestricted: boolean;
};

export type StoredCreditReservation = {
  accountId: string;
  operationId: string;
  reservationCredits: number;
  availableCredits: number;
};

export type StoredCreditPurchase = {
  accountId: string;
  operationId: string;
  creditAmount: number;
  availableCredits: number;
};

export type StoredCreditGrant = {
  accountId: string;
  operationId: string;
  creditAmount: number;
  availableCredits: number;
};

export type StoredCreditSettlement = CreditSettlement & {
  accountId: string;
  operationId: string;
  availableCredits: number;
};

/**
 * Reverses credit holds that outlived a request by a generous margin. A
 * reservation is only reversed when no settlement or reversal exists for the
 * same operation, so this remains safe to run repeatedly from maintenance.
 */
export async function reverseAbandonedCreditReservations(options?: {
  olderThan?: Date;
  limit?: number;
  now?: Date;
}): Promise<{ reversed: number; settled: number; skipped: number }> {
  const olderThan = options?.olderThan ?? new Date(Date.now() - 60 * 60 * 1000);
  const limit = options?.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new RangeError(
      "Credit reservation reconciliation limit must be between 1 and 500.",
    );
  }

  const candidates = await prisma.$queryRaw<
    Array<{ user_id: number; operation_id: string }>
  >(Prisma.sql`
    SELECT "accounts"."user_id", "reservations"."operation_id"::text AS "operation_id"
    FROM "credit_ledger_entries" AS "reservations"
    INNER JOIN "credit_accounts" AS "accounts"
      ON "accounts"."id" = "reservations"."account_id"
    WHERE "reservations"."entry_type" = ${credit_ledger_entry_type.reservation}
      AND "reservations"."created_at" <= ${olderThan}
      AND NOT EXISTS (
        SELECT 1
        FROM "credit_ledger_entries" AS "final_entries"
        WHERE "final_entries"."account_id" = "reservations"."account_id"
          AND "final_entries"."operation_id" = "reservations"."operation_id"
          AND "final_entries"."entry_type" IN (
            ${credit_ledger_entry_type.settlement},
            ${credit_ledger_entry_type.reversal}
          )
      )
    ORDER BY "reservations"."created_at" ASC
    LIMIT ${limit}
  `);

  let reversed = 0;
  let settled = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    try {
      const checkpoint = await getChatbotUsageCheckpoint(
        candidate.operation_id,
      );
      const action = failedProviderReservationAction({
        providerAttemptCount: checkpoint?.providerAttemptCount ?? 0,
        checkpointedProviderCallCount:
          checkpoint?.checkpointedProviderCallCount ?? 0,
      });
      if (action === "settle" && checkpoint) {
        const reservation = await prisma.credit_ledger_entries.findFirst({
          where: {
            operation_id: candidate.operation_id,
            entry_type: credit_ledger_entry_type.reservation,
          },
          select: {
            pricing_version: true,
            fee_policy_version: true,
          },
        });
        if (!reservation?.pricing_version || !reservation.fee_policy_version) {
          // The hold is safer than granting a completed provider call when an
          // historic pricing snapshot is unexpectedly unavailable.
          skipped += 1;
          continue;
        }
        const quote = quoteCreditsForChatUsage({
          usage: {
            inputTokens: checkpoint.usage.inputTokens,
            cachedInputTokens: checkpoint.usage.cachedInputTokens,
            outputTokens: checkpoint.usage.outputTokens,
          },
          providerCallCount: checkpoint.checkpointedProviderCallCount,
          pricing: {
            uncachedInputPicousdPerMillionTokens:
              reservation.pricing_version
                .uncached_input_picousd_per_million_tokens,
            cachedInputPicousdPerMillionTokens:
              reservation.pricing_version
                .cached_input_picousd_per_million_tokens,
            outputPicousdPerMillionTokens:
              reservation.pricing_version.output_picousd_per_million_tokens,
          },
          feePolicy: {
            markupBasisPoints:
              reservation.fee_policy_version.markup_basis_points,
            fixedTurnCredits: reservation.fee_policy_version.fixed_turn_credits,
            minimumTurnCredits:
              reservation.fee_policy_version.minimum_turn_credits,
          },
        });
        if (!quote) {
          skipped += 1;
          continue;
        }
        await settleCreditReservation({
          userId: candidate.user_id,
          operationId: candidate.operation_id,
          idempotencyKey: `credit-maintenance-settlement:${candidate.operation_id}`,
          chargedCredits: quote.chargedCredits,
          providerCostPicousd: quote.providerCostPicousd,
          pricingVersionId: reservation.pricing_version.id,
          feePolicyVersionId: reservation.fee_policy_version.id,
          now: options?.now,
        });
        await completeChatbotUsage({
          requestId: candidate.operation_id,
          userId: candidate.user_id,
          usage: checkpoint.usage,
          status: "failed",
          windowAt: options?.now,
        });
        settled += 1;
        continue;
      }
      if (action === "hold") {
        skipped += 1;
        continue;
      }
      await reverseCreditReservation({
        userId: candidate.user_id,
        operationId: candidate.operation_id,
        idempotencyKey: `credit-maintenance-reversal:${candidate.operation_id}`,
        now: options?.now,
      });
      reversed += 1;
    } catch (error) {
      // A concurrently finishing request can finalize between the candidate
      // query and reversal. That is expected and must not fail maintenance.
      if (error instanceof CreditReservationFinalizedError) {
        skipped += 1;
        continue;
      }
      throw error;
    }
  }

  return { reversed, settled, skipped };
}

/**
 * Repairs usage rows that remain reserved after their corresponding credit
 * reservation has already been settled or reversed. This is intentionally
 * separate from reservation reconciliation: the ledger is final, so only the
 * audit-window terminalization remains to be made durable.
 */
export async function reconcileFinalizedChatbotUsageEvents(options?: {
  olderThan?: Date;
  limit?: number;
  now?: Date;
}): Promise<{ finalized: number; skipped: number }> {
  const olderThan = options?.olderThan ?? new Date(Date.now() - 60 * 60 * 1000);
  const limit = options?.limit ?? 100;
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new RangeError(
      "Chat usage reconciliation limit must be between 1 and 500.",
    );
  }
  const candidates = await prisma.$queryRaw<
    Array<{ user_id: number; request_id: string }>
  >(Prisma.sql`
    SELECT "events"."user_id", "events"."request_id"::text AS "request_id"
    FROM "chatbot_usage_events" AS "events"
    WHERE "events"."status" = 'reserved'
      AND "events"."created_at" <= ${olderThan}
      AND EXISTS (
        SELECT 1
        FROM "credit_ledger_entries" AS "final_entries"
        WHERE "final_entries"."operation_id" = "events"."request_id"
          AND "final_entries"."entry_type" IN (
            ${credit_ledger_entry_type.settlement},
            ${credit_ledger_entry_type.reversal}
          )
      )
    ORDER BY "events"."created_at" ASC
    LIMIT ${limit}
  `);

  let finalized = 0;
  let skipped = 0;
  for (const candidate of candidates) {
    const checkpoint = await getChatbotUsageCheckpoint(candidate.request_id);
    if (!checkpoint) {
      skipped += 1;
      continue;
    }
    await completeChatbotUsage({
      requestId: candidate.request_id,
      userId: candidate.user_id,
      usage: checkpoint.usage,
      // A completed event would already be terminal. A stale reserved event
      // follows an interrupted persistence path, so it is conservatively
      // retained as failed while still contributing its known usage once.
      status: "failed",
      windowAt: options?.now,
    });
    finalized += 1;
  }
  return { finalized, skipped };
}

/**
 * Reads the ledger-derived balance. An account is created only when it first
 * receives a purchase, grant, or provider reservation.
 */
export async function getCreditBalance(
  userId: number,
): Promise<StoredCreditBalance> {
  const account = await prisma.credit_accounts.findUnique({
    where: { user_id: userId },
    select: { id: true, payment_restricted_at: true },
  });
  if (!account)
    return { accountId: null, availableCredits: 0, paymentRestricted: false };

  return {
    accountId: account.id,
    availableCredits: await ledgerBalance(prisma, account.id),
    paymentRestricted: Boolean(account.payment_restricted_at),
  };
}

/**
 * Reads the current balance while holding the account-row lock. Payment
 * recovery resolution uses this before re-enabling chat so a previously
 * overspent refund cannot be released without an explicit correction.
 */
export async function getLockedCreditBalanceInTransaction(
  tx: Prisma.TransactionClient,
  userId: number,
): Promise<StoredCreditBalance> {
  const accountId = await getOrCreateLockedCreditAccount(tx, userId);
  const account = await tx.credit_accounts.findUnique({
    where: { id: accountId },
    select: { payment_restricted_at: true },
  });
  return {
    accountId,
    availableCredits: await ledgerBalance(tx, accountId),
    paymentRestricted: Boolean(account?.payment_restricted_at),
  };
}

/**
 * Creates an immutable negative reservation under the account-row lock. This
 * is the operation that must complete before an AI provider request is made.
 */
export async function reserveCreditBalance(options: {
  userId: number;
  operationId: string;
  idempotencyKey: string;
  reservationCredits: number;
  pricingVersionId?: string;
  feePolicyVersionId?: string;
  now?: Date;
}): Promise<StoredCreditReservation> {
  return prisma.$transaction(async (tx) => {
    const accountId = await getOrCreateLockedCreditAccount(tx, options.userId);
    await assertAccountNotPaymentRestricted(tx, accountId);
    const existing = await tx.credit_ledger_entries.findUnique({
      where: {
        account_id_idempotency_key: {
          account_id: accountId,
          idempotency_key: options.idempotencyKey,
        },
      },
    });

    if (existing) {
      assertMatchingReservation(existing, options);
      return {
        accountId,
        operationId: options.operationId,
        reservationCredits: -existing.credits_delta,
        availableCredits: await ledgerBalance(tx, accountId),
      };
    }

    const availableCredits = await ledgerBalance(tx, accountId);
    assertSufficientCredits({
      availableCredits,
      requiredCredits: options.reservationCredits,
    });

    await tx.credit_ledger_entries.create({
      data: {
        account_id: accountId,
        operation_id: options.operationId,
        idempotency_key: options.idempotencyKey,
        entry_type: credit_ledger_entry_type.reservation,
        credits_delta: reservationCreditsDelta(options.reservationCredits),
        pricing_version_id: options.pricingVersionId,
        fee_policy_version_id: options.feePolicyVersionId,
        created_at: options.now,
      },
    });

    return {
      accountId,
      operationId: options.operationId,
      reservationCredits: options.reservationCredits,
      availableCredits: availableCredits - options.reservationCredits,
    };
  });
}

/**
 * Records a verified external payment as one idempotent, positive ledger
 * entry. Call this only from a payment-provider webhook transaction.
 */
export async function recordCreditPurchase(options: {
  userId: number;
  operationId: string;
  idempotencyKey: string;
  creditAmount: number;
  sourceAmountCents: number;
  sourceCurrency: string;
  externalReference: string;
  metadata?: Prisma.InputJsonValue;
  now?: Date;
}): Promise<StoredCreditPurchase> {
  return prisma.$transaction((tx) =>
    recordCreditPurchaseInTransaction(tx, options),
  );
}

/** Records an operator-issued or promotional credit allocation immutably. */
export async function recordCreditGrant(options: {
  userId: number;
  operationId: string;
  idempotencyKey: string;
  creditAmount: number;
  metadata?: Prisma.InputJsonValue;
  now?: Date;
}): Promise<StoredCreditGrant> {
  return prisma.$transaction((tx) =>
    recordCreditGrantInTransaction(tx, options),
  );
}

export async function recordCreditGrantInTransaction(
  tx: Prisma.TransactionClient,
  options: {
    userId: number;
    operationId: string;
    idempotencyKey: string;
    creditAmount: number;
    metadata?: Prisma.InputJsonValue;
    now?: Date;
  },
): Promise<StoredCreditGrant> {
  assertPositiveInteger(options.creditAmount, "credit amount");
  const accountId = await getOrCreateLockedCreditAccount(tx, options.userId);
  const existing = await tx.credit_ledger_entries.findUnique({
    where: {
      account_id_idempotency_key: {
        account_id: accountId,
        idempotency_key: options.idempotencyKey,
      },
    },
  });
  if (existing) {
    if (
      existing.entry_type !== credit_ledger_entry_type.grant ||
      existing.operation_id !== options.operationId ||
      existing.credits_delta !== options.creditAmount
    ) {
      throw new CreditLedgerIdempotencyConflictError();
    }
    return {
      accountId,
      operationId: options.operationId,
      creditAmount: options.creditAmount,
      availableCredits: await ledgerBalance(tx, accountId),
    };
  }

  await tx.credit_ledger_entries.create({
    data: {
      account_id: accountId,
      operation_id: options.operationId,
      idempotency_key: options.idempotencyKey,
      entry_type: credit_ledger_entry_type.grant,
      credits_delta: options.creditAmount,
      metadata: options.metadata,
      created_at: options.now,
    },
  });
  return {
    accountId,
    operationId: options.operationId,
    creditAmount: options.creditAmount,
    availableCredits: await ledgerBalance(tx, accountId),
  };
}

export async function recordCreditPurchaseInTransaction(
  tx: Prisma.TransactionClient,
  options: {
    userId: number;
    operationId: string;
    idempotencyKey: string;
    creditAmount: number;
    sourceAmountCents: number;
    sourceCurrency: string;
    externalReference: string;
    metadata?: Prisma.InputJsonValue;
    now?: Date;
  },
): Promise<StoredCreditPurchase> {
  assertPositiveInteger(options.creditAmount, "credit amount");
  assertNonNegativeInteger(options.sourceAmountCents, "source amount");
  const sourceCurrency = options.sourceCurrency.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(sourceCurrency)) {
    throw new RangeError(
      "source currency must be a three-letter lowercase code.",
    );
  }

  const accountId = await getOrCreateLockedCreditAccount(tx, options.userId);
  const existing = await tx.credit_ledger_entries.findUnique({
    where: {
      account_id_idempotency_key: {
        account_id: accountId,
        idempotency_key: options.idempotencyKey,
      },
    },
  });
  if (existing) {
    if (
      existing.entry_type !== credit_ledger_entry_type.purchase ||
      existing.operation_id !== options.operationId ||
      existing.credits_delta !== options.creditAmount ||
      existing.source_amount_cents !== options.sourceAmountCents ||
      existing.source_currency !== sourceCurrency ||
      existing.external_reference !== options.externalReference
    ) {
      throw new CreditLedgerIdempotencyConflictError();
    }
    return {
      accountId,
      operationId: options.operationId,
      creditAmount: options.creditAmount,
      availableCredits: await ledgerBalance(tx, accountId),
    };
  }

  await tx.credit_ledger_entries.create({
    data: {
      account_id: accountId,
      operation_id: options.operationId,
      idempotency_key: options.idempotencyKey,
      entry_type: credit_ledger_entry_type.purchase,
      credits_delta: options.creditAmount,
      source_amount_cents: options.sourceAmountCents,
      source_currency: sourceCurrency,
      external_reference: options.externalReference,
      metadata: options.metadata,
      created_at: options.now,
    },
  });

  return {
    accountId,
    operationId: options.operationId,
    creditAmount: options.creditAmount,
    availableCredits: await ledgerBalance(tx, accountId),
  };
}

/**
 * Records an external-payment correction without mutating the original
 * purchase. Negative values remove credits; positive values are reserved for
 * an explicit operator correction.
 */
export async function recordCreditAdjustmentInTransaction(
  tx: Prisma.TransactionClient,
  options: {
    userId: number;
    operationId: string;
    idempotencyKey: string;
    creditsDelta: number;
    sourceAmountCents?: number;
    sourceCurrency?: string;
    externalReference?: string;
    /** Refunds stay visibly distinct from an operator adjustment in wallet history. */
    entryType?: "adjustment" | "refund";
    metadata?: Prisma.InputJsonValue;
    now?: Date;
  },
): Promise<{
  accountId: string;
  operationId: string;
  creditsDelta: number;
  availableCredits: number;
}> {
  if (
    !Number.isSafeInteger(options.creditsDelta) ||
    options.creditsDelta === 0
  ) {
    throw new RangeError("credit adjustment must be a non-zero safe integer.");
  }
  if (options.sourceAmountCents !== undefined) {
    assertNonNegativeInteger(options.sourceAmountCents, "source amount");
  }
  const sourceCurrency = options.sourceCurrency?.trim().toLowerCase();
  const entryType = options.entryType ?? credit_ledger_entry_type.adjustment;
  if (sourceCurrency !== undefined && !/^[a-z]{3}$/.test(sourceCurrency)) {
    throw new RangeError(
      "source currency must be a three-letter lowercase code.",
    );
  }

  const accountId = await getOrCreateLockedCreditAccount(tx, options.userId);
  const existing = await tx.credit_ledger_entries.findUnique({
    where: {
      account_id_idempotency_key: {
        account_id: accountId,
        idempotency_key: options.idempotencyKey,
      },
    },
  });
  if (existing) {
    if (
      existing.entry_type !== entryType ||
      existing.operation_id !== options.operationId ||
      existing.credits_delta !== options.creditsDelta ||
      existing.external_reference !== (options.externalReference ?? null)
    ) {
      throw new CreditLedgerIdempotencyConflictError();
    }
    return {
      accountId,
      operationId: options.operationId,
      creditsDelta: options.creditsDelta,
      availableCredits: await ledgerBalance(tx, accountId),
    };
  }

  await tx.credit_ledger_entries.create({
    data: {
      account_id: accountId,
      operation_id: options.operationId,
      idempotency_key: options.idempotencyKey,
      entry_type: entryType,
      credits_delta: options.creditsDelta,
      source_amount_cents: options.sourceAmountCents,
      source_currency: sourceCurrency,
      external_reference: options.externalReference,
      metadata: options.metadata,
      created_at: options.now,
    },
  });
  return {
    accountId,
    operationId: options.operationId,
    creditsDelta: options.creditsDelta,
    availableCredits: await ledgerBalance(tx, accountId),
  };
}

/**
 * Appends the positive unused portion of a reservation after a provider call.
 * The original negative hold is never updated or deleted.
 */
export async function settleCreditReservation(options: {
  userId: number;
  operationId: string;
  idempotencyKey: string;
  chargedCredits: number;
  providerCostPicousd: bigint;
  pricingVersionId?: string;
  feePolicyVersionId?: string;
  now?: Date;
}): Promise<StoredCreditSettlement> {
  return prisma.$transaction(async (tx) => {
    const accountId = await getOrCreateLockedCreditAccount(tx, options.userId);
    const reservation = await findReservation(
      tx,
      accountId,
      options.operationId,
    );
    assertNonNegativeBigInt(options.providerCostPicousd, "provider cost");
    const existing = await tx.credit_ledger_entries.findUnique({
      where: {
        account_id_idempotency_key: {
          account_id: accountId,
          idempotency_key: options.idempotencyKey,
        },
      },
    });

    if (existing) {
      const settlement = settleReservedCredits({
        reservationCredits: -reservation.credits_delta,
        chargedCredits: options.chargedCredits,
      });
      assertMatchingSettlement(existing, { ...options, settlement });
      return {
        accountId,
        operationId: options.operationId,
        ...settlement,
        availableCredits: await ledgerBalance(tx, accountId),
      };
    }

    await assertReservationNotFinalized(tx, accountId, options.operationId);
    const settlement = settleReservedCredits({
      reservationCredits: -reservation.credits_delta,
      chargedCredits: options.chargedCredits,
    });
    await tx.credit_ledger_entries.create({
      data: {
        account_id: accountId,
        operation_id: options.operationId,
        idempotency_key: options.idempotencyKey,
        entry_type: credit_ledger_entry_type.settlement,
        credits_delta: settlement.settlementCreditsDelta,
        pricing_version_id: options.pricingVersionId,
        fee_policy_version_id: options.feePolicyVersionId,
        provider_cost_picousd: options.providerCostPicousd,
        created_at: options.now,
      },
    });

    return {
      accountId,
      operationId: options.operationId,
      ...settlement,
      availableCredits: await ledgerBalance(tx, accountId),
    };
  });
}

/** Reverses the complete reservation when no chargeable provider work occurred. */
export async function reverseCreditReservation(options: {
  userId: number;
  operationId: string;
  idempotencyKey: string;
  now?: Date;
}): Promise<StoredCreditReservation> {
  return prisma.$transaction(async (tx) => {
    const accountId = await getOrCreateLockedCreditAccount(tx, options.userId);
    const reservation = await findReservation(
      tx,
      accountId,
      options.operationId,
    );
    const existing = await tx.credit_ledger_entries.findUnique({
      where: {
        account_id_idempotency_key: {
          account_id: accountId,
          idempotency_key: options.idempotencyKey,
        },
      },
    });

    if (existing) {
      if (
        existing.entry_type !== credit_ledger_entry_type.reversal ||
        existing.operation_id !== options.operationId
      ) {
        throw new CreditLedgerIdempotencyConflictError();
      }
      return {
        accountId,
        operationId: options.operationId,
        reservationCredits: -reservation.credits_delta,
        availableCredits: await ledgerBalance(tx, accountId),
      };
    }

    await assertReservationNotFinalized(tx, accountId, options.operationId);
    const reservationCredits = -reservation.credits_delta;
    await tx.credit_ledger_entries.create({
      data: {
        account_id: accountId,
        operation_id: options.operationId,
        idempotency_key: options.idempotencyKey,
        entry_type: credit_ledger_entry_type.reversal,
        credits_delta: reverseReservedCredits(reservationCredits),
        created_at: options.now,
      },
    });

    return {
      accountId,
      operationId: options.operationId,
      reservationCredits,
      availableCredits: await ledgerBalance(tx, accountId),
    };
  });
}

async function getOrCreateLockedCreditAccount(
  tx: Prisma.TransactionClient,
  userId: number,
): Promise<string> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "credit_accounts" ("user_id")
    VALUES (${userId})
    ON CONFLICT ("user_id") DO UPDATE
    SET "updated_at" = CURRENT_TIMESTAMP
    RETURNING "id"
  `);
  const account = rows[0];
  if (!account) throw new Error("Unable to lock the credit account.");
  return account.id;
}

async function assertAccountNotPaymentRestricted(
  tx: Prisma.TransactionClient,
  accountId: string,
): Promise<void> {
  const account = await tx.credit_accounts.findUnique({
    where: { id: accountId },
    select: { payment_restricted_at: true },
  });
  if (account?.payment_restricted_at) throw new CreditPaymentRestrictedError();
}

async function findReservation(
  tx: Prisma.TransactionClient,
  accountId: string,
  operationId: string,
) {
  const reservation = await tx.credit_ledger_entries.findUnique({
    where: {
      account_id_operation_id_entry_type: {
        account_id: accountId,
        operation_id: operationId,
        entry_type: credit_ledger_entry_type.reservation,
      },
    },
  });
  if (!reservation) throw new CreditReservationNotFoundError();
  return reservation;
}

async function assertReservationNotFinalized(
  tx: Prisma.TransactionClient,
  accountId: string,
  operationId: string,
): Promise<void> {
  const finalEntry = await tx.credit_ledger_entries.findFirst({
    where: {
      account_id: accountId,
      operation_id: operationId,
      entry_type: {
        in: [
          credit_ledger_entry_type.settlement,
          credit_ledger_entry_type.reversal,
        ],
      },
    },
    select: { id: true },
  });
  if (finalEntry) throw new CreditReservationFinalizedError();
}

async function ledgerBalance(
  client: Prisma.TransactionClient | typeof prisma,
  accountId: string,
): Promise<number> {
  const rows = await client.$queryRaw<Array<{ balance: bigint }>>(Prisma.sql`
    SELECT COALESCE(SUM("credits_delta"), 0)::bigint AS "balance"
    FROM "credit_ledger_entries"
    WHERE "account_id" = ${accountId}::uuid
  `);
  const balance = rows[0]?.balance ?? BigInt(0);
  if (
    balance > BigInt(Number.MAX_SAFE_INTEGER) ||
    balance < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    throw new RangeError(
      "The ledger balance exceeds JavaScript's safe integer range.",
    );
  }
  return availableCreditsFromLedger([Number(balance)]);
}

function assertMatchingReservation(
  entry: {
    entry_type: credit_ledger_entry_type;
    operation_id: string;
    credits_delta: number;
  },
  options: { operationId: string; reservationCredits: number },
): void {
  if (
    entry.entry_type !== credit_ledger_entry_type.reservation ||
    entry.operation_id !== options.operationId ||
    entry.credits_delta !== -options.reservationCredits
  ) {
    throw new CreditLedgerIdempotencyConflictError();
  }
}

function assertMatchingSettlement(
  entry: {
    entry_type: credit_ledger_entry_type;
    operation_id: string;
    credits_delta: number;
    provider_cost_picousd: bigint | null;
  },
  options: {
    operationId: string;
    providerCostPicousd: bigint;
    settlement: CreditSettlement;
  },
): void {
  if (
    entry.entry_type !== credit_ledger_entry_type.settlement ||
    entry.operation_id !== options.operationId ||
    entry.credits_delta !== options.settlement.settlementCreditsDelta ||
    entry.provider_cost_picousd !== options.providerCostPicousd
  ) {
    throw new CreditLedgerIdempotencyConflictError();
  }
}

function assertNonNegativeBigInt(value: bigint, label: string): void {
  if (value < BigInt(0)) throw new RangeError(`${label} cannot be negative.`);
}

function assertNonNegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer.`);
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive safe integer.`);
  }
}
