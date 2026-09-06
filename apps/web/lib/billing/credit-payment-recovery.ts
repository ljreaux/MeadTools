import "server-only";

import {
  Prisma,
  credit_payment_recovery_kind,
  credit_payment_recovery_status,
  credit_stripe_dispute_event_status,
  credit_stripe_refund_event_status,
} from "@prisma/client";
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import {
  getLockedCreditBalanceInTransaction,
  recordCreditAdjustmentInTransaction,
} from "@/lib/db/credit-accounting";
import { canReleasePaymentRestrictedChat } from "./credit-payment-recovery-eligibility";
import { calculateCreditRefundReconciliation } from "./credit-payment-recovery-math";
import { stripeDashboardDisputeUrl } from "./stripe";
import {
  paymentRecoveryCheckoutDisposition,
  shouldReplayStoredDispute,
} from "./credit-payment-recovery-ordering";

export type CreditPaymentRecoveryResult =
  | "applied"
  | "review_required"
  | "duplicate"
  | "deferred"
  | "ignored";

export class CreditPaymentRecoveryNotFoundError extends Error {
  constructor() {
    super("The payment recovery record was not found.");
    this.name = "CreditPaymentRecoveryNotFoundError";
  }
}

export class CreditPaymentRecoveryResolutionError extends Error {
  constructor(message = "This payment recovery cannot be resolved yet.") {
    super(message);
    this.name = "CreditPaymentRecoveryResolutionError";
  }
}

/**
 * Reconciles provider refunds only after Stripe reports them as succeeded.
 * A refund that cannot be mapped safely is still persisted as a review case
 * and blocks new chat spend until an administrator resolves it.
 */
