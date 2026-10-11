import "server-only";

import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { PREMIUM_MONTHLY_CHAT_CREDITS } from "@meadtools/premium-domain";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPremiumAccessStatus } from "@/lib/db/premium-access";
import { recordCreditGrantInTransaction } from "@/lib/db/credit-accounting";
import { getStripeClient } from "./stripe";
import { buildPremiumCheckoutSessionParams } from "./premium-checkout-session";
import {
  arePremiumSubscriptionsAvailable,
  getPremiumStripePriceId,
  PREMIUM_STRIPE_MINIMUM_PAID_CENTS,
} from "./premium-subscription-config";

export class PremiumSubscriptionUnavailableError extends Error {}
export class PremiumSubscriptionConflictError extends Error {}
export class PremiumStripeVerificationError extends Error {}

function stripeId(value: string | { id: string } | null | undefined): string | null {
  return typeof value === "string" ? value : value?.id ?? null;
}

function userIdFromSubscription(subscription: Stripe.Subscription): number {
  const raw = subscription.metadata?.meadtools_user_id;
  const userId = Number(raw);
  if (!raw || !Number.isSafeInteger(userId) || userId < 1) {
    throw new PremiumStripeVerificationError("Subscription account metadata is invalid.");
  }
  return userId;
}

function premiumItem(subscription: Stripe.Subscription, priceId: string) {
  return subscription.items.data.find((item) =>
    item.price.id === priceId &&
    item.price.currency === "usd" &&
    item.price.unit_amount === PREMIUM_STRIPE_MINIMUM_PAID_CENTS &&
    item.price.recurring?.interval === "month",
  );
}

