import assert from "node:assert/strict";
import prisma from "../../prisma.ts";
import { getStripeClient } from "../stripe.ts";
import { handlePremiumStripeEvent } from "../stripe-premium.ts";

// This process has only dummy credentials. All DB/Stripe operations below are
// replaced before invoking production handlers; the transaction proxy fails
// immediately if a new, unmocked DB operation is introduced.
getStripeClient()._requestSender.request = () => { throw new Error("Unmocked Stripe request in offline fixture"); };
getStripeClient().invoicePayments.list = async () => ({ data: [], has_more: false });
let locked = false;
let currentLink = { user_id: 42, subscription_id: "sub_1", customer_id: "cus_1", status: "active" };
let subscription = {
  id: "sub_1", customer: "cus_1", status: "active", cancel_at_period_end: false,
  metadata: { meadtools_user_id: "42" },
  items: { data: [{ id: "si_1", current_period_end: 2_000_000_000,
    price: { id: "price_premium", currency: "usd", unit_amount: 500, recurring: { interval: "month" } } }] },
};
let retrieves = 0;
let updates = [];
let revocations = [];
let membership = null;
let grants = [];
const invoices = new Map();
getStripeClient().subscriptions.retrieve = async () => { retrieves++; return structuredClone(subscription); };
prisma.premium_stripe_subscriptions.findUnique = async () => ({ user_id: 42, subscription_id: "sub_1", customer_id: "cus_1" });
const tx = new Proxy({
  $queryRaw: async (query) => {
    const sql = Array.isArray(query) ? query.join("") : query.sql;
    if (sql.includes("FROM users")) { locked = true; return [{ id: 42 }]; }
    assert.ok(locked);
    if (sql.includes('INSERT INTO "credit_accounts"')) return [{ id: "credit-account" }];
    if (sql.includes('SUM("credits_delta")')) return [{ balance: BigInt(100) }];
    throw new Error(`Unmocked SQL: ${sql}`);
  },
  premium_stripe_subscriptions: {
    findUnique: async () => { assert.ok(locked); return currentLink; },
    update: async ({ data }) => { assert.ok(locked); updates.push(data); },
    upsert: async ({ create, update }) => { currentLink = currentLink ? { ...currentLink, ...update } : create; },
  },
  premium_memberships: {
    findUnique: async () => membership,
    updateMany: async ({ data }) => { assert.ok(locked); revocations.push(data); },
    upsert: async ({ create, update }) => { membership = membership ? { ...membership, ...update } : { ...create, revoked_at: null }; },
  },
  premium_stripe_invoices: {
    createMany: async ({ data }) => {
      if (invoices.has(data.invoice_id)) return { count: 0 };
      invoices.set(data.invoice_id, data); return { count: 1 };
    },
  },
  credit_ledger_entries: {
    findUnique: async () => null,
    create: async ({ data }) => { grants.push(data); },
  },
}, { get(target, prop) { if (!(prop in target)) throw new Error(`Unmocked transaction property: ${String(prop)}`); return target[prop]; } });
prisma.$transaction = async (fn, options) => {
  assert.equal(options.timeout, 30_000);
  locked = false;
  try { return await fn(tx); } finally { locked = false; }
};

const lifecycle = (status) => ({ type: "customer.subscription.updated", data: { object: { ...subscription, status } } });
await handlePremiumStripeEvent(lifecycle("unpaid"));
assert.equal(revocations.length, 0, "stale unpaid event must not revoke recovered membership");
assert.equal(updates.at(-1).status, "active");
assert.equal(retrieves, 1);

currentLink = { ...currentLink, subscription_id: "sub_replacement" };
await handlePremiumStripeEvent(lifecycle("canceled"));
assert.equal(updates.length, 1, "old subscription must not overwrite a replacement identity");
assert.equal(retrieves, 1, "replacement check happens under lock before Stripe lookup");
currentLink.subscription_id = "sub_1";
subscription.status = "canceled";
await handlePremiumStripeEvent(lifecycle("active"));
assert.equal(updates.at(-1).status, "canceled");
assert.equal(revocations.length, 1, "authoritative cancellation revokes even for stale active event");

subscription.status = "past_due";
const invoice = {
  id: "in_old", status: "paid", currency: "usd", amount_paid: 500, billing_reason: "subscription_cycle",
  customer: "cus_1", created: 1_700_000_000, status_transitions: { paid_at: 1_700_000_000 },
  parent: { subscription_details: { subscription: "sub_1", metadata: { meadtools_user_id: "42" } } },
  lines: { has_more: false, data: [{ parent: { type: "subscription_item_details", subscription_item_details: {
    subscription: "sub_1", subscription_item: "si_1", proration: false,
  } }, pricing: { price_details: { price: "price_premium" } }, currency: "usd", quantity: 1, amount: 500,
  period: { start: 1_700_000_000, end: 1_702_592_000 } }] },
};
const paid = () => handlePremiumStripeEvent({ type: "invoice.paid", data: { object: invoice } });
await paid();
assert.equal(membership.paid_through.getTime(), 1_702_592_000_000, "invoice period wins over current subscription period");
assert.equal(invoices.get("in_old").paid_through.getTime(), 1_702_592_000_000);
assert.equal(grants.length, 1);
await paid();
assert.equal(grants.length, 1, "invoice redelivery must not duplicate allowance");
membership.paid_through = new Date(1_705_184_000_000);
invoice.id = "in_older_delayed";
await paid();
assert.equal(membership.paid_through.getTime(), 1_705_184_000_000, "delayed invoice cannot shorten paid membership");
await prisma.$disconnect();
