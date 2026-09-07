/** User-facing credit value: 1,000 credits equals one US dollar. */
export const CREDITS_PER_USD = 1_000;
/** One trillionths of a USD preserve per-token cost without decimal math. */
export const PICOUSD_PER_USD = BigInt(1_000_000_000_000);
export const PICOUSD_PER_CREDIT = PICOUSD_PER_USD / BigInt(CREDITS_PER_USD);
export const BASIS_POINTS_PER_WHOLE = BigInt(10_000);

/** Fixed, non-discounted initial top-up options. Amounts are in USD cents. */
export const CREDIT_PACK_IDS = ["starter", "standard", "reserve"] as const;
export const CREDIT_PACKS = [
  { id: "starter", credits: 5_000, amountCents: 500 },
  { id: "standard", credits: 10_000, amountCents: 1_000 },
  { id: "reserve", credits: 25_000, amountCents: 2_500 },
] as const;

export type CreditPackId = (typeof CREDIT_PACK_IDS)[number];
export type CreditPack = (typeof CREDIT_PACKS)[number];

export function creditPackForId(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((pack) => pack.id === id);
}

/**
 * Provider prices are stored as integer picodollars per million tokens so
 * pricing, usage, and audit records never rely on floating-point currency.
 */
export type ModelTokenPricing = {
  uncachedInputPicousdPerMillionTokens: bigint;
  cachedInputPicousdPerMillionTokens: bigint;
  outputPicousdPerMillionTokens: bigint;
};

export type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

/**
 * The versioned customer price policy applied after provider cost is known.
 * Markup is expressed in basis points (100 = 1%).
 */
export type CreditFeePolicy = {
  markupBasisPoints: number;
  fixedTurnCredits: number;
  minimumTurnCredits: number;
};

export type CreditQuote = {
  providerCostPicousd: bigint;
  chargedCredits: number;
};

export type CreditSettlement = {
  reservationCredits: number;
  chargedCredits: number;
  /** Usage beyond the preauthorization. This becomes a bounded negative balance. */
  overageCredits: number;
  settlementCreditsDelta: number;
};

/** The minimum shape required to select an effective-dated billing record. */
export type EffectiveDatedVersion = {
  effectiveAt: Date;
  retiredAt?: Date | null;
};

export class InsufficientCreditsError extends Error {
  readonly availableCredits: number;
  readonly requiredCredits: number;

  constructor(options: { availableCredits: number; requiredCredits: number }) {
    super("Insufficient credits for this request.");
    this.name = "InsufficientCreditsError";
    this.availableCredits = options.availableCredits;
    this.requiredCredits = options.requiredCredits;
  }
}

/** Calculates the exact provider cost for a measured token usage record. */
export function calculateProviderCostPicousd(
  usage: TokenUsage,
  pricing: ModelTokenPricing,
): bigint {
  assertTokenUsage(usage);
  assertNonNegativeBigInt(
    pricing.uncachedInputPicousdPerMillionTokens,
    "uncached input price",
  );
  assertNonNegativeBigInt(
    pricing.cachedInputPicousdPerMillionTokens,
    "cached input price",
  );
  assertNonNegativeBigInt(
    pricing.outputPicousdPerMillionTokens,
    "output price",
  );

  const uncachedInputTokens = usage.inputTokens - usage.cachedInputTokens;
  return (
    (BigInt(uncachedInputTokens) *
      pricing.uncachedInputPicousdPerMillionTokens +
      BigInt(usage.cachedInputTokens) *
        pricing.cachedInputPicousdPerMillionTokens +
      BigInt(usage.outputTokens) * pricing.outputPicousdPerMillionTokens) /
    BigInt(1_000_000)
  );
}

/**
 * Converts exact provider cost into the integer credits shown to the user.
 * Each division rounds upward so the account never loses fractional credits
 * and each request has a deterministic, versionable charge.
 */
export function calculateCreditCharge(
  providerCostPicousd: bigint,
  policy: CreditFeePolicy,
): number {
  assertNonNegativeBigInt(providerCostPicousd, "provider cost");
  assertNonNegativeInteger(policy.markupBasisPoints, "markup basis points");
  assertNonNegativeInteger(policy.fixedTurnCredits, "fixed turn credits");
  assertNonNegativeInteger(policy.minimumTurnCredits, "minimum turn credits");

  const markedUpCost = ceilDivide(
    providerCostPicousd *
      (BASIS_POINTS_PER_WHOLE + BigInt(policy.markupBasisPoints)),
    BASIS_POINTS_PER_WHOLE,
  );
  const variableCredits = ceilDivide(markedUpCost, PICOUSD_PER_CREDIT);
  const chargedCredits = variableCredits + BigInt(policy.fixedTurnCredits);
  const minimum = BigInt(policy.minimumTurnCredits);
  const result = chargedCredits > minimum ? chargedCredits : minimum;

  if (result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError(
      "The calculated credit charge exceeds JavaScript's safe integer range.",
    );
  }

  return Number(result);
}

