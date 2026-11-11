import "server-only";
import type { PremiumBillingInterval } from "@meadtools/premium-domain";
import prisma from "@/lib/prisma";
import { getPremiumAccessStatus } from "@/lib/db/premium-access";
import { PREMIUM_BILLING_POLICY } from "./premium-portal";
import { getStripeClient } from "./stripe";
import { premiumRenewalCanceled } from "./premium-invoice-period";
import { getPremiumPlanPriceId, areAnnualPremiumSubscriptionsAvailable } from "./premium-subscription-config";
import { verifiedPremiumSubscription, PremiumSubscriptionConflictError, PremiumSubscriptionUnavailableError } from "./stripe-premium";

const policy = PREMIUM_BILLING_POLICY;
const previousScheduleKey = "meadtools_premium_previous_schedule";

export async function schedulePremiumPlanChange(userId: number, interval: PremiumBillingInterval) {
  const stripe = getStripeClient();
  const targetPrice = getPremiumPlanPriceId(interval);
  if (!stripe || !targetPrice) {
    throw new PremiumSubscriptionUnavailableError("The selected billing interval is unavailable.");
  }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const access = await getPremiumAccessStatus(userId, new Date(), tx);
    const linked = await tx.premium_stripe_subscriptions.findUnique({ where: { user_id: userId } });
    if (!linked || !access.premiumEnabled || access.paymentRestricted) throw new PremiumSubscriptionConflictError("An active Stripe Premium subscription is required.");
    const { subscription, plan } = await verifiedPremiumSubscription(linked.subscription_id);
    if (interval === "year" && interval !== plan.interval && !areAnnualPremiumSubscriptionsAvailable()) {
      throw new PremiumSubscriptionUnavailableError("The selected billing interval is unavailable.");
    }
    if (Number(subscription.metadata.meadtools_user_id) !== userId ||
        (typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id) !== linked.customer_id ||
        subscription.status !== "active" || premiumRenewalCanceled(subscription)) {
      throw new PremiumSubscriptionConflictError("Resume the active subscription before changing its billing interval.");
    }
    const item = subscription.items.data[0];
    const creationKey = () => `premium-schedule:${subscription.id}:${item.current_period_end}${
      subscription.metadata[previousScheduleKey] ? `:${subscription.metadata[previousScheduleKey]}` : ""
    }`;
    const rememberReleasedSchedule = async (id: string) => {
      // Persist before release: a lost response or local transaction rollback
      // must not make the next change reuse the released schedule's create key.
      await stripe.subscriptions.update(subscription.id, { metadata: { [previousScheduleKey]: id } });
      subscription.metadata[previousScheduleKey] = id;
    };
    const effectiveAt = new Date(item.current_period_end * 1_000).toISOString();
    const scheduleId = typeof subscription.schedule === "string" ? subscription.schedule : subscription.schedule?.id;
    let schedule = scheduleId ? await stripe.subscriptionSchedules.retrieve(scheduleId) : null;
    if (schedule && schedule.metadata?.meadtools_premium_policy !== policy) {
      // Recover a lost create response only through our original Stripe key;
      // never adopt or release a schedule configured outside this workflow.
      try {
        const recovered = await stripe.subscriptionSchedules.create({ from_subscription: subscription.id }, {
          idempotencyKey: creationKey(),
        });
        if (recovered.id !== schedule.id) throw new Error("Schedule identity changed.");
      } catch {
        throw new PremiumSubscriptionConflictError("The subscription already has a different billing schedule.");
      }
    }
    if (interval === plan.interval) {
      if (schedule) {
        await rememberReleasedSchedule(schedule.id);
        await stripe.subscriptionSchedules.release(schedule.id);
      }
    } else {
      if (!schedule) {
        const created = await stripe.subscriptionSchedules.create({ from_subscription: subscription.id }, {
          idempotencyKey: creationKey(),
        });
        // A cached create response can still say active after release. Retrieve
        // current state, including for attempts made before generation tracking.
        schedule = await stripe.subscriptionSchedules.retrieve(created.id);
        if (schedule.status === "released" && schedule.released_subscription === subscription.id &&
            schedule.metadata?.meadtools_premium_policy === policy) {
          await rememberReleasedSchedule(schedule.id);
          const replacement = await stripe.subscriptionSchedules.create({ from_subscription: subscription.id }, {
            idempotencyKey: creationKey(),
          });
          schedule = await stripe.subscriptionSchedules.retrieve(replacement.id);
        }
      }
      if (schedule.status !== "active" || !schedule.current_phase ||
          (typeof schedule.subscription === "string" ? schedule.subscription : schedule.subscription?.id) !== subscription.id) {
        throw new PremiumSubscriptionConflictError("The subscription schedule is not active.");
      }
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: "release", proration_behavior: "none", metadata: { meadtools_premium_policy: policy },
        phases: [
          { start_date: schedule.current_phase.start_date, end_date: item.current_period_end,
            items: [{ price: plan.priceId, quantity: 1 }], proration_behavior: "none" },
          { start_date: item.current_period_end, duration: { interval, interval_count: 1 },
            items: [{ price: targetPrice, quantity: 1 }], proration_behavior: "none",
            metadata: { meadtools_user_id: String(userId) } },
        ],
      });
    }
    await tx.premium_stripe_subscriptions.update({ where: { user_id: userId }, data: { scheduled_interval: interval === plan.interval ? null : interval } });
    return { interval, effectiveAt };
  }, { timeout: 30_000 });
}
