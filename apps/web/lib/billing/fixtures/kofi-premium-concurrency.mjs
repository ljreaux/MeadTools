import assert from "node:assert/strict";
import prisma from "../../prisma.ts";
import { recordKofiSubscriptionPayment } from "../kofi-premium.ts";

// Offline transaction model: account row locks serialize transactions. Without
// the lock, both reads see the same membership and the older write finishes last.
let membership = { paid_through: new Date("2026-10-15T00:00:00Z") };
let accountLock = Promise.resolve();
let reads = 0;
let releaseReads;
const bothRead = new Promise((resolve) => { releaseReads = resolve; });
let releaseNewer;
const newerCommitted = new Promise((resolve) => { releaseNewer = resolve; });
const grants = new Map();
const payments = new Map();
prisma.premium_kofi_payments.findUnique = async () => null;
prisma.$transaction = async (execute) => {
  let unlock;
  let locked = false;
  let appliedPayment;
  const tx = new Proxy({
    $queryRaw: async (query) => {
      const sql = Array.isArray(query) ? query.join("") : query.sql;
      if (sql.includes("FROM users") && sql.includes("FOR UPDATE")) {
        const previous = accountLock;
        accountLock = new Promise((resolve) => { unlock = resolve; });
        await previous;
        locked = true;
        return [{ id: 42 }];
      }
      if (sql.includes('INSERT INTO "credit_accounts"')) return [{ id: "account" }];
      if (sql.includes('SUM("credits_delta")')) return [{ balance: BigInt(grants.size * 1_000) }];
      throw new Error(`Unmocked SQL: ${sql}`);
    },
    users: { findUnique: async () => ({ active: true }) },
    premium_kofi_links: { findUnique: async () => ({ user_id: 42, grandfathered: false }) },
    premium_kofi_payments: {
      create: async ({ data }) => ({ id: data.message_id, ...data, applied_user_id: null }),
      update: async ({ where, data }) => { payments.set(where.id, data); appliedPayment = where.id; },
    },
    premium_memberships: {
      findUnique: async () => {
        const snapshot = structuredClone(membership);
        if (!locked) {
          if (++reads === 2) releaseReads();
          await bothRead;
        }
        return snapshot;
      },
      upsert: async ({ update }) => {
        if (!locked && update.paid_through.toISOString().startsWith("2026-11-05")) {
          await newerCommitted;
        }
        membership = { ...membership, ...update };
      },
    },
    credit_ledger_entries: {
      findUnique: async ({ where }) => grants.get(where.account_id_idempotency_key.idempotency_key) ?? null,
      create: async ({ data }) => { grants.set(data.idempotency_key, data); },
    },
  }, { get(target, key) {
    if (!(key in target)) throw new Error(`Unmocked transaction operation: ${String(key)}`);
    return target[key];
  } });
  try { return await execute(tx); }
  finally {
    unlock?.();
    if (appliedPayment === "payment-10") releaseNewer();
  }
};
const payment = (day) => ({
  messageId: `payment-${day}`, transactionId: `transaction-${day}`,
  email: "fixture@example.invalid", paidAt: new Date(`2026-10-${day}T00:00:00Z`),
  amountCents: 500, currency: "usd",
});
await Promise.all(["01", "10"].map((day) =>
  recordKofiSubscriptionPayment(payment(day), new Date("2026-10-12T00:00:00Z")),
));
assert.equal(membership.paid_through.toISOString(), "2026-11-14T00:00:00.000Z");
assert.equal(payments.size, 2, "both payments must be applied");
assert.equal(grants.size, 1, "same-month payments must grant only one allowance");
await prisma.$disconnect();