export async function reconcileStripeRefund(options: {
  eventId: string;
  eventType: string;
  refund: Stripe.Refund;
}): Promise<CreditPaymentRecoveryResult> {
  if (options.refund.status !== "succeeded") return "ignored";
  const paymentIntentId = stripeId(options.refund.payment_intent);
  const currency = options.refund.currency?.toLowerCase();
  if (
    !paymentIntentId ||
    !currency ||
    !Number.isSafeInteger(options.refund.amount) ||
    options.refund.amount < 0
  ) {
    return "ignored";
  }

  try {
    await prisma.credit_stripe_refund_events.create({
      data: {
        external_event_id: options.eventId,
        event_type: options.eventType,
        stripe_refund_id: options.refund.id,
        stripe_payment_intent_id: paymentIntentId,
        amount_cents: options.refund.amount,
        currency,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return "duplicate";
    }
    throw error;
  }

  return processStoredStripeRefundEvent(options.eventId);
}

/** Replays succeeded refunds received before Checkout fulfillment. */
export async function reconcileDeferredStripeRefunds(
  paymentIntentId: string,
): Promise<void> {
  const events = await prisma.credit_stripe_refund_events.findMany({
    where: {
      stripe_payment_intent_id: paymentIntentId,
      status: {
        in: [
          credit_stripe_refund_event_status.deferred,
          credit_stripe_refund_event_status.processed,
        ],
      },
    },
    select: { external_event_id: true },
  });
  for (const event of events)
    await processStoredStripeRefundEvent(event.external_event_id);
}

async function processStoredStripeRefundEvent(
  eventId: string,
): Promise<CreditPaymentRecoveryResult> {
  return prisma.$transaction(async (tx) => {
    const event = await tx.credit_stripe_refund_events.findUnique({
      where: { external_event_id: eventId },
    });
    if (!event) return "ignored" as const;
    const checkout = await findCheckoutForUpdate(
      tx,
      event.stripe_payment_intent_id,
    );
    // Before Checkout fulfillment persists its payment-intent mapping there
    // is intentionally no local row to join against yet. Keep the verified
    // refund event deferred; fulfillment replays it once that mapping exists.
    if (!checkout || checkout.status === "pending") return "deferred" as const;

    const existing = await tx.credit_payment_recoveries.findUnique({
      where: { external_reference: event.stripe_refund_id },
      select: { id: true },
    });
    if (existing) {
      await markStoredRefundProcessed(tx, event.id);
      return "duplicate" as const;
    }

    const prior = await tx.credit_payment_recoveries.aggregate({
      where: {
        checkout_id: checkout.id,
        recovery_kind: credit_payment_recovery_kind.stripe_refund,
        status: {
          in: [
            credit_payment_recovery_status.applied,
            credit_payment_recovery_status.review_required,
            credit_payment_recovery_status.resolved,
          ],
        },
      },
      _sum: { amount_cents: true, credit_delta: true },
    });
    const priorRefundedAmountCents = prior._sum.amount_cents ?? 0;
    const priorRevokedCredits = Math.max(0, -(prior._sum.credit_delta ?? 0));
    const paymentAmountCents = checkout.stripe_amount_total_cents;
    const canReconcile =
      paymentAmountCents !== null &&
      paymentAmountCents > 0 &&
      checkout.stripe_payment_currency?.toLowerCase() === event.currency;

    if (!canReconcile) {
      await createReviewRecovery(tx, {
        checkoutId: checkout.id,
        externalReference: event.stripe_refund_id,
        amountCents: event.amount_cents,
        currency: event.currency,
        kind: credit_payment_recovery_kind.stripe_refund,
        reason:
          "A refund could not be reconciled to the original verified payment total.",
      });
      await markStoredRefundProcessed(tx, event.id);
      return "review_required" as const;
    }

    let reconciliation;
    try {
      reconciliation = calculateCreditRefundReconciliation({
        creditAmount: checkout.credit_amount,
        paymentAmountCents: paymentAmountCents as number,
        priorRefundedAmountCents,
        priorRevokedCredits,
        refundAmountCents: event.amount_cents,
      });
    } catch {
      await createReviewRecovery(tx, {
        checkoutId: checkout.id,
        externalReference: event.stripe_refund_id,
        amountCents: event.amount_cents,
        currency: event.currency,
        kind: credit_payment_recovery_kind.stripe_refund,
        reason:
          "Refund amounts could not be reconciled safely to this credit purchase.",
      });
      await markStoredRefundProcessed(tx, event.id);
      return "review_required" as const;
    }

    const recovery = await tx.credit_payment_recoveries.create({
      data: {
        checkout_id: checkout.id,
        recovery_kind: credit_payment_recovery_kind.stripe_refund,
        status: credit_payment_recovery_status.applied,
        external_reference: event.stripe_refund_id,
        amount_cents: event.amount_cents,
        currency: event.currency,
        credit_delta: -reconciliation.creditsToRevoke,
      },
    });
    const adjustment =
      reconciliation.creditsToRevoke > 0
        ? await recordCreditAdjustmentInTransaction(tx, {
            userId: checkout.user_id,
            operationId: recovery.id,
            idempotencyKey: `stripe-refund:${event.stripe_refund_id}`,
            creditsDelta: -reconciliation.creditsToRevoke,
            sourceAmountCents: event.amount_cents,
            sourceCurrency: event.currency,
            externalReference: event.stripe_refund_id,
            entryType: "refund",
            metadata: { reason: "stripe_refund", checkoutId: checkout.id },
          })
        : null;

    const shouldRestrict = Boolean(
      adjustment && adjustment.availableCredits < 0,
    );
    await tx.credit_checkout_sessions.update({
      where: { id: checkout.id },
      data: {
        refunded_amount_cents: reconciliation.refundedAmountCents,
        refunded_at: new Date(),
        status:
          reconciliation.refundedAmountCents ===
          checkout.stripe_amount_total_cents
            ? "refunded"
            : "fulfilled",
      },
    });
    if (shouldRestrict) {
      await tx.credit_payment_recoveries.update({
        where: { id: recovery.id },
        data: { status: credit_payment_recovery_status.review_required },
      });
      await restrictCreditAccount(tx, {
        userId: checkout.user_id,
        externalReference: event.stripe_refund_id,
        reason: "A refund exceeds the available prompt-credit balance.",
      });
      await markStoredRefundProcessed(tx, event.id);
      return "review_required" as const;
    }
    await markStoredRefundProcessed(tx, event.id);
    return "applied" as const;
  });
}

async function markStoredRefundProcessed(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<void> {
  await tx.credit_stripe_refund_events.update({
    where: { id: eventId },
    data: {
      status: credit_stripe_refund_event_status.processed,
      processed_at: new Date(),
    },
  });
}

/** Disputes require an operator decision because a later outcome can restore funds. */
export async function flagStripeDisputeForReview(options: {
  eventId: string;
  eventType: string;
  dispute: Stripe.Dispute;
}): Promise<CreditPaymentRecoveryResult> {
  const paymentIntentId = stripeId(options.dispute.payment_intent);
  const currency = options.dispute.currency?.toLowerCase();
  if (
    !paymentIntentId ||
    !currency ||
    !Number.isSafeInteger(options.dispute.amount) ||
    options.dispute.amount < 0
  ) {
    return "ignored";
  }

  try {
    await prisma.credit_stripe_dispute_events.create({
      data: {
        external_event_id: options.eventId,
        event_type: options.eventType,
        stripe_dispute_id: options.dispute.id,
        stripe_payment_intent_id: paymentIntentId,
        amount_cents: options.dispute.amount,
        currency,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return "duplicate";
    }
    throw error;
  }

  return processStoredStripeDisputeEvent(options.eventId);
}

/** Replays disputes received before the Checkout event persisted its payment intent. */
export async function reconcileDeferredStripeDisputes(
  paymentIntentId: string,
): Promise<void> {
  const events = await prisma.credit_stripe_dispute_events.findMany({
    where: {
      stripe_payment_intent_id: paymentIntentId,
      // Include an older incorrectly finalized event if it has no matching
      // recovery yet. This makes the receipt self-healing after an interrupted
      // or out-of-order attempt without duplicating a real recovery.
      status: {
        in: [
          credit_stripe_dispute_event_status.deferred,
          credit_stripe_dispute_event_status.processed,
        ],
      },
    },
    select: { external_event_id: true },
  });
  for (const event of events)
    await processStoredStripeDisputeEvent(event.external_event_id);
}

async function processStoredStripeDisputeEvent(
  eventId: string,
): Promise<CreditPaymentRecoveryResult> {
  return prisma.$transaction(async (tx) => {
    const event = await tx.credit_stripe_dispute_events.findUnique({
      where: { external_event_id: eventId },
    });
    if (!event) return "ignored" as const;
    if (event.status === credit_stripe_dispute_event_status.processed) {
      const existingRecovery = await tx.credit_payment_recoveries.findUnique({
        where: { external_reference: event.stripe_dispute_id },
        select: { id: true },
      });
      if (!shouldReplayStoredDispute("processed", Boolean(existingRecovery))) {
        return "duplicate" as const;
      }
    }

    const checkout = await findCheckoutForUpdate(
      tx,
      event.stripe_payment_intent_id,
    );
    const disposition = paymentRecoveryCheckoutDisposition(
      checkout?.status ?? null,
    );
    if (disposition === "defer") return "deferred" as const;
    if (disposition === "ignore" || !checkout) {
      await tx.credit_stripe_dispute_events.update({
        where: { id: event.id },
        data: {
          status: credit_stripe_dispute_event_status.processed,
          processed_at: new Date(),
        },
      });
      return "ignored" as const;
    }

    const existing = await tx.credit_payment_recoveries.findUnique({
      where: { external_reference: event.stripe_dispute_id },
      select: { id: true },
    });
    if (!existing) {
      await createReviewRecovery(tx, {
        checkoutId: checkout.id,
        externalReference: event.stripe_dispute_id,
        amountCents: event.amount_cents,
        currency: event.currency,
        kind: credit_payment_recovery_kind.stripe_dispute,
        reason:
          "A payment dispute requires an administrator decision before chat can resume.",
      });
    }

    await tx.credit_stripe_dispute_events.update({
      where: { id: event.id },
      data: {
        status: credit_stripe_dispute_event_status.processed,
        processed_at: new Date(),
      },
    });
    return existing ? ("duplicate" as const) : ("review_required" as const);
  });
}

export async function getCreditPaymentRecoveryAdministration() {
  const recoveries = await prisma.credit_payment_recoveries.findMany({
    orderBy: { created_at: "desc" },
    take: 100,
    select: {
      id: true,
      recovery_kind: true,
      status: true,
      external_reference: true,
      amount_cents: true,
      currency: true,
      credit_delta: true,
      resolution_credit_delta: true,
      resolution_note: true,
      created_at: true,
      resolved_at: true,
      checkout: {
        select: {
          user_id: true,
          pack_id: true,
          credit_amount: true,
          user: {
            select: {
              email: true,
              public_username: true,
              credit_account: { select: { payment_restricted_at: true } },
            },
          },
        },
      },
    },
  });
  return recoveries.map((recovery) => ({
    id: recovery.id,
    kind: recovery.recovery_kind,
    status: recovery.status,
    externalReference: recovery.external_reference,
    amountCents: recovery.amount_cents,
    currency: recovery.currency,
    creditDelta: recovery.credit_delta,
    resolutionCreditDelta: recovery.resolution_credit_delta,
    resolutionNote: recovery.resolution_note,
    createdAt: recovery.created_at,
    resolvedAt: recovery.resolved_at,
    userId: recovery.checkout.user_id,
    email: recovery.checkout.user.email,
    publicUsername: recovery.checkout.user.public_username,
    paymentRestricted: Boolean(
      recovery.checkout.user.credit_account?.payment_restricted_at,
    ),
    stripeDashboardUrl:
      recovery.recovery_kind === credit_payment_recovery_kind.stripe_dispute
        ? stripeDashboardDisputeUrl(recovery.external_reference)
        : null,
    packId: recovery.checkout.pack_id,
    packCredits: recovery.checkout.credit_amount,
  }));
}

export async function resolveCreditPaymentRecovery(options: {
  recoveryId: string;
  resolvedByUserId: number;
  creditDelta: number;
  note: string;
  releaseChat: boolean;
}) {
  if (
    !Number.isSafeInteger(options.creditDelta) ||
    Math.abs(options.creditDelta) > 1_000_000
  ) {
    throw new RangeError(
      "The credit adjustment must be between -1,000,000 and 1,000,000.",
    );
  }
  const note = options.note.trim();
  if (note.length < 3 || note.length > 500) {
    throw new RangeError(
      "Provide a resolution note between 3 and 500 characters.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const recovery = await tx.credit_payment_recoveries.findUnique({
      where: { id: options.recoveryId },
      include: { checkout: { select: { user_id: true } } },
    });
    if (!recovery) throw new CreditPaymentRecoveryNotFoundError();
    if (recovery.status === credit_payment_recovery_status.resolved) {
      if (options.creditDelta !== 0) {
        throw new CreditPaymentRecoveryResolutionError(
          "A resolved payment recovery cannot receive another credit adjustment.",
        );
      }
      const currentBalance = await getLockedCreditBalanceInTransaction(
        tx,
        recovery.checkout.user_id,
      );
      const unresolved = await tx.credit_payment_recoveries.count({
        where: {
          status: credit_payment_recovery_status.review_required,
          checkout: { user_id: recovery.checkout.user_id },
        },
      });
      const chatReleased = canReleasePaymentRestrictedChat({
        releaseRequested: options.releaseChat,
        unresolvedRecoveryCount: unresolved,
        availableCredits: currentBalance.availableCredits,
      });
      if (chatReleased) {
        await clearCreditPaymentRestriction(tx, recovery.checkout.user_id);
      }
      return {
        resolved: true,
        availableCredits: currentBalance.availableCredits,
        chatReleased,
      };
    }
    if (recovery.status !== credit_payment_recovery_status.review_required) {
      throw new CreditPaymentRecoveryResolutionError(
        "This payment recovery has already been resolved.",
      );
    }

    let availableCredits: number | null = null;
    if (options.creditDelta !== 0) {
      const adjustment = await recordCreditAdjustmentInTransaction(tx, {
        userId: recovery.checkout.user_id,
        operationId: recovery.id,
        idempotencyKey: `payment-recovery-resolution:${recovery.id}`,
        creditsDelta: options.creditDelta,
        externalReference: recovery.external_reference,
        metadata: {
          reason: "payment_recovery_resolution",
          recoveryId: recovery.id,
          resolvedByUserId: options.resolvedByUserId,
          note,
        },
      });
      availableCredits = adjustment.availableCredits;
    }

    const currentBalance = await getLockedCreditBalanceInTransaction(
      tx,
      recovery.checkout.user_id,
    );
    availableCredits = currentBalance.availableCredits;

    await tx.credit_payment_recoveries.update({
      where: { id: recovery.id },
      data: {
        status: credit_payment_recovery_status.resolved,
        resolution_credit_delta: options.creditDelta,
        resolution_note: note,
        resolved_at: new Date(),
        resolved_by_user_id: options.resolvedByUserId,
      },
    });
    const unresolved = await tx.credit_payment_recoveries.count({
      where: {
        status: credit_payment_recovery_status.review_required,
        checkout: { user_id: recovery.checkout.user_id },
      },
    });
    const chatReleased = canReleasePaymentRestrictedChat({
      releaseRequested: options.releaseChat,
      unresolvedRecoveryCount: unresolved,
      availableCredits,
    });
    if (chatReleased) {
      await clearCreditPaymentRestriction(tx, recovery.checkout.user_id);
    }
    return {
      resolved: true,
      availableCredits,
      chatReleased,
    };
  });
}

async function clearCreditPaymentRestriction(
  tx: Prisma.TransactionClient,
  userId: number,
): Promise<void> {
  await tx.credit_accounts.updateMany({
    where: { user_id: userId },
    data: {
      payment_restricted_at: null,
      payment_restriction_reason: null,
      payment_restriction_reference: null,
    },
  });
}

async function findCheckoutForUpdate(
  tx: Prisma.TransactionClient,
  paymentIntentId: string,
) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT "id"::text AS "id"
    FROM "credit_checkout_sessions"
    WHERE "stripe_payment_intent_id" = ${paymentIntentId}
    FOR UPDATE
  `);
  const checkoutId = rows[0]?.id;
  return checkoutId
    ? tx.credit_checkout_sessions.findUnique({ where: { id: checkoutId } })
    : null;
}

async function createReviewRecovery(
  tx: Prisma.TransactionClient,
  options: {
    checkoutId: string;
    externalReference: string;
    amountCents: number;
    currency: string;
    kind: credit_payment_recovery_kind;
    reason: string;
  },
) {
  const recovery = await tx.credit_payment_recoveries.create({
    data: {
      checkout_id: options.checkoutId,
      recovery_kind: options.kind,
      status: credit_payment_recovery_status.review_required,
      external_reference: options.externalReference,
      amount_cents: options.amountCents,
      currency: options.currency,
    },
    include: { checkout: { select: { user_id: true } } },
  });
  await restrictCreditAccount(tx, {
    userId: recovery.checkout.user_id,
    externalReference: options.externalReference,
    reason: options.reason,
  });
  return recovery;
}

async function restrictCreditAccount(
  tx: Prisma.TransactionClient,
  options: { userId: number; externalReference: string; reason: string },
): Promise<void> {
  await tx.credit_accounts.updateMany({
    where: { user_id: options.userId, payment_restricted_at: null },
    data: {
      payment_restricted_at: new Date(),
      payment_restriction_reference: options.externalReference,
      payment_restriction_reason: options.reason,
    },
  });
}

function stripeId(
  value: string | { id: string } | null | undefined,
): string | null {
  return typeof value === "string" ? value : (value?.id ?? null);
}
