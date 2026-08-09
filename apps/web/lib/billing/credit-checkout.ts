import "server-only";

import { creditPackForId } from "@meadtools/credit-accounting";
import type Stripe from "stripe";
import prisma from "@/lib/prisma";
import {
  CreditPaymentRestrictedError,
  getCreditBalance,
  recordCreditPurchaseInTransaction
} from "@/lib/db/credit-accounting";
import { getStripeClient } from "./stripe";
import { buildCreditCheckoutSessionParams } from "./credit-checkout-session";
import { isPaidCreditCheckoutEvent } from "./credit-checkout-events";
import { reconcileDeferredStripeDisputes } from "./credit-payment-recovery";
import { stripeSessionMatchesCreditCheckout } from "./credit-checkout-verification";

export class CreditCheckoutUnavailableError extends Error {
  constructor() {
    super("Credit purchases are not configured yet.");
    this.name = "CreditCheckoutUnavailableError";
  }
}

export class UnknownCreditPackError extends Error {
  constructor() {
    super("That credit pack is not available.");
    this.name = "UnknownCreditPackError";
  }
}

export class CreditCheckoutVerificationError extends Error {
  constructor() {
    super("The checkout session could not be verified.");
    this.name = "CreditCheckoutVerificationError";
  }
}

export async function createCreditCheckout(options: {
  userId: number;
  packId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripeClient();
  if (!stripe) throw new CreditCheckoutUnavailableError();
  const balance = await getCreditBalance(options.userId);
  if (balance.paymentRestricted) throw new CreditPaymentRestrictedError();

  const pack = creditPackForId(options.packId);
  if (!pack) throw new UnknownCreditPackError();

  const checkout = await prisma.credit_checkout_sessions.create({
    data: {
      user_id: options.userId,
      pack_id: pack.id,
      credit_amount: pack.credits,
      amount_cents: pack.amountCents,
      currency: "usd"
    }
  });

  try {
    const session = await stripe.checkout.sessions.create(
      buildCreditCheckoutSessionParams({
        checkoutId: checkout.id,
        pack,
        successUrl: options.successUrl,
        cancelUrl: options.cancelUrl,
        userId: options.userId
      }),
      { idempotencyKey: `credit-checkout:${checkout.id}` }
    );

    if (!session.url) throw new CreditCheckoutUnavailableError();
    await prisma.credit_checkout_sessions.update({
      where: { id: checkout.id },
      data: { stripe_checkout_session_id: session.id }
    });
    return { url: session.url };
  } catch (error) {
    await prisma.credit_checkout_sessions.update({
      where: { id: checkout.id },
      data: { status: "failed" }
    }).catch(() => undefined);
    throw error;
  }
}

/**
 * Credits a completed Stripe Checkout exactly once. It runs only after the
 * route has verified Stripe's raw webhook signature.
 */
export async function fulfillCreditCheckoutFromStripeEvent(
  event: Stripe.Event
): Promise<"fulfilled" | "duplicate" | "ignored"> {
  if (!isPaidCreditCheckoutEvent(event.type)) return "ignored";

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "payment" || session.payment_status !== "paid") return "ignored";

  const checkoutId = session.metadata?.credit_checkout_id;
  if (!checkoutId || !isUuid(checkoutId)) throw new CreditCheckoutVerificationError();

  const result = await prisma.$transaction(async (tx) => {
    const inserted = await tx.credit_payment_webhook_events.createMany({
      data: {
        provider: "stripe",
        external_event_id: event.id,
        event_type: event.type
      },
      skipDuplicates: true
    });
    if (inserted.count === 0) return "duplicate" as const;

    const checkout = await tx.credit_checkout_sessions.findUnique({ where: { id: checkoutId } });
    if (!checkout || !stripeSessionMatchesCreditCheckout(session, checkout)) {
      throw new CreditCheckoutVerificationError();
    }
    if (checkout.status === "fulfilled") return "ignored" as const;

    await recordCreditPurchaseInTransaction(tx, {
      userId: checkout.user_id,
      operationId: checkout.id,
      idempotencyKey: `stripe-checkout:${session.id}`,
      creditAmount: checkout.credit_amount,
      sourceAmountCents: checkout.amount_cents,
      sourceCurrency: checkout.currency,
      externalReference: session.id,
      metadata: { packId: checkout.pack_id }
    });

    await tx.credit_checkout_sessions.update({
      where: { id: checkout.id },
      data: {
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: stripeId(session.payment_intent),
        stripe_amount_total_cents: session.amount_total,
        stripe_payment_currency: session.currency?.toLowerCase() ?? checkout.currency,
        status: "fulfilled",
        fulfilled_at: new Date()
      }
    });
    return "fulfilled" as const;
  });
  const paymentIntentId = stripeId(session.payment_intent);
  if (paymentIntentId) await reconcileDeferredStripeDisputes(paymentIntentId);
  return result;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function stripeId(value: string | { id: string } | null): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}
