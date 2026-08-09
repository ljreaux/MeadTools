import test from "node:test";
import assert from "node:assert/strict";
import { CREDIT_PACK_IDS } from "@meadtools/credit-accounting";
import {
  creditActivityQuerySchema,
  creditActivityResponseSchema,
  createCreditCheckoutRequestBodySchema,
  creditBalanceResponseSchema
} from "../src/zod/credits";

test("credit balances use whole integer prompt credits", () => {
  assert.deepEqual(
    creditBalanceResponseSchema.parse({ availableCredits: 1_250 }),
    { availableCredits: 1_250 }
  );
  assert.equal(creditBalanceResponseSchema.safeParse({ availableCredits: 1.5 }).success, false);
});

test("credit checkout accepts only configured packs", () => {
  assert.deepEqual(createCreditCheckoutRequestBodySchema.shape.packId.options, CREDIT_PACK_IDS);
  assert.deepEqual(createCreditCheckoutRequestBodySchema.parse({ packId: "starter" }), {
    packId: "starter"
  });
  assert.equal(createCreditCheckoutRequestBodySchema.safeParse({ packId: "discount" }).success, false);
});

test("credit activity history accepts grouped wallet operations", () => {
  assert.deepEqual(creditActivityQuerySchema.parse({ limit: "20" }), { limit: 20 });
  assert.equal(creditActivityQuerySchema.safeParse({ limit: 0 }).success, false);

  assert.deepEqual(creditActivityResponseSchema.parse({
    availableCredits: 4_875,
    purchasesEnabled: false,
    activities: [{
      operationId: "b9523da9-7c2c-4a5f-a55a-b7451ef20d1f",
      occurredAt: "2026-08-08T12:00:00.000Z",
      creditsDelta: -125,
      kind: "usage",
      entryTypes: ["reservation", "settlement"],
      paymentAmountCents: null,
      paymentCurrency: null
    }],
    nextCursor: null
  }).activities[0]?.kind, "usage");

  assert.equal(creditActivityResponseSchema.parse({
    availableCredits: 5_000,
    purchasesEnabled: true,
    activities: [{
      operationId: "8da86946-8efe-4e34-a177-b4b57769b9c3",
      occurredAt: "2026-08-08T12:01:00.000Z",
      creditsDelta: 1_000,
      kind: "grant",
      entryTypes: ["grant"],
      paymentAmountCents: null,
      paymentCurrency: null
    }],
    nextCursor: null
  }).activities[0]?.kind, "grant");

  assert.equal(creditActivityResponseSchema.safeParse({
    availableCredits: 5_000,
    activities: [],
    nextCursor: null
  }).success, false);
});
