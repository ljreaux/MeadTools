import assert from "node:assert/strict";
import test from "node:test";
import type Stripe from "stripe";
import { resumePremiumCheckout, type CheckoutAttempt } from "./premium-checkout-reservation";

function fixture() {
  let sequence = 0;
  let current: CheckoutAttempt | null = null;
  let creates = 0;
  const sessions = new Map<string, Stripe.Checkout.Session>();
  const attempt = (): CheckoutAttempt => ({ attempt_id: String(++sequence), params: { mode: "subscription", success_url: "https://example.com/success" }, session_id: null, created_at: new Date() });
  const deps = {
    reserve: async () => current ??= attempt(),
    replace: async (id: string) => { if (current?.attempt_id === id) current = attempt(); },
    save: async (id: string, sessionId: string) => { if (current?.attempt_id === id) current.session_id = sessionId; },
    create: async (params: Stripe.Checkout.SessionCreateParams, key: string) => {
      assert.deepEqual(params, current?.params);
      let session = sessions.get(key);
      if (!session) {
        creates++;
        session = { id: key, status: "open", url: `https://checkout.stripe.com/${key}`, subscription: null } as Stripe.Checkout.Session;
        sessions.set(key, session);
      }
      return session;
    },
    retrieve: async (id: string) => sessions.get(id)!,
    completedSubscriptionCanBeReplaced: async () => false,
  };
  return { deps, sessions, creates: () => creates, current: () => current! };
}

test("simultaneous tabs reuse one persisted attempt and one Stripe session", async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 20 }, () => resumePremiumCheckout(f.deps)));
  assert.equal(new Set(results.map((r) => r.url)).size, 1);
  assert.equal(f.creates(), 1);
  await resumePremiumCheckout(f.deps);
  assert.equal(f.creates(), 1);
});

test("a lost Stripe response retries the same frozen request and idempotency key", async () => {
  const f = fixture();
  const create = f.deps.create;
  let loseResponse = true;
  f.deps.create = async (...args) => {
    const session = await create(...args);
    if (loseResponse) { loseResponse = false; throw new Error("connection lost"); }
    return session;
  };
  await assert.rejects(resumePremiumCheckout(f.deps));
  await resumePremiumCheckout(f.deps);
  assert.equal(f.creates(), 1);
});

test("expired attempts rotate atomically but completed payment waits for reconciliation", async () => {
  const f = fixture();
  await resumePremiumCheckout(f.deps);
  f.sessions.get(f.current().session_id!)!.status = "expired";
  await Promise.all(Array.from({ length: 10 }, () => resumePremiumCheckout(f.deps)));
  assert.equal(f.creates(), 2);
  const session = f.sessions.get(f.current().session_id!)!;
  session.status = "complete";
  session.subscription = "sub_pending_webhook";
  await assert.rejects(resumePremiumCheckout(f.deps), /already complete/);
  assert.equal(f.creates(), 2);
  f.deps.completedSubscriptionCanBeReplaced = async () => true;
  await resumePremiumCheckout(f.deps);
  assert.equal(f.creates(), 3);
});

test("ambiguous requests past Stripe idempotency retention fail closed", async () => {
  const f = fixture();
  await f.deps.reserve();
  f.current().created_at = new Date(Date.now() - 24 * 60 * 60_000);
  await assert.rejects(resumePremiumCheckout(f.deps), /reconcile/);
  assert.equal(f.creates(), 0);
});
