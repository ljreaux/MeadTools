import assert from "node:assert/strict";
import test from "node:test";
import {
  InsufficientCreditsError,
  availableCreditsFromLedger,
  assertSufficientCredits,
  calculateCreditCharge,
  calculateProviderCostPicousd,
  creditPackForId,
  CREDIT_PACKS,
  quoteTurnCredits,
  reservationCreditsDelta,
  reverseReservedCredits,
  selectEffectiveVersion,
  settleReservedCredits,
} from "../src/index";

const pricing = {
  uncachedInputPicousdPerMillionTokens: 500_000_000_000n,
  cachedInputPicousdPerMillionTokens: 100_000_000_000n,
  outputPicousdPerMillionTokens: 2_000_000_000_000n,
};

const feePolicy = {
  markupBasisPoints: 1_500,
  fixedTurnCredits: 0,
  minimumTurnCredits: 1,
};

test("initial credit packs preserve a one-mill per credit purchase rate", () => {
  assert.deepEqual(CREDIT_PACKS, [
    { id: "starter", credits: 5_000, amountCents: 500 },
    { id: "standard", credits: 10_000, amountCents: 1_000 },
    { id: "reserve", credits: 25_000, amountCents: 2_500 },
  ]);
  assert.equal(creditPackForId("standard")?.credits, 10_000);
  assert.equal(creditPackForId("unknown"), undefined);
});

test("provider cost separates cached and uncached input tokens", () => {
  assert.equal(
    calculateProviderCostPicousd(
      { inputTokens: 1_000, cachedInputTokens: 400, outputTokens: 250 },
      pricing,
    ),
    840_000_000n,
  );
});

test("credit charges round up fractional values and apply the versioned policy", () => {
  assert.equal(calculateCreditCharge(840_000_000n, feePolicy), 1);
  assert.equal(
    calculateCreditCharge(1_001_000_000n, {
      ...feePolicy,
      markupBasisPoints: 0,
      fixedTurnCredits: 1,
    }),
    3,
  );
  assert.equal(calculateCreditCharge(0n, feePolicy), 1);
});

test("turn quotes preserve exact provider cost while exposing whole user credits", () => {
  assert.deepEqual(
    quoteTurnCredits({
      usage: { inputTokens: 1_000, cachedInputTokens: 400, outputTokens: 250 },
      pricing,
      feePolicy,
    }),
    { providerCostPicousd: 840_000_000n, chargedCredits: 1 },
  );
});

test("a reservation blocks an insufficient account before a provider request", () => {
  assert.doesNotThrow(() =>
    assertSufficientCredits({ availableCredits: 20, requiredCredits: 20 }),
  );
  assert.throws(
    () =>
      assertSufficientCredits({ availableCredits: 19, requiredCredits: 20 }),
    (error: unknown) =>
      error instanceof InsufficientCreditsError &&
      error.availableCredits === 19 &&
      error.requiredCredits === 20,
  );
  assert.throws(
    () =>
      assertSufficientCredits({ availableCredits: -38, requiredCredits: 50 }),
    (error: unknown) =>
      error instanceof InsufficientCreditsError &&
      error.availableCredits === -38 &&
      error.requiredCredits === 50,
  );
});

test("reservation, settlement, and reversal entries keep balance derived from the ledger", () => {
  const reservation = reservationCreditsDelta(12);
  const settlement = settleReservedCredits({
    reservationCredits: 12,
    chargedCredits: 9,
  });

  assert.equal(reservation, -12);
  assert.equal(settlement.settlementCreditsDelta, 3);
  assert.equal(
    availableCreditsFromLedger([
      100,
      reservation,
      settlement.settlementCreditsDelta,
    ]),
    91,
  );
  assert.equal(
    availableCreditsFromLedger([100, reservation, reverseReservedCredits(12)]),
    100,
  );
});

test("settlement records a bounded overage and can leave the ledger negative", () => {
  const settlement = settleReservedCredits({
    reservationCredits: 50,
    chargedCredits: 88,
  });

  assert.deepEqual(settlement, {
    reservationCredits: 50,
    chargedCredits: 88,
    overageCredits: 38,
    settlementCreditsDelta: -38,
  });
  assert.equal(
    availableCreditsFromLedger([
      50,
      reservationCreditsDelta(50),
      settlement.settlementCreditsDelta,
    ]),
    -38,
  );
});

test("effective billing versions select the newest active record", () => {
  const versions = [
    {
      id: "retired",
      effectiveAt: new Date("2026-01-01T00:00:00.000Z"),
      retiredAt: new Date("2026-03-01T00:00:00.000Z"),
    },
    { id: "spring", effectiveAt: new Date("2026-03-01T00:00:00.000Z") },
    { id: "summer", effectiveAt: new Date("2026-06-01T00:00:00.000Z") },
  ];

  assert.equal(
    selectEffectiveVersion(versions, new Date("2026-02-01T00:00:00.000Z"))?.id,
    "retired",
  );
  assert.equal(
    selectEffectiveVersion(versions, new Date("2026-04-01T00:00:00.000Z"))?.id,
    "spring",
  );
  assert.equal(
    selectEffectiveVersion(versions, new Date("2026-07-01T00:00:00.000Z"))?.id,
    "summer",
  );
  assert.equal(
    selectEffectiveVersion(versions, new Date("2025-12-01T00:00:00.000Z")),
    undefined,
  );
});
