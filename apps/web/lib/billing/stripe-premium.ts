import "server-only";

import { createHash, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import { PREMIUM_MONTHLY_CHAT_CREDITS, premiumAllowanceSchedule, type PremiumBillingInterval } from "@meadtools/premium-domain";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getPremiumAccessStatus } from "@/lib/db/premium-access";
import { recordCreditGrantInTransaction } from "@/lib/db/credit-accounting";
import { getStripeClient } from "./stripe";
import { reconcileDeferredStripeDisputes, reconcileDeferredStripeRefunds } from "./credit-payment-recovery";
import { resumePremiumCheckout, PremiumCheckoutStateError, type CheckoutAttempt } from "./premium-checkout-reservation";
import { premiumInvoiceServicePeriod, laterPaidThrough, currentSubscriptionState, premiumRenewalCanceled } from "./premium-invoice-period";
import { deliverPremiumAllowancesInTransaction } from "./premium-allowances";
import { premiumPortalConfiguration } from "./premium-portal";
import { buildPremiumCheckoutSessionParams } from "./premium-checkout-session";
import {
  arePremiumSubscriptionsAvailable,
  areAnnualPremiumSubscriptionsAvailable,
  getPremiumPlanPriceId,
  premiumPlanForPriceId,
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

function premiumItem(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const plan = item && premiumPlanForPriceId(item.price.id);
  if (!plan || subscription.items.data.length !== 1 || item.quantity !== 1 ||
      item.price.currency !== "usd" || item.price.unit_amount !== plan.priceCents ||
      item.price.recurring?.interval !== plan.interval || item.price.recurring.interval_count !== 1) return null;
  return { item, plan };
}

function allowanceOperation(invoiceId: string) {
  const hex = createHash("sha256").update(`stripe-premium:${invoiceId}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Creates only a sandbox/local checkout until the rollout switch is enabled. */
export async function createPremiumStripeCheckout(options: {
  userId: number;
  interval?: PremiumBillingInterval;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string }> {
  const stripe = getStripeClient();
  const interval = options.interval ?? "month";
  const priceId = getPremiumPlanPriceId(interval);
  if (!stripe || !priceId || !arePremiumSubscriptionsAvailable() ||
      (interval === "year" && !areAnnualPremiumSubscriptionsAvailable())) {
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
  if (existing && !["canceled", "incomplete_expired"].includes(existing.status)) {
    throw new PremiumSubscriptionConflictError("A Stripe subscription already exists.");
  }
  const newAttempt = () => ({
    attempt_id: randomUUID(),
    params: { ...buildPremiumCheckoutSessionParams({
      userId: options.userId, priceId, customerId: existing?.customer_id,
      email: user?.email ?? undefined, successUrl: options.successUrl, cancelUrl: options.cancelUrl,
    }), expires_at: Math.floor(Date.now() / 1_000) + 60 * 60 } as unknown as Prisma.InputJsonValue,
    session_id: null,
    created_at: new Date(),
  });
  try {
    return await resumePremiumCheckout({
      requestedPriceId: priceId,
      expire: (id) => stripe.checkout.sessions.expire(id),
      reserve: async () => {
        // createMany ON CONFLICT handles simultaneous first requests; the winner's
        // exact params (including random integration identifier) are always reused.
        await prisma.premium_stripe_checkouts.createMany({
          data: { user_id: options.userId, ...newAttempt() }, skipDuplicates: true,
        });
        const attempt = await prisma.premium_stripe_checkouts.findUniqueOrThrow({ where: { user_id: options.userId } });
        return { ...attempt, params: attempt.params as unknown as CheckoutAttempt["params"] };
      },
      replace: async (attemptId) => {
        await prisma.premium_stripe_checkouts.updateMany({
          where: { user_id: options.userId, attempt_id: attemptId }, data: newAttempt(),
        });
      },
      save: async (attemptId, sessionId) => {
        await prisma.premium_stripe_checkouts.updateMany({
          where: { user_id: options.userId, attempt_id: attemptId }, data: { session_id: sessionId },
        });
      },
      create: (params, idempotencyKey) => stripe.checkout.sessions.create(params, { idempotencyKey }),
      retrieve: (id) => stripe.checkout.sessions.retrieve(id),
      completedSubscriptionCanBeReplaced: async (id) => {
        const subscription = await stripe.subscriptions.retrieve(id);
        if (userIdFromSubscription(subscription) !== options.userId) {
          throw new PremiumStripeVerificationError("Checkout subscription account did not match.");
        }
        return ["canceled", "incomplete_expired"].includes(subscription.status);
      },
    });
  } catch (error) {
    if (error instanceof PremiumCheckoutStateError) {
      if (error.kind === "conflict") throw new PremiumSubscriptionConflictError(error.message);
      throw new PremiumSubscriptionUnavailableError(error.message);
    }
    throw error;
  }
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
  const configuration = await premiumPortalConfiguration(stripe);
  const session = await stripe.billingPortal.sessions.create({
    customer: linked.customer_id,
    return_url: options.returnUrl,
    configuration,
  });
  return { url: session.url };
}

export async function verifiedPremiumSubscription(subscriptionId: string): Promise<{
  subscription: Stripe.Subscription;
  userId: number;
  customerId: string;
  plan: NonNullable<ReturnType<typeof premiumPlanForPriceId>>;
}> {
  const stripe = getStripeClient();
  if (!stripe) throw new PremiumSubscriptionUnavailableError("Stripe premium is unavailable.");
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = premiumItem(subscription);
  const customerId = stripeId(subscription.customer);
  if (!item || !customerId || subscription.items.data.length !== 1) {
    throw new PremiumStripeVerificationError("Subscription price or customer did not match.");
  }
  return {
    subscription,
    userId: userIdFromSubscription(subscription),
    customerId,
    plan: item.plan,
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
      invoice.amount_paid < 500 ||
      !["subscription_create", "subscription_cycle"].includes(invoice.billing_reason ?? "")) return;
  if (!invoice.parent?.subscription_details?.metadata?.meadtools_user_id) return;
  const subscriptionId = stripeId(invoice.parent?.subscription_details?.subscription);
  if (!subscriptionId) return;
  const { userId } = await verifiedPremiumSubscription(subscriptionId);
  const stripe = getStripeClient()!;
  const payments = await stripe.invoicePayments.list({ invoice: invoice.id, status: "paid", limit: 100 });
  if (payments.has_more) throw new PremiumStripeVerificationError("Invoice payment list is incomplete.");
  const paymentIds = payments.data.flatMap((payment) => {
    const paymentId = stripeId(payment.payment.payment_intent);
    return payment.payment.type === "payment_intent" && paymentId ? [paymentId] : [];
  });
  const paidAtSeconds = invoice.status_transitions?.paid_at ?? invoice.created;
  const paidAt = new Date(paidAtSeconds * 1_000);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const { subscription, customerId, userId: currentUserId, plan: currentPlan } = await verifiedPremiumSubscription(subscriptionId);
    if (currentUserId !== userId) throw new PremiumStripeVerificationError("Subscription owner changed.");
    // Historical paid invoices are valid even if the current renewal is past due.
    // Terminal subscriptions must not be revived by a delayed invoice event.
    if (["canceled", "unpaid", "incomplete_expired"].includes(subscription.status)) return;
    const recurringLines = invoice.lines.data.filter((line) => {
      const details = line.parent?.subscription_item_details;
      const priceId = stripeId(line.pricing?.price_details?.price);
      return line.parent?.type === "subscription_item_details" &&
        details?.subscription_item === subscription.items.data[0].id &&
        details.subscription === subscription.id && !details.proration &&
        priceId && premiumPlanForPriceId(priceId);
    });
    const invoicePrice = recurringLines.length === 1 ? recurringLines[0].pricing?.price_details?.price : null;
    const plan = invoicePrice && premiumPlanForPriceId(stripeId(invoicePrice)!);
    if (!plan || invoice.amount_paid < plan.priceCents) throw new PremiumStripeVerificationError("Invoice plan or paid amount did not match.");
    const period = premiumInvoiceServicePeriod(invoice, subscription, plan.priceId, plan.priceCents);
    const paidThrough = period.end;
    const inserted = await tx.premium_stripe_invoices.createMany({
      data: {
        invoice_id: invoice.id,
        user_id: userId,
        subscription_id: subscription.id,
        paid_at: paidAt,
        paid_through: paidThrough,
        amount_paid_cents: invoice.amount_paid,
        billing_interval: plan.interval,
        granted_credits: plan.interval === "year" ? 0 : PREMIUM_MONTHLY_CHAT_CREDITS,
      },
      skipDuplicates: true,
    });
    if (paymentIds.length) await tx.premium_stripe_payments.createMany({
      data: paymentIds.map((paymentId) => ({ payment_intent_id: paymentId, invoice_id: invoice.id })),
      skipDuplicates: true,
    });
    if (inserted.count === 0) return;
    if (currentPlan.interval === plan.interval) await tx.premium_stripe_subscriptions.updateMany({
      where: { user_id: userId, scheduled_interval: plan.interval }, data: { scheduled_interval: null },
    });
    await upsertStripeIdentity(tx, {
      userId, customerId, subscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: premiumRenewalCanceled(subscription),
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
        paid_through: laterPaidThrough(current?.paid_through, paidThrough),
        revoked_at: null,
      },
    });
    if (plan.interval === "year") {
      const schedule = premiumAllowanceSchedule({ interval: "year", periodStart: period.start, periodEnd: period.end });
      await tx.premium_stripe_allowances.createMany({ data: schedule.map((allowance) => ({
        invoice_id: invoice.id, allowance_index: allowance.index, due_at: allowance.dueAt,
      })), skipDuplicates: true });
      await deliverPremiumAllowancesInTransaction(tx, invoice.id, new Date());
    } else await recordCreditGrantInTransaction(tx, {
      userId,
      operationId: allowanceOperation(invoice.id),
      idempotencyKey: `stripe-premium:${invoice.id}`,
      creditAmount: PREMIUM_MONTHLY_CHAT_CREDITS,
      metadata: { source: "stripe-premium", invoiceId: invoice.id },
      now: paidAt,
    });
  }, { timeout: 30_000 });
  for (const paymentId of paymentIds) {
    await reconcileDeferredStripeRefunds(paymentId);
    await reconcileDeferredStripeDisputes(paymentId);
  }
}

async function processCheckout(session: Stripe.Checkout.Session): Promise<void> {
  if (session.mode !== "subscription" || session.payment_status !== "paid" ||
      !session.metadata?.premium_user_id) return;
  const subscriptionId = stripeId(session.subscription);
  if (!subscriptionId) return;
  const { subscription, userId, customerId } = await verifiedPremiumSubscription(subscriptionId);
  if (session.client_reference_id !== String(userId) ||
      session.metadata?.premium_user_id !== String(userId) ||
      stripeId(session.customer) !== customerId) {
    throw new PremiumStripeVerificationError("Checkout account did not match.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const current = await verifiedPremiumSubscription(subscriptionId);
    if (current.userId !== userId || current.customerId !== customerId) {
      throw new PremiumStripeVerificationError("Checkout account changed.");
    }
    if (["canceled", "incomplete_expired"].includes(current.subscription.status)) return;
    await upsertStripeIdentity(tx, {
      userId, customerId, subscriptionId: subscription.id,
      status: current.subscription.status,
      cancelAtPeriodEnd: premiumRenewalCanceled(current.subscription),
    });
  }, { timeout: 30_000 });
}

async function processSubscriptionChange(subscription: Stripe.Subscription): Promise<void> {
  const linked = await prisma.premium_stripe_subscriptions.findUnique({
    where: { subscription_id: subscription.id },
  });
  if (!linked || userIdFromSubscription(subscription) !== linked.user_id) return;
  const stripe = getStripeClient();
  if (!stripe) throw new PremiumSubscriptionUnavailableError("Stripe premium is unavailable.");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${linked.user_id} FOR UPDATE`;
    const currentLink = await tx.premium_stripe_subscriptions.findUnique({ where: { user_id: linked.user_id } });
    if (currentLink?.subscription_id !== subscription.id) return;
    const current = await currentSubscriptionState(subscription.id, (id) => stripe.subscriptions.retrieve(id));
    if (userIdFromSubscription(current.subscription) !== linked.user_id || stripeId(current.subscription.customer) !== currentLink.customer_id) {
      throw new PremiumStripeVerificationError("Subscription account did not match.");
    }
    await tx.premium_stripe_subscriptions.update({
      where: { user_id: linked.user_id },
      data: { status: current.subscription.status, cancel_at_period_end: premiumRenewalCanceled(current.subscription) },
    });
    if (current.shouldRevoke) {
      const now = new Date();
      await tx.premium_stripe_invoices.updateMany({
        where: { subscription_id: subscription.id, billing_interval: "year", paid_through: { gt: now } },
        data: { allowances_stopped_at: now },
      });
      await tx.premium_memberships.updateMany({
        where: { user_id: linked.user_id, source: "stripe", external_reference: subscription.id },
        data: { revoked_at: new Date() },
      });
    }
  }, { timeout: 30_000 });
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
