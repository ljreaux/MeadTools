import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { premiumInvoicePaidThrough, laterPaidThrough, currentSubscriptionState } from "./premium-invoice-period";

function fixture() {
  const subscription = { id: "sub_1", customer: "cus_1", status: "past_due", metadata: { meadtools_user_id: "42" }, items: { data: [{ id: "si_1", current_period_end: 2_000_000_000, price: { id: "price_premium" } }] } } as unknown as Stripe.Subscription;
  const invoice = { customer: "cus_1", parent: { subscription_details: { subscription: "sub_1", metadata: { meadtools_user_id: "42" } } }, lines: { has_more: false, data: [{ parent: { type: "subscription_item_details", subscription_item_details: { subscription: "sub_1", subscription_item: "si_1", proration: false } }, pricing: { price_details: { price: "price_premium" } }, currency: "usd", quantity: 1, amount: 500, period: { start: 1_700_000_000, end: 1_702_592_000 } }] } } as unknown as Stripe.Invoice;
  return { subscription, invoice };
}

test("delayed paid invoice grants only its service period, even after a failed renewal", () => {
  const { invoice, subscription } = fixture();
  const end = premiumInvoicePaidThrough(invoice, subscription, "price_premium", 500);
  assert.equal(end.getTime(), 1_702_592_000_000);
  const newer = new Date(1_705_184_000_000);
  assert.equal(laterPaidThrough(newer, end), newer);
  assert.equal(laterPaidThrough(undefined, end), end);
});

test("unrelated, prorated, truncated and ownership-mismatched invoices are rejected", () => {
  const mutations: Array<(f: ReturnType<typeof fixture>) => void> = [
    ({ invoice }) => { invoice.customer = "cus_other"; },
    ({ invoice }) => { invoice.parent!.subscription_details!.metadata!.meadtools_user_id = "99"; },
    ({ invoice }) => { invoice.lines.has_more = true; },
    ({ invoice }) => { invoice.lines.data[0].parent!.subscription_item_details!.subscription_item = "si_other"; },
    ({ invoice }) => { invoice.lines.data[0].parent!.subscription_item_details!.proration = true; },
    ({ invoice }) => { invoice.lines.data[0].pricing!.price_details!.price = "price_other"; },
    ({ invoice }) => { invoice.lines.data[0].currency = "eur"; },
    ({ invoice }) => { invoice.lines.data[0].period.end = 0; },
    ({ invoice }) => { invoice.lines.data.push(invoice.lines.data[0]); },
  ];
  for (const mutate of mutations) {
    const f = fixture(); mutate(f);
    assert.throws(() => premiumInvoicePaidThrough(f.invoice, f.subscription, "price_premium", 500));
  }
});

test("stale unpaid lifecycle event reads recovered active state before deciding revocation", async () => {
  const { subscription } = fixture();
  subscription.status = "active";
  const state = await currentSubscriptionState("sub_1", async (id) => { assert.equal(id, "sub_1"); return subscription; });
  assert.equal(state.shouldRevoke, false);
  subscription.status = "canceled";
  assert.equal((await currentSubscriptionState("sub_1", async () => subscription)).shouldRevoke, true);
});
