/** The initial premium bundle is priced for a later launch. */
export const PREMIUM_MONTHLY_PRICE_CENTS = 500;
export const PREMIUM_MONTHLY_CHAT_CREDITS = 1_000;
export {
  kofiPaymentIsPremiumEligible,
  parseKofiSubscriptionPayment,
  type KofiSubscriptionPayment,
} from "./kofi";

export type PremiumMembership = {
  source: "kofi" | "stripe" | "manual";
  paidThrough: Date;
  revokedAt: Date | null;
};

export type PremiumAccess = {
  entitled: boolean;
  source: PremiumMembership["source"] | null;
  paidThrough: Date | null;
};

/** All clients use the same time-bound account entitlement decision. */
export function resolvePremiumAccess(
  memberships: readonly PremiumMembership[],
  now: Date,
): PremiumAccess {
  const active = memberships
    .filter(
      (membership) =>
        membership.revokedAt === null && membership.paidThrough > now,
    )
    .sort((a, b) => b.paidThrough.getTime() - a.paidThrough.getTime())[0];
  return active
    ? { entitled: true, source: active.source, paidThrough: active.paidThrough }
    : { entitled: false, source: null, paidThrough: null };
}

/** Ko-fi only reports payments, so access expires without a later renewal. */
export function kofiPaidThrough(paidAt: Date): Date {
  if (!Number.isFinite(paidAt.getTime())) {
    throw new RangeError("Ko-fi payment time is invalid.");
  }
  // Renewals can be delayed by weekends or retry windows. This short grace
  // period never replaces a cancellation/reconciliation check.
  return new Date(paidAt.getTime() + 35 * 24 * 60 * 60 * 1_000);
}