export function quoteTurnCredits(options: {
  usage: TokenUsage;
  pricing: ModelTokenPricing;
  feePolicy: CreditFeePolicy;
}): CreditQuote {
  const providerCostPicousd = calculateProviderCostPicousd(
    options.usage,
    options.pricing,
  );
  return {
    providerCostPicousd,
    chargedCredits: calculateCreditCharge(
      providerCostPicousd,
      options.feePolicy,
    ),
  };
}

/**
 * Selects the most recently effective version that was active at `at`.
 * Callers retain the full record type, so pricing and policy tables can use
 * the same deterministic selection rule without sharing database code.
 */
export function selectEffectiveVersion<T extends EffectiveDatedVersion>(
  versions: readonly T[],
  at: Date,
): T | undefined {
  const timestamp = at.getTime();
  if (!Number.isFinite(timestamp))
    throw new RangeError("The selection time must be valid.");

  return versions
    .filter((version) => {
      const effectiveAt = version.effectiveAt.getTime();
      const retiredAt = version.retiredAt?.getTime();
      if (
        !Number.isFinite(effectiveAt) ||
        (retiredAt !== undefined && !Number.isFinite(retiredAt))
      ) {
        throw new RangeError("Billing version dates must be valid.");
      }
      return (
        effectiveAt <= timestamp &&
        (retiredAt === undefined || retiredAt > timestamp)
      );
    })
    .reduce<T | undefined>((active, version) => {
      if (!active || version.effectiveAt > active.effectiveAt) return version;
      return active;
    }, undefined);
}

/** Derives an account's available balance from immutable ledger deltas. */
export function availableCreditsFromLedger(
  creditDeltas: readonly number[],
): number {
  return creditDeltas.reduce((balance, delta) => {
    assertSafeInteger(delta, "ledger credit delta");
    const next = balance + delta;
    if (!Number.isSafeInteger(next)) {
      throw new RangeError(
        "The derived credit balance exceeds JavaScript's safe integer range.",
      );
    }
    return next;
  }, 0);
}

/** Throws before a provider request when the reservation cannot be covered. */
export function assertSufficientCredits(options: {
  availableCredits: number;
  requiredCredits: number;
}): void {
  assertSafeInteger(options.availableCredits, "available credits");
  assertNonNegativeInteger(options.requiredCredits, "required credits");

  if (options.availableCredits < options.requiredCredits) {
    throw new InsufficientCreditsError(options);
  }
}

/** The immutable reservation entry immediately reduces available credits. */
export function reservationCreditsDelta(reservationCredits: number): number {
  assertNonNegativeInteger(reservationCredits, "reservation credits");
  return -reservationCredits;
}

/**
 * Settling a reservation appends either the unused portion as a positive
 * ledger adjustment or a bounded overage as a negative adjustment. The
 * original reservation remains immutable, so the two entries always sum to
 * the final measured charge. An overage may leave the account negative and
 * therefore unable to reserve another provider turn until it is topped up.
 */
export function settleReservedCredits(options: {
  reservationCredits: number;
  chargedCredits: number;
}): CreditSettlement {
  assertNonNegativeInteger(options.reservationCredits, "reservation credits");
  assertNonNegativeInteger(options.chargedCredits, "charged credits");

  return {
    reservationCredits: options.reservationCredits,
    chargedCredits: options.chargedCredits,
    overageCredits: Math.max(
      0,
      options.chargedCredits - options.reservationCredits,
    ),
    settlementCreditsDelta: options.reservationCredits - options.chargedCredits,
  };
}

/** A failed or cancelled provider turn reverses the complete reservation. */
export function reverseReservedCredits(reservationCredits: number): number {
  assertNonNegativeInteger(reservationCredits, "reservation credits");
  return reservationCredits;
}

function ceilDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0))
    throw new RangeError("A division denominator must be positive.");
  return numerator === BigInt(0)
    ? BigInt(0)
    : (numerator + denominator - BigInt(1)) / denominator;
}

function assertTokenUsage(usage: TokenUsage): void {
  assertNonNegativeInteger(usage.inputTokens, "input tokens");
  assertNonNegativeInteger(usage.cachedInputTokens, "cached input tokens");
  assertNonNegativeInteger(usage.outputTokens, "output tokens");
  if (usage.cachedInputTokens > usage.inputTokens) {
    throw new RangeError(
      "Cached input tokens cannot exceed total input tokens.",
    );
  }
}

function assertNonNegativeBigInt(value: bigint, label: string): void {
  if (value < BigInt(0)) throw new RangeError(`${label} cannot be negative.`);
}

function assertNonNegativeInteger(value: number, label: string): void {
  assertSafeInteger(value, label);
  if (value < 0) throw new RangeError(`${label} cannot be negative.`);
}

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer.`);
  }
}
