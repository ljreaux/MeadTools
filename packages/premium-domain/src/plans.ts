export const PREMIUM_MONTHLY_PRICE_CENTS = 500;
export const PREMIUM_ANNUAL_PRICE_CENTS = 5_000;
export const PREMIUM_MONTHLY_CHAT_CREDITS = 1_000;

export type PremiumBillingInterval = "month" | "year";

export const PREMIUM_PLANS = {
  month: { priceCents: PREMIUM_MONTHLY_PRICE_CENTS, allowanceMonths: 1 },
  year: { priceCents: PREMIUM_ANNUAL_PRICE_CENTS, allowanceMonths: 12 },
} as const satisfies Record<PremiumBillingInterval, { priceCents: number; allowanceMonths: number }>;

export type PremiumAllowance = {
  /** Zero-based within the paid invoice; stable across retries and catch-up. */
  index: number;
  dueAt: Date;
  credits: number;
};

/** Preserve the original UTC day/time; clamp short months without cumulative drift. */
function anniversary(start: Date, offset: number): Date {
  const next = new Date(start);
  next.setUTCDate(1);
  next.setUTCMonth(start.getUTCMonth() + offset);
  const lastDay = new Date(next);
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
  next.setUTCDate(Math.min(start.getUTCDate(), lastDay.getUTCDate()));
  return next;
}

/**
 * Build allowances from a verified paid service period, never webhook receipt time.
 * The caller persists these alongside the invoice and grants each index once.
 * This does not change credit expiry or the account's renewal/cancellation policy.
 */
export function premiumAllowanceSchedule(options: {
  interval: PremiumBillingInterval;
  periodStart: Date;
  periodEnd: Date;
}): PremiumAllowance[] {
  const { interval, periodStart, periodEnd } = options;
  if (!Object.hasOwn(PREMIUM_PLANS, interval) ||
      !Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) ||
      periodEnd <= periodStart) {
    throw new RangeError("Invalid premium paid service period.");
  }
  const schedule = Array.from({ length: PREMIUM_PLANS[interval].allowanceMonths }, (_, index) => ({
    index,
    dueAt: anniversary(periodStart, index),
    credits: PREMIUM_MONTHLY_CHAT_CREDITS,
  }));
  if (schedule.some(({ dueAt }) => !Number.isFinite(dueAt.getTime()) || dueAt >= periodEnd)) {
    throw new RangeError("Paid service period does not cover the premium allowances.");
  }
  return schedule;
}

/**
 * Include missed allowances even after the paid period ends: they were paid for.
 * Refund/dispute revocation must be checked under the account lock by the caller.
 * Canceling renewal alone must not suppress these grants.
 */
export function duePremiumAllowances(options: {
  schedule: readonly PremiumAllowance[];
  grantedIndexes: ReadonlySet<number>;
  now: Date;
}): PremiumAllowance[] {
  if (!Number.isFinite(options.now.getTime())) throw new RangeError("Invalid allowance delivery time.");
  return options.schedule.filter(({ index, dueAt }) =>
    dueAt <= options.now && !options.grantedIndexes.has(index),
  );
}
