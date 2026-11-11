import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, beforeEach, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

// Destructive setup is deliberately limited to this disposable database.
const database = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(["localhost", "127.0.0.1"].includes(database.hostname));
assert.equal(database.pathname, "/meadtools_premium_foundation_test");
Object.assign(process.env, {
  NODE_ENV: "test",
  PREMIUM_ACCESS_ENABLED: "true",
  PREMIUM_MCP_ENABLED: "true",
  NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
  VERCEL_ENV: "",
  STRIPE_SECRET_KEY: "sk_test_offline_fixture",
  STRIPE_PREMIUM_PRICE_ID: "price_premium",
  STRIPE_PREMIUM_ANNUAL_PRICE_ID: "price_annual",
  PREMIUM_ANNUAL_SUBSCRIPTIONS_ENABLED: "true",
  PREMIUM_SUBSCRIPTIONS_ENABLED: "true",
  STRIPE_WEBHOOK_SECRET: "whsec_offline_fixture",
  KOFI_EMAIL_DIGEST_SECRET: "offline-fixture-email-digest-secret",
  PREMIUM_KOFI_GRANDFATHER_CUTOFF: "2020-01-01T00:00:00Z",
});
const { default: prisma } = await import("../lib/prisma.ts");
const oauth = await import("../lib/mcp/oauth.ts");
const mcp = await import("../lib/mcp/access.ts");
const kofi = await import("../lib/billing/kofi-premium.ts");
const recovery = await import("../lib/billing/credit-payment-recovery.ts");
const { handlePremiumStripeEvent } =
  await import("../lib/billing/stripe-premium.ts");
const { getStripeClient } = await import("../lib/billing/stripe.ts");
const { getPremiumAccessStatus } = await import("../lib/db/premium-access.ts");
const { recordCreditGrant, recordCreditAdjustmentInTransaction } =
  await import("../lib/db/credit-accounting.ts");
const { reverseAbandonedCreditReservations, reconcileFinalizedChatbotUsageEvents } =
  await import("../lib/db/credit-accounting.ts");
const stripe = getStripeClient();
stripe._requestSender.request = () => {
  throw new Error("Unmocked Stripe request in offline database fixture");
};
let subscriptions;
let payments;
const transaction = prisma.$transaction.bind(prisma);
beforeEach(async () => {
  prisma.$transaction = transaction;
  await prisma.$executeRawUnsafe(
    "TRUNCATE users, mcp_oauth_clients, mcp_registration_budget, credit_stripe_refund_events, credit_stripe_dispute_events CASCADE",
  );
  subscriptions = new Map();
  payments = [];
  stripe.subscriptions.retrieve = async (id) =>
    structuredClone(subscriptions.get(id));
  stripe.invoicePayments.list = async (params) => ({
    has_more: false,
    data: structuredClone(
      payments.filter((p) =>
        params.invoice
          ? p.invoice === params.invoice
          : p.payment.payment_intent === params.payment.payment_intent,
      ),
    ),
  });
});
after(async () => {
  prisma.$transaction = transaction;
  await prisma.$disconnect();
});
const user = () =>
  prisma.users.create({ data: { email: `${randomUUID()}@fixture.invalid` } });
