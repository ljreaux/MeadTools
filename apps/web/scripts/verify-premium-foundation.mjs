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
) {
  const subscriptionId = `sub_${u.id}`;
  const invoiceId = `in_${u.id}_${suffix}`;
  const paymentId = `pi_${u.id}_${suffix}`;
  const start = end - 30 * 86400;
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
          current_period_end: end,
          price: {
            id: "price_premium",
            currency: "usd",
            unit_amount: 500,
            recurring: { interval: "month" },
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
    amount_paid: 500,
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
          pricing: { price_details: { price: "price_premium" } },
          currency: "usd",
          quantity: 1,
          amount: 500,
          period: { start, end },
        },
      ],
    },
  };
  return {
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
