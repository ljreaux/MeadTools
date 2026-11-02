import assert from "node:assert/strict";
import test from "node:test";
import {
  kofiPaymentIsPremiumEligible,
  parseKofiSubscriptionPayment,
} from "../src/index";

const payment = {
  verification_token: "test-token",
  message_id: "event-1",
  kofi_transaction_id: "transaction-1",
  timestamp: "2026-10-11T12:00:00Z",
  type: "Subscription",
  is_subscription_payment: true,
  email: " Supporter@Example.COM ",
  amount: "3.50",
  currency: "USD",
};

test("parses only bounded recurring Ko-fi payments", () => {
  const parsed = parseKofiSubscriptionPayment(
    payment,
    new Date("2026-10-11T12:01:00Z"),
  );
  assert.equal(parsed?.email, "supporter@example.com");
  assert.equal(parsed?.amountCents, 350);
  assert.equal(parsed?.currency, "usd");
  assert.equal(
    parseKofiSubscriptionPayment({ ...payment, type: "Donation" }),
    null,
  );
  assert.equal(
    parseKofiSubscriptionPayment({ ...payment, amount: "3.500" }),
    null,
  );
});

test("grandfathers linked supporters while new members need five dollars", () => {
  assert.equal(
    kofiPaymentIsPremiumEligible({
      amountCents: 350,
      currency: "usd",
      grandfathered: true,
    }),
    true,
  );
  assert.equal(
    kofiPaymentIsPremiumEligible({
      amountCents: 350,
      currency: "usd",
      grandfathered: false,
    }),
    false,
  );
});