test("credit reconciliation binds enum parameters and repairs each stale operation once", async () => {
  const u = await user();
  await recordCreditGrant({ userId: u.id, operationId: randomUUID(),
    idempotencyKey: randomUUID(), creditAmount: 100 });
  const account = await prisma.credit_accounts.findUniqueOrThrow({ where: { user_id: u.id } });
  const abandoned = randomUUID();
  const settled = randomUUID();
  const created_at = new Date("2026-01-01T00:00:00Z");
  await prisma.credit_ledger_entries.createMany({ data: [
    { account_id: account.id, operation_id: abandoned, idempotency_key: randomUUID(),
      entry_type: "reservation", credits_delta: -10, created_at },
    { account_id: account.id, operation_id: settled, idempotency_key: randomUUID(),
      entry_type: "reservation", credits_delta: -10, created_at },
    { account_id: account.id, operation_id: settled, idempotency_key: randomUUID(),
      entry_type: "settlement", credits_delta: 3, created_at },
  ] });
  await prisma.chatbot_usage_events.create({ data: {
    user_id: u.id, request_id: settled, environment: "test", model: "offline-fixture",
    status: "reserved", created_at,
  } });
  const now = new Date("2026-01-03T00:00:00Z");
  assert.deepEqual(await reverseAbandonedCreditReservations({ now }),
    { reversed: 1, settled: 0, skipped: 0 });
  assert.deepEqual(await reverseAbandonedCreditReservations({ now }),
    { reversed: 0, settled: 0, skipped: 0 });
  assert.deepEqual(await reconcileFinalizedChatbotUsageEvents({ now, olderThan: now }),
    { finalized: 1, skipped: 0 });
  assert.deepEqual(await reconcileFinalizedChatbotUsageEvents({ now, olderThan: now }),
    { finalized: 0, skipped: 0 });
  assert.equal(await balance(u.id), 93);
  assert.equal(await prisma.credit_ledger_entries.count({ where: {
    operation_id: abandoned, entry_type: "reversal",
  } }), 1);
});
const future = () => new Date(Date.now() + 30 * 86400_000);
async function premiumUser() {
  const u = await user();
  await prisma.premium_memberships.create({
    data: { user_id: u.id, source: "manual", paid_through: future() },
  });
  return u;
}
async function balance(userId) {
  const result = await prisma.credit_ledger_entries.aggregate({
    where: { account: { user_id: userId } },
    _sum: { credits_delta: true },
  });
  return result._sum.credits_delta ?? 0;
}
async function session(userId) {
  const clientId = `fixture_${randomUUID()}`;
  await prisma.mcp_oauth_clients.create({
    data: {
      client_id: clientId,
      client_name: "Fixture",
      redirect_uris: ["https://fixture.invalid/callback"],
    },
  });
  const token = `mtmcp_refresh_${randomBytes(32).toString("base64url")}`;
  const record = await prisma.mcp_oauth_sessions.create({
    data: {
      user_id: userId,
      client_id: clientId,
      label: "Fixture",
      access_token_hash: oauth.oauthHash(randomUUID()),
      refresh_token_hash: oauth.oauthHash(token),
      access_expires_at: future(),
      refresh_expires_at: future(),
      resource: "http://localhost:3000/mcp",
      scope: "mcp:tools",
    },
  });
  return {
    record,
    input: { refreshToken: token, clientId, resource: record.resource },
  };
}
test("refresh replay revokes the replacement access and refresh tokens", async () => {
  const u = await premiumUser();
  const s = await session(u.id);
  const rotated = await oauth.exchangeRefreshToken(s.input);
  assert.equal(
    (await mcp.authenticateMcpAccessToken(`Bearer ${rotated.access_token}`))
      .kind,
    "authorized",
  );
  await assert.rejects(oauth.exchangeRefreshToken(s.input), {
    code: "invalid_grant",
  });
  assert.equal(
    (await mcp.authenticateMcpAccessToken(`Bearer ${rotated.access_token}`))
      .kind,
    "unauthorized",
  );
  await assert.rejects(
    oauth.exchangeRefreshToken({
      ...s.input,
      refreshToken: rotated.refresh_token,
    }),
    { code: "invalid_grant" },
  );
});
test("concurrent refresh reuse commits revocation", async () => {
  const u = await premiumUser();
  const s = await session(u.id);
  const results = await Promise.allSettled([
    oauth.exchangeRefreshToken(s.input),
    oauth.exchangeRefreshToken(s.input),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.code,
    "invalid_grant",
  );
  assert.ok(
    (
      await prisma.mcp_oauth_sessions.findUniqueOrThrow({
        where: { id: s.record.id },
      })
    ).revoked_at,
  );
});
test("concurrent personal tokens stop at five; expired accounts can list and revoke", async () => {
  const u = await premiumUser();
  for (let i = 0; i < 4; i++)
    await mcp.createMcpAccessToken(u.id, `Fixture ${i}`);
  const results = await Promise.allSettled([
    mcp.createMcpAccessToken(u.id, "Fifth"),
    mcp.createMcpAccessToken(u.id, "Sixth"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  await prisma.premium_memberships.updateMany({
    where: { user_id: u.id },
    data: { paid_through: new Date(0) },
  });
  const tokens = await mcp.listMcpAccessTokens(u.id);
  assert.equal(tokens.length, 5);
  assert.equal(await mcp.revokeMcpAccessToken(u.id, tokens[0].id), true);
  const s = await session(u.id);
  assert.equal((await mcp.listMcpOAuthSessions(u.id)).length, 1);
  assert.equal(await mcp.revokeMcpOAuthSession(u.id, s.record.id), true);
});
const registration = {
  client_name: "Fixture",
  redirect_uris: ["https://fixture.invalid/callback"],
};
test("registration budget is atomic and expires", async () => {
  await prisma.mcp_registration_budget.create({
    data: { id: true, call_count: 59, window_start: new Date() },
  });
  const results = await Promise.allSettled([
    oauth.registerMcpOAuthClient(registration),
    oauth.registerMcpOAuthClient(registration),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    results.find((r) => r.status === "rejected").reason.code,
    "registration_rate_limited",
  );
  await prisma.mcp_registration_budget.update({
    where: { id: true },
    data: { window_start: new Date(0) },
  });
  await oauth.registerMcpOAuthClient(registration);
  assert.equal(
    (
      await prisma.mcp_registration_budget.findUniqueOrThrow({
        where: { id: true },
      })
    ).call_count,
    1,
  );
});
test("registration retention preserves live grants and bounds stored clients", async () => {
  const u = await premiumUser();
  const s = await session(u.id);
  await prisma.mcp_oauth_clients.update({
    where: { client_id: s.input.clientId },
    data: { created_at: new Date(0) },
  });
  await prisma.mcp_oauth_clients.create({
    data: {
      client_id: "unused",
      client_name: "Unused",
      redirect_uris: [],
      created_at: new Date(0),
    },
  });
  await oauth.registerMcpOAuthClient(registration);
  assert.equal(await prisma.mcp_oauth_clients.count(), 2);
  assert.ok(
    await prisma.mcp_oauth_clients.findUnique({
      where: { client_id: s.input.clientId },
    }),
  );
  await prisma.mcp_oauth_clients.createMany({
    data: Array.from({ length: 998 }, (_, i) => ({
      client_id: `bounded_${i}`,
      client_name: "Bounded",
      redirect_uris: [],
    })),
  });
  await assert.rejects(oauth.registerMcpOAuthClient(registration), {
    code: "registration_rate_limited",
  });
  assert.equal(await prisma.mcp_oauth_clients.count(), 1000);
});

// Pause a real transaction after a lookup, and let its contender either commit
// (old bug) or visibly block on the shared payer lock (fixed path).
async function interleave(model, method, first, second) {
  let ready;
  const reached = new Promise((resolve) => {
    ready = resolve;
  });
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let paused = false;
  prisma.$transaction = (fn, options) =>
    transaction(
      (tx) =>
        fn(
          new Proxy(tx, {
            get(target, key) {
              if (key !== model) return Reflect.get(target, key);
              return new Proxy(target[key], {
                get(delegate, name) {
                  if (name !== method) return Reflect.get(delegate, name);
                  return async (...args) => {
                    const result = await delegate[name](...args);
                    if (!paused) {
                      paused = true;
                      ready();
                      await gate;
                    }
                    return result;
                  };
                },
              });
            },
          }),
        ),
      options,
    );
  const a = first();
  await reached;
  let done = false;
  const b = second().finally(() => {
    done = true;
  });
  try {
    const deadline = Date.now() + 3000;
    while (!done) {
      const waiting =
        await prisma.$queryRaw`SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND NOT granted`;
      if (waiting.length) break;
      assert.ok(
        Date.now() < deadline,
        "Contender neither completed nor reached payer lock",
      );
      await delay(10);
    }
  } finally {
    release();
  }
  try {
    await Promise.all([a, b]);
  } finally {
    prisma.$transaction = transaction;
  }
}
async function kofiRace(webhookFirst) {
  const u = await user();
  const email = u.email;
  const token = randomBytes(32).toString("base64url");
  await prisma.premium_kofi_link_challenges.create({
    data: {
      user_id: u.id,
      email_digest: kofi.kofiEmailDigest(email),
      token_hash: oauth.oauthHash(token),
      expires_at: future(),
    },
  });
  const pay = () =>
    kofi.recordKofiSubscriptionPayment({
      email,
      messageId: randomUUID(),
      transactionId: randomUUID(),
      paidAt: new Date(),
      amountCents: 500,
      currency: "usd",
    });
  const claim = () => kofi.claimKofiAccountLink({ userId: u.id, token });
  await interleave(
    webhookFirst ? "premium_kofi_links" : "premium_kofi_payments",
    webhookFirst ? "findUnique" : "findMany",
    webhookFirst ? pay : claim,
    webhookFirst ? claim : pay,
  );
  assert.equal((await getPremiumAccessStatus(u.id)).premiumEnabled, true);
  assert.equal(await balance(u.id), 1000);
  assert.equal(
    await prisma.premium_kofi_payments.count({
      where: { applied_user_id: u.id },
    }),
    1,
  );
}
test("initial Ko-fi link sees a webhook that began first", () =>
  kofiRace(true));
test("initial Ko-fi payment sees a claim that began first", () =>
  kofiRace(false));

async function invoiceFor(
  u,
  suffix = "first",
  end = Math.floor(Date.now() / 1000) + 30 * 86400,
  interval = "month",
) {
  const subscriptionId = `sub_${u.id}`;
  const invoiceId = `in_${u.id}_${suffix}`;
  const paymentId = `pi_${u.id}_${suffix}`;
  const annualStart = new Date(end * 1000);
  annualStart.setUTCFullYear(annualStart.getUTCFullYear() - 1);
  const start = interval === "year" ? annualStart.getTime() / 1000 : end - 30 * 86400;
  subscriptions.set(subscriptionId, {
    id: subscriptionId,
    customer: `cus_${u.id}`,
    status: "active",
    cancel_at_period_end: false,
    metadata: { meadtools_user_id: String(u.id) },
    items: {
      data: [
        {
          id: `si_${u.id}`,
          quantity: 1,
          current_period_end: end,
          price: {
            id: interval === "year" ? "price_annual" : "price_premium",
            currency: "usd",
            unit_amount: interval === "year" ? 5000 : 500,
            recurring: { interval, interval_count: 1 },
          },
        },
      ],
    },
  });
  payments.push({
    invoice: invoiceId,
    payment: { type: "payment_intent", payment_intent: paymentId },
  });
  const invoice = {
    id: invoiceId,
    status: "paid",
    currency: "usd",
    amount_paid: interval === "year" ? 5000 : 500,
    billing_reason: "subscription_cycle",
    customer: `cus_${u.id}`,
    created: start,
    status_transitions: { paid_at: start },
    parent: {
      subscription_details: {
        subscription: subscriptionId,
        metadata: { meadtools_user_id: String(u.id) },
      },
    },
    lines: {
      has_more: false,
      data: [
        {
          parent: {
            type: "subscription_item_details",
            subscription_item_details: {
              subscription: subscriptionId,
              subscription_item: `si_${u.id}`,
              proration: false,
            },
          },
          pricing: { price_details: { price: interval === "year" ? "price_annual" : "price_premium" } },
          currency: "usd",
          quantity: 1,
          amount: interval === "year" ? 5000 : 500,
          period: { start, end },
        },
      ],
    },
  };
  return {
    invoice,
    invoiceId,
    paymentId,
    end,
    pay: () =>
      handlePremiumStripeEvent({
        type: "invoice.paid",
        data: { object: invoice },
      }),
  };
}
for (const interval of ["month", "year"]) {
  test(`a ${interval} invoice may put a one-off item before its Premium recurring line`, async () => {
    const u = await user();
    const end = new Date(); end.setUTCFullYear(end.getUTCFullYear() + 1);
    const i = await invoiceFor(u, "extra-item", Math.floor(end.getTime() / 1000), interval);
    i.invoice.lines.data.unshift({
      parent: { type: "invoice_item_details", invoice_item_details: { invoice_item: "ii_extra" } },
      pricing: { price_details: { price: "price_unrelated" } }, currency: "usd", amount: 100,
    });
    i.invoice.amount_paid += 100;
    await i.pay();
    assert.equal(await balance(u.id), 1000);
    assert.equal((await prisma.premium_stripe_invoices.findUniqueOrThrow({ where: { invoice_id: i.invoiceId } })).billing_interval, interval);
  });
}

test("a delayed historical monthly invoice does not erase a future monthly switch from annual", async () => {
  const u = await user();
  const historicalEnd = Math.floor(Date.now() / 1000) - 86400;
  const old = await invoiceFor(u, "delayed", historicalEnd);
  await annualInvoice(u);
  await prisma.premium_stripe_subscriptions.update({ where: { user_id: u.id }, data: { scheduled_interval: "month" } });
  await old.pay();
  assert.equal((await prisma.premium_stripe_subscriptions.findUniqueOrThrow({ where: { user_id: u.id } })).scheduled_interval, "month");
  assert.equal(await balance(u.id), 2000);
});

const refund = (
  paymentId,
  amount,
  id = `re_${randomUUID()}`,
  eventId = `evt_${randomUUID()}`,
) =>
  recovery.reconcileStripeRefund({
    eventId,
    eventType: "refund.created",
    refund: {
      id,
      payment_intent: paymentId,
      status: "succeeded",
      currency: "usd",
      amount,
    },
  });
const dispute = (paymentId, id = `dp_${randomUUID()}`) =>
  recovery.flagStripeDisputeForReview({
    eventId: `evt_${randomUUID()}`,
    eventType: "charge.dispute.created",
    dispute: { id, payment_intent: paymentId, currency: "usd", amount: 500 },
  });
async function resolve(id, u, creditDelta = 0) {
  return recovery.resolveCreditPaymentRecovery({
    recoveryId: id,
    resolvedByUserId: u.id,
    creditDelta,
    note: "Verified fixture resolution",
    releaseChat: true,
  });
}
test("Stripe grants 1,000 once and reconciles out-of-order, partial and full refunds", async () => {
  const u = await user();
  const i = await invoiceFor(u);
  const refundId = "re_partial";
  assert.equal(
    await refund(i.paymentId, 250, refundId, "evt_early"),
    "deferred",
  );
  await i.pay();
  assert.equal(await balance(u.id), 500);
  await i.pay();
  assert.equal(await balance(u.id), 500);
  assert.equal(
    await refund(i.paymentId, 250, refundId, "evt_early"),
    "duplicate",
  );
  assert.equal(await refund(i.paymentId, 250, refundId), "duplicate");
  assert.equal((await getPremiumAccessStatus(u.id)).premiumEnabled, true);
  assert.equal(await refund(i.paymentId, 250), "applied");
  assert.equal(await balance(u.id), 0);
  assert.equal((await getPremiumAccessStatus(u.id)).premiumEnabled, false);
  assert.equal(
    await prisma.credit_ledger_entries.count({
      where: { account: { user_id: u.id }, entry_type: "grant" },
    }),
    1,
  );
});
test("refund of an earlier invoice preserves a later paid period and Ko-fi", async () => {
  const u = await user();
  const old = await invoiceFor(u);
  await old.pay();
  const next = await invoiceFor(u, "next", old.end + 30 * 86400);
  await next.pay();
  await prisma.premium_memberships.create({
    data: { user_id: u.id, source: "kofi", paid_through: future() },
  });
  await refund(old.paymentId, 500);
  const membership = await prisma.premium_memberships.findUniqueOrThrow({
    where: { user_id_source: { user_id: u.id, source: "stripe" } },
  });
  assert.equal(membership.paid_through.getTime(), next.end * 1000);
  assert.equal(membership.revoked_at, null);
  await refund(next.paymentId, 500);
  assert.equal((await getPremiumAccessStatus(u.id)).premiumEnabled, true);
});
test("older invoice payment mapping is repaired when a refund arrives", async () => {
  const u = await user();
  const i = await invoiceFor(u);
  await i.pay();
  await prisma.premium_stripe_payments.deleteMany();
  await refund(i.paymentId, 500);
  assert.equal(await balance(u.id), 0);
  assert.equal(await prisma.premium_stripe_payments.count(), 1);
});
test("a failed provider lookup can retry the same persisted refund receipt", async () => {
  const u = await user();
  const i = await invoiceFor(u);
  await i.pay();
  await prisma.premium_stripe_payments.deleteMany();
  const list = stripe.invoicePayments.list;
  stripe.invoicePayments.list = async () => {
    throw new Error("Simulated provider failure");
  };
  await assert.rejects(
    refund(i.paymentId, 500, "re_retry", "evt_retry"),
    /Simulated provider failure/,
  );
  assert.equal(await balance(u.id), 1000);
  stripe.invoicePayments.list = list;
  assert.equal(
    await refund(i.paymentId, 500, "re_retry", "evt_retry"),
    "applied",
  );
  assert.equal(await balance(u.id), 0);
});
test("deferred disputes restrict premium and resolve through existing administration", async () => {
  const u = await user();
  const i = await invoiceFor(u);
  assert.equal(await dispute(i.paymentId, "dp_early"), "deferred");
  await i.pay();
  assert.equal(await balance(u.id), 1000);
  assert.equal((await getPremiumAccessStatus(u.id)).premiumEnabled, false);
  const rows = await recovery.getCreditPaymentRecoveryAdministration();
  assert.equal(rows[0].packId, `premium:${i.invoiceId}`);
  assert.equal(rows[0].userId, u.id);
  assert.equal(rows[0].paymentRestricted, true);
  assert.equal(await dispute(i.paymentId, "dp_early"), "duplicate");
  assert.equal((await resolve(rows[0].id, u)).chatReleased, true);
  assert.equal((await getPremiumAccessStatus(u.id)).premiumEnabled, true);
});
test("refund after spending credits requires an immutable correction before release", async () => {
  const u = await user();
  const i = await invoiceFor(u);
  await i.pay();
  await transaction((tx) =>
    recordCreditAdjustmentInTransaction(tx, {
      userId: u.id,
      operationId: randomUUID(),
      idempotencyKey: "fixture-spend",
      creditsDelta: -800,
    }),
  );
  assert.equal(await refund(i.paymentId, 500), "review_required");
  assert.equal(await balance(u.id), -800);
  const [row] = await recovery.getCreditPaymentRecoveryAdministration();
  assert.equal((await resolve(row.id, u)).chatReleased, false);
  await assert.rejects(resolve(row.id, u, 800), /resolved payment recovery/);
  await recordCreditGrant({
    userId: u.id,
    operationId: randomUUID(),
    idempotencyKey: "fixture-recovery",
    creditAmount: 800,
  });
  assert.equal((await resolve(row.id, u)).chatReleased, true);
});
test("credit-pack recovery still works and an open case of either source blocks release", async () => {
  const u = await user();
  const i = await invoiceFor(u);
  await i.pay();
  await prisma.credit_checkout_sessions.create({
    data: {
      user_id: u.id,
      pack_id: "fixture",
      credit_amount: 1000,
      amount_cents: 500,
      currency: "usd",
      status: "fulfilled",
      stripe_payment_intent_id: "pi_pack",
      stripe_amount_total_cents: 500,
      stripe_payment_currency: "usd",
    },
  });
  await recordCreditGrant({
    userId: u.id,
    operationId: randomUUID(),
    idempotencyKey: "fixture-pack",
    creditAmount: 1000,
  });
  assert.equal(await refund("pi_pack", 250), "applied");
  assert.equal(await balance(u.id), 1500);
  assert.equal(await dispute("pi_pack", "dp_pack"), "review_required");
  assert.equal(await dispute(i.paymentId, "dp_premium"), "review_required");
  const rows = await recovery.getCreditPaymentRecoveryAdministration();
  assert.equal(
    (await resolve(rows.find((r) => r.externalReference === "dp_pack").id, u))
      .chatReleased,
    false,
  );
  assert.equal(
    (
      await resolve(
        rows.find((r) => r.externalReference === "dp_premium").id,
        u,
        -1000,
      )
    ).chatReleased,
    true,
  );
  assert.equal(await balance(u.id), 500);
});
test("operator correction of an overspent premium refund is applied only once", async () => {
  const u = await user();
  const i = await invoiceFor(u);
  await i.pay();
  await transaction((tx) =>
    recordCreditAdjustmentInTransaction(tx, {
      userId: u.id,
      operationId: randomUUID(),
      idempotencyKey: "fixture-spend",
      creditsDelta: -800,
    }),
  );
  await refund(i.paymentId, 500);
  const [row] = await recovery.getCreditPaymentRecoveryAdministration();
  assert.equal((await resolve(row.id, u, 800)).chatReleased, true);
  assert.equal(await balance(u.id), 0);
  await assert.rejects(resolve(row.id, u, 800), /resolved payment recovery/);
  assert.equal((await resolve(row.id, u)).chatReleased, true);
  assert.equal(await balance(u.id), 0);
});

const { deliverDuePremiumAllowances } = await import("../lib/billing/premium-allowances.ts");
async function annualInvoice(u) {
  const end = new Date(); end.setUTCFullYear(end.getUTCFullYear() + 1);
  const invoice = await invoiceFor(u, "annual", Math.floor(end.getTime() / 1000), "year");
  await invoice.pay();
  return invoice;
}

test("annual invoice grants once, catches up concurrently, and never exceeds twelve allowances", async () => {
  const u = await user();
  const i = await annualInvoice(u);
  assert.equal(await balance(u.id), 1000);
  assert.equal(await prisma.premium_stripe_allowances.count({ where: { invoice_id: i.invoiceId } }), 12);
  await Promise.all([i.pay(), i.pay()]);
  assert.equal(await balance(u.id), 1000);
  const schedule = await prisma.premium_stripe_allowances.findMany({ where: { invoice_id: i.invoiceId }, orderBy: { allowance_index: "asc" } });
  await Promise.all(Array.from({ length: 5 }, () => deliverDuePremiumAllowances({ now: schedule[2].due_at })));
  assert.equal(await balance(u.id), 3000);
  assert.equal((await prisma.premium_stripe_invoices.findUniqueOrThrow({ where: { invoice_id: i.invoiceId } })).granted_credits, 3000);
  await deliverDuePremiumAllowances({ now: new Date(i.end * 1000 + 86400000) });
  await deliverDuePremiumAllowances({ now: new Date(i.end * 1000 + 86400000) });
  assert.equal(await balance(u.id), 12000);
});

test("canceling renewal preserves annual grants; full refund removes only delivered included credits", async () => {
  const u = await user(); const i = await annualInvoice(u);
  const sub = subscriptions.get(`sub_${u.id}`); sub.cancel_at_period_end = false; sub.cancel_at = i.end;
  await handlePremiumStripeEvent({ type: "customer.subscription.updated", data: { object: sub } });
  assert.equal((await prisma.premium_stripe_subscriptions.findUniqueOrThrow({ where: { user_id: u.id } })).cancel_at_period_end, true);
  const second = await prisma.premium_stripe_allowances.findUniqueOrThrow({ where: { invoice_id_allowance_index: { invoice_id: i.invoiceId, allowance_index: 1 } } });
  await deliverDuePremiumAllowances({ now: second.due_at });
  assert.equal(await balance(u.id), 2000);
  await recordCreditGrant({ userId: u.id, operationId: randomUUID(), idempotencyKey: randomUUID(), creditAmount: 700 });
  await recovery.reconcileStripeRefund({ eventId: randomUUID(), eventType: "refund.created", refund: {
    id: `re_${randomUUID()}`, payment_intent: i.paymentId, status: "succeeded", amount: 5000, currency: "usd",
  } });
  assert.equal(await balance(u.id), 700);
  await deliverDuePremiumAllowances({ now: new Date(i.end * 1000) });
  assert.equal(await balance(u.id), 700);
});

test("partial annual refunds require review and prevent subsequent allowance delivery", async () => {
  const u = await user(); const i = await annualInvoice(u);
  assert.equal(await recovery.reconcileStripeRefund({ eventId: randomUUID(), eventType: "refund.created", refund: {
    id: `re_${randomUUID()}`, payment_intent: i.paymentId, status: "succeeded", amount: 2500, currency: "usd",
  } }), "review_required");
  await deliverDuePremiumAllowances({ now: new Date(i.end * 1000) });
  assert.equal(await balance(u.id), 1000);
});

const { schedulePremiumPlanChange } = await import("../lib/billing/premium-plan-change.ts");
for (const currentInterval of ["month", "year"]) {
  test(`repeated ${currentInterval} billing switches withdraw and recreate schedules without charging`, async () => {
    const u = await user();
    const i = currentInterval === "year" ? await annualInvoice(u) : await invoiceFor(u);
    if (currentInterval === "month") await i.pay();
    const targetInterval = currentInterval === "month" ? "year" : "month";
    const currentPrice = currentInterval === "month" ? "price_premium" : "price_annual";
    const targetPrice = currentInterval === "month" ? "price_annual" : "price_premium";
    const sub = subscriptions.get(`sub_${u.id}`);
    sub.items.data[0].current_period_start = Math.floor(Date.now() / 1000);
    const schedules = new Map();
    const responses = new Map();
    stripe.subscriptions.update = async (id, params) => {
      assert.equal(id, sub.id);
      Object.assign(sub.metadata, params.metadata);
      return structuredClone(sub);
    };
    stripe.subscriptionSchedules.create = async ({ from_subscription }, { idempotencyKey }) => {
      assert.equal(from_subscription, sub.id);
      // Stripe replays the ORIGINAL create response, even after release.
      if (responses.has(idempotencyKey)) return structuredClone(responses.get(idempotencyKey));
      assert.equal(sub.schedule ?? null, null);
      const schedule = { id: `sched_fixture_${schedules.size}`, metadata: {}, status: "active", subscription: sub.id,
        current_phase: { start_date: sub.items.data[0].current_period_start } };
      schedules.set(schedule.id, schedule);
      responses.set(idempotencyKey, structuredClone(schedule));
      sub.schedule = schedule.id;
      return structuredClone(schedule);
    };
    stripe.subscriptionSchedules.retrieve = async (id) => structuredClone(schedules.get(id));
    stripe.subscriptionSchedules.update = async (id, params) => {
      const schedule = schedules.get(id);
      assert.equal(schedule.status, "active");
      assert.equal(params.proration_behavior, "none");
      assert.equal(params.phases[0].items[0].price, currentPrice);
      assert.equal(params.phases[0].end_date, i.end);
      assert.equal(params.phases[1].start_date, i.end);
      assert.equal(params.phases[1].items[0].price, targetPrice);
      assert.equal(params.phases[1].duration.interval, targetInterval);
      schedule.metadata = params.metadata;
      return structuredClone(schedule);
    };
    stripe.subscriptionSchedules.release = async (id) => {
      const schedule = schedules.get(id);
      assert.equal(schedule.status, "active");
      Object.assign(schedule, { status: "released", subscription: null, released_subscription: sub.id, current_phase: null });
      sub.schedule = null;
      return structuredClone(schedule);
    };
    for (let repeat = 0; repeat < 3; repeat++) {
      const change = await schedulePremiumPlanChange(u.id, targetInterval);
      assert.equal(change.effectiveAt, new Date(i.end * 1000).toISOString());
      await schedulePremiumPlanChange(u.id, targetInterval); // duplicate request reuses the active schedule
      assert.equal((await prisma.premium_stripe_subscriptions.findUniqueOrThrow({ where: { user_id: u.id } })).scheduled_interval, targetInterval);
      assert.equal(await balance(u.id), 1000);
      // Disabling new annual sales must never block withdrawing an existing change.
      process.env.PREMIUM_ANNUAL_SUBSCRIPTIONS_ENABLED = "false";
      try {
        await schedulePremiumPlanChange(u.id, currentInterval);
        if (currentInterval === "month") {
          await assert.rejects(schedulePremiumPlanChange(u.id, "year"), /unavailable/);
        }
      } finally {
        process.env.PREMIUM_ANNUAL_SUBSCRIPTIONS_ENABLED = "true";
      }
      assert.equal((await prisma.premium_stripe_subscriptions.findUniqueOrThrow({ where: { user_id: u.id } })).scheduled_interval, null);
      assert.equal(sub.schedule, null);
      // Simulate an account that withdrew its change using the old implementation.
      if (repeat === 0) delete sub.metadata.meadtools_premium_previous_schedule;
    }
    assert.equal(schedules.size, 3);
    assert.equal(await balance(u.id), 1000);
  });
}

test("an early manual revocation stops future annual grants without starving later invoices", async () => {
  const u = await user(); const i = await annualInvoice(u);
  await prisma.premium_memberships.update({ where: { user_id_source: { user_id: u.id, source: "stripe" } }, data: { revoked_at: new Date() } });
  await deliverDuePremiumAllowances({ now: new Date(i.end * 1000) });
  assert.equal(await balance(u.id), 1000);
  assert.ok((await prisma.premium_stripe_invoices.findUniqueOrThrow({ where: { invoice_id: i.invoiceId } })).allowances_stopped_at);
});

test("annual payment restrictions pause grants and a resolved restriction allows catch-up", async () => {
  const u = await user(); const i = await annualInvoice(u);
  await prisma.credit_accounts.update({ where: { user_id: u.id }, data: { payment_restricted_at: new Date() } });
  await deliverDuePremiumAllowances({ now: new Date(i.end * 1000) });
  assert.equal(await balance(u.id), 1000);
  await prisma.credit_accounts.update({ where: { user_id: u.id }, data: { payment_restricted_at: null } });
  await deliverDuePremiumAllowances({ now: new Date(i.end * 1000) });
  assert.equal(await balance(u.id), 12000);
});