function allowanceOperation(invoiceId: string) {
  const hex = createHash("sha256").update(`stripe-premium:${invoiceId}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Creates only a sandbox/local checkout until the rollout switch is enabled. */
export async function createPremiumStripeCheckout(options: {
  userId: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripeClient();
  const priceId = getPremiumStripePriceId();
  if (!stripe || !priceId || !arePremiumSubscriptionsAvailable()) {
    throw new PremiumSubscriptionUnavailableError("Premium subscriptions are unavailable.");
  }
  const access = await getPremiumAccessStatus(options.userId);
  if (!access.activeUser || access.paymentRestricted) {
    throw new PremiumSubscriptionUnavailableError("This account cannot subscribe.");
  }
  if (access.premiumEnabled) {
    throw new PremiumSubscriptionConflictError("Premium is already active on this account.");
  }
  const [user, existing] = await Promise.all([
    prisma.users.findUnique({ where: { id: options.userId }, select: { email: true } }),
    prisma.premium_stripe_subscriptions.findUnique({ where: { user_id: options.userId } }),
  ]);
  if (existing && ["active", "trialing", "past_due"].includes(existing.status)) {
    throw new PremiumSubscriptionConflictError("A Stripe subscription already exists.");
  }
  const session = await stripe.checkout.sessions.create(
    buildPremiumCheckoutSessionParams({
      userId: options.userId,
      priceId,
      customerId: existing?.customer_id,
      email: user?.email ?? undefined,
      successUrl: options.successUrl,
      cancelUrl: options.cancelUrl,
    }),
  );
  if (!session.url) throw new PremiumSubscriptionUnavailableError("Stripe Checkout is unavailable.");
  return { url: session.url };
}

export async function createPremiumStripePortal(options: {
  userId: number;
  returnUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripeClient();
  const linked = await prisma.premium_stripe_subscriptions.findUnique({
    where: { user_id: options.userId },
  });
  if (!stripe || !linked) {
    throw new PremiumSubscriptionUnavailableError("Stripe billing is unavailable.");
  }
  const session = await stripe.billingPortal.sessions.create({
    customer: linked.customer_id,
    return_url: options.returnUrl,
    ...(process.env.STRIPE_PREMIUM_PORTAL_CONFIG_ID
      ? { configuration: process.env.STRIPE_PREMIUM_PORTAL_CONFIG_ID }
      : {}),
  });
  return { url: session.url };
}

async function verifiedSubscription(subscriptionId: string): Promise<{
  subscription: Stripe.Subscription;
  userId: number;
  customerId: string;
  paidThrough: Date;
}> {
  const stripe = getStripeClient();
  const priceId = getPremiumStripePriceId();
  if (!stripe || !priceId) throw new PremiumSubscriptionUnavailableError("Stripe premium is unavailable.");
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = premiumItem(subscription, priceId);
  const customerId = stripeId(subscription.customer);
  if (!item || !customerId || subscription.items.data.length !== 1) {
    throw new PremiumStripeVerificationError("Subscription price or customer did not match.");
  }
  return {
    subscription,
    userId: userIdFromSubscription(subscription),
    customerId,
    paidThrough: new Date(item.current_period_end * 1_000),
  };
}

async function upsertStripeIdentity(
  tx: Prisma.TransactionClient,
  options: { userId: number; customerId: string; subscriptionId: string; status: string; cancelAtPeriodEnd: boolean },
) {
  const existing = await tx.premium_stripe_subscriptions.findUnique({
    where: { user_id: options.userId },
  });
  if (existing && existing.subscription_id !== options.subscriptionId &&
      !["canceled", "incomplete_expired"].includes(existing.status)) {
    throw new PremiumSubscriptionConflictError("A different Stripe subscription is linked.");
  }
  await tx.premium_stripe_subscriptions.upsert({
    where: { user_id: options.userId },
    create: {
      user_id: options.userId,
      customer_id: options.customerId,
      subscription_id: options.subscriptionId,
      status: options.status,
      cancel_at_period_end: options.cancelAtPeriodEnd,
    },
    update: {
      customer_id: options.customerId,
      subscription_id: options.subscriptionId,
      status: options.status,
      cancel_at_period_end: options.cancelAtPeriodEnd,
    },
  });
}

async function processPaidInvoice(invoice: Stripe.Invoice): Promise<void> {
  if (invoice.status !== "paid" || invoice.currency !== "usd" ||
      invoice.amount_paid < PREMIUM_STRIPE_MINIMUM_PAID_CENTS ||
      !["subscription_create", "subscription_cycle"].includes(invoice.billing_reason ?? "")) return;
  if (!invoice.parent?.subscription_details?.metadata?.meadtools_user_id) return;
  const subscriptionId = stripeId(invoice.parent?.subscription_details?.subscription);
  if (!subscriptionId) return;
  const { subscription, userId, customerId, paidThrough } = await verifiedSubscription(subscriptionId);
  if (!["active", "trialing"].includes(subscription.status)) return;
  if (stripeId(invoice.customer) !== customerId) {
    throw new PremiumStripeVerificationError("Invoice customer did not match.");
  }
  const paidAtSeconds = invoice.status_transitions?.paid_at ?? invoice.created;
  const paidAt = new Date(paidAtSeconds * 1_000);
  await prisma.$transaction(async (tx) => {
    const inserted = await tx.premium_stripe_invoices.createMany({
      data: {
        invoice_id: invoice.id,
        user_id: userId,
        subscription_id: subscription.id,
        paid_at: paidAt,
        paid_through: paidThrough,
        amount_paid_cents: invoice.amount_paid,
      },
      skipDuplicates: true,
    });
    if (inserted.count === 0) return;
    await upsertStripeIdentity(tx, {
      userId, customerId, subscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });
    const current = await tx.premium_memberships.findUnique({
      where: { user_id_source: { user_id: userId, source: "stripe" } },
    });
    if (current?.external_reference && current.external_reference !== subscription.id &&
        current.revoked_at === null && current.paid_through > paidAt) {
      throw new PremiumSubscriptionConflictError("A different premium subscription is active.");
    }
    await tx.premium_memberships.upsert({
      where: { user_id_source: { user_id: userId, source: "stripe" } },
      create: {
        user_id: userId, source: "stripe", external_reference: subscription.id,
        paid_through: paidThrough,
      },
      update: {
        external_reference: subscription.id,
        paid_through: current && current.paid_through > paidThrough ? current.paid_through : paidThrough,
        revoked_at: null,
      },
    });
    await recordCreditGrantInTransaction(tx, {
      userId,
      operationId: allowanceOperation(invoice.id),
      idempotencyKey: `stripe-premium:${invoice.id}`,
      creditAmount: PREMIUM_MONTHLY_CHAT_CREDITS,
      metadata: { source: "stripe-premium", invoiceId: invoice.id },
      now: paidAt,
    });
  });
}

async function processCheckout(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "subscription" || session.payment_status !== "paid" ||
      !session.metadata?.premium_user_id) return;
  const subscriptionId = stripeId(session.subscription);
  if (!subscriptionId) return;
  const { subscription, userId, customerId } = await verifiedSubscription(subscriptionId);
  if (session.client_reference_id !== String(userId) ||
      session.metadata?.premium_user_id !== String(userId) ||
      stripeId(session.customer) !== customerId) {
    throw new PremiumStripeVerificationError("Checkout account did not match.");
  }
  await prisma.$transaction((tx) => upsertStripeIdentity(tx, {
    userId, customerId, subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  }));
}

async function processSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  const linked = await prisma.premium_stripe_subscriptions.findUnique({
    where: { subscription_id: subscription.id },
  });
  if (!linked || userIdFromSubscription(subscription) !== linked.user_id) return;
  const shouldRevoke = ["canceled", "unpaid", "incomplete_expired"].includes(subscription.status);
  await prisma.$transaction(async (tx) => {
    await tx.premium_stripe_subscriptions.update({
      where: { user_id: linked.user_id },
      data: {
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
    });
    if (shouldRevoke) {
      await tx.premium_memberships.updateMany({
        where: { user_id: linked.user_id, source: "stripe", external_reference: subscription.id },
        data: { revoked_at: new Date() },
      });
    }
  });
}

/** Called only after the route verifies Stripe's raw webhook signature. */
export async function handlePremiumStripeEvent(event: Stripe.Event): Promise<boolean> {
  switch (event.type) {
    case "invoice.paid":
      await processPaidInvoice(event.data.object as Stripe.Invoice);
      return true;
    case "checkout.session.completed":
      if ((event.data.object as Stripe.Checkout.Session).mode !== "subscription") return false;
      await processCheckout(event.data.object as Stripe.Checkout.Session);
      return true;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await processSubscriptionChange(event.data.object as Stripe.Subscription);
      return true;
    default:
      return false;
  }
}
