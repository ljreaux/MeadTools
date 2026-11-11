import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { PREMIUM_MONTHLY_CHAT_CREDITS } from "@meadtools/premium-domain";
import prisma from "@/lib/prisma";
import { recordCreditGrantInTransaction } from "@/lib/db/credit-accounting";

/** Caller holds the user row lock, shared with invoice/refund/dispute processing. */
export async function deliverPremiumAllowancesInTransaction(
  tx: Prisma.TransactionClient, invoiceId: string, now: Date,
): Promise<number> {
  const invoice = await tx.premium_stripe_invoices.findUniqueOrThrow({
    where: { invoice_id: invoiceId },
    include: { user: { select: {
      active: true, credit_account: { select: { payment_restricted_at: true } },
      premium_memberships: { where: { source: "stripe" }, select: { external_reference: true, revoked_at: true } },
    } } },
  });
  if (invoice.billing_interval !== "year" || invoice.allowances_stopped_at ||
      invoice.refunded_amount_cents > 0 || !invoice.user.active ||
      invoice.user.credit_account?.payment_restricted_at) return 0;
  if (invoice.user.premium_memberships.some((membership) =>
    membership.external_reference === invoice.subscription_id && membership.revoked_at &&
    membership.revoked_at < invoice.paid_through,
  )) {
    await tx.premium_stripe_invoices.update({ where: { invoice_id: invoiceId }, data: { allowances_stopped_at: now } });
    return 0;
  }
  const due = await tx.premium_stripe_allowances.findMany({
    where: { invoice_id: invoiceId, granted_at: null, due_at: { lte: now } },
    orderBy: { allowance_index: "asc" }, take: 12,
  });
  for (const allowance of due) {
    const key = `stripe-premium:${invoiceId}:month:${allowance.allowance_index}`;
    const hex = createHash("sha256").update(key).digest("hex").slice(0, 32);
    const operationId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    await recordCreditGrantInTransaction(tx, {
      userId: invoice.user_id, operationId, idempotencyKey: key,
      creditAmount: PREMIUM_MONTHLY_CHAT_CREDITS,
      metadata: { source: "stripe-premium", invoiceId, allowanceIndex: allowance.allowance_index }, now,
    });
    await tx.premium_stripe_allowances.update({
      where: { invoice_id_allowance_index: { invoice_id: invoiceId, allowance_index: allowance.allowance_index } },
      data: { granted_at: now },
    });
  }
  if (due.length) await tx.premium_stripe_invoices.update({
    where: { invoice_id: invoiceId },
    data: { granted_credits: { increment: due.length * PREMIUM_MONTHLY_CHAT_CREDITS } },
  });
  return due.length;
}

/** Bounded work; each account is re-read under its billing lock before delivery. */
export async function deliverDuePremiumAllowances(options: { now?: Date; limit?: number } = {}) {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 100;
  if (!Number.isFinite(now.getTime()) || !Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new RangeError("Invalid allowance delivery options.");
  }
  const candidates = await prisma.premium_stripe_invoices.findMany({
    where: {
      billing_interval: "year", allowances_stopped_at: null, refunded_amount_cents: 0,
      user: { active: true, OR: [{ credit_account: null }, { credit_account: { payment_restricted_at: null } }] },
      allowances: { some: { granted_at: null, due_at: { lte: now } } },
    },
    select: { invoice_id: true, user_id: true }, orderBy: { paid_at: "asc" }, take: limit,
  });
  let grants = 0;
  for (const invoice of candidates) {
    grants += await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${invoice.user_id} FOR UPDATE`;
      return deliverPremiumAllowancesInTransaction(tx, invoice.invoice_id, now);
    }, { timeout: 30_000 });
  }
  return { invoices: candidates.length, grants };
}
