import assert from "node:assert/strict";
import test from "node:test";
import { CREDIT_PACKS } from "@meadtools/credit-accounting";
import {
  buildCreditCheckoutSessionParams,
  MEADTOOLS_PROMPT_CREDITS_TAX_CODE
} from "./credit-checkout-session";

test("credit Checkout uses Managed Payments dynamic payment methods", () => {
  const session = buildCreditCheckoutSessionParams({
    checkoutId: "d5bc59f1-2c72-4c8d-b2c1-2348400ad069",
    pack: CREDIT_PACKS[0],
    successUrl: "https://meadtools.test/account/chat?tab=credits&creditCheckout=success",
    cancelUrl: "https://meadtools.test/account/chat?creditCheckout=cancelled",
    userId: 2
  });

  assert.equal(session.mode, "payment");
  assert.equal(session.managed_payments?.enabled, true);
  assert.equal("payment_method_types" in session, false);
  assert.equal(session.metadata?.credit_pack_id, "starter");
  assert.equal(session.line_items?.[0]?.price_data?.unit_amount, 500);
  assert.equal(session.line_items?.[0]?.price_data?.tax_behavior, "exclusive");
  assert.equal(session.line_items?.[0]?.price_data?.product_data?.tax_code, MEADTOOLS_PROMPT_CREDITS_TAX_CODE);
});
