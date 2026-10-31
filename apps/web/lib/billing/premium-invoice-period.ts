import type Stripe from "stripe";

const id = (value: string | { id: string } | null | undefined) => typeof value === "string" ? value : value?.id;

export function premiumInvoicePaidThrough(
  invoice: Stripe.Invoice,
  subscription: Stripe.Subscription,
  priceId: string,
  minimumCents: number,
): Date {
  const item = subscription.items.data.find((entry) => entry.price.id === priceId);
  if (!item || id(invoice.customer) !== id(subscription.customer) ||
      id(invoice.parent?.subscription_details?.subscription) !== subscription.id ||
      invoice.parent?.subscription_details?.metadata?.meadtools_user_id !== subscription.metadata.meadtools_user_id ||
      invoice.lines.has_more) {
    throw new Error("Invoice subscription ownership or line list did not match.");
  }
  const matching = invoice.lines.data.filter((line) => {
    const details = line.parent?.subscription_item_details;
    return line.parent?.type === "subscription_item_details" && details?.subscription_item === item.id &&
      details.subscription === subscription.id && !details.proration &&
      id(line.pricing?.price_details?.price) === priceId && line.currency === "usd" &&
      line.amount >= minimumCents && line.quantity === 1;
  });
  if (matching.length !== 1) throw new Error("Invoice must contain one paid premium recurring line.");
  const { start, end } = matching[0].period;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start <= 0 || end <= start ||
      !Number.isFinite(new Date(end * 1_000).getTime())) throw new Error("Invalid invoice service period.");
  return new Date(end * 1_000);
}

export function laterPaidThrough(current: Date | undefined, incoming: Date): Date {
  return current && current > incoming ? current : incoming;
}

/** Event snapshots can be delayed; retrieve inside the caller's serialized update. */
export async function currentSubscriptionState(
  subscriptionId: string,
  retrieve: (id: string) => Promise<Stripe.Subscription>,
) {
  const subscription = await retrieve(subscriptionId);
  return {
    subscription,
    shouldRevoke: ["canceled", "unpaid", "incomplete_expired"].includes(subscription.status),
  };
}
