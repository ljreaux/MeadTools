/** Run manually against the local development database after db:push. */
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";
import {
  kofiEmailDigest,
  recordKofiSubscriptionPayment,
} from "../lib/billing/kofi-premium";
import { getPremiumAccessStatus } from "../lib/db/premium-access";
import { getChatAccessStatus } from "../lib/db/chat-access";

const id = randomUUID();
const payerEmail = `premium-fixture-${id}@example.invalid`;
const paymentIds = [`fixture-${id}-1`, `fixture-${id}-2`];
const originalSecret = process.env.KOFI_EMAIL_DIGEST_SECRET;
const originalRollout = process.env.PREMIUM_ACCESS_ENABLED;
process.env.KOFI_EMAIL_DIGEST_SECRET = randomBytes(32).toString("hex");
process.env.PREMIUM_ACCESS_ENABLED = "true";
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
if (!accessTokenSecret) throw new Error("Local access-token configuration is missing.");

async function checkLocalApi(path: string, accessToken: string) {
  const response = await fetch(`http://localhost:3000${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  assert.equal(
    response.status,
    200,
    `${path} should accept the fixture account (${String(payload.error ?? "unknown error")})`,
  );
  return payload;
}

let userId: number | null = null;
try {
  const user = await prisma.users.create({ data: { email: payerEmail } });
  userId = user.id;
  const paidAt = new Date();
  const payment = {
    verificationToken: "fixture-only",
    messageId: paymentIds[0],
    transactionId: paymentIds[0],
    paidAt,
    email: payerEmail,
    amountCents: 300,
    currency: "usd",
  };

  assert.deepEqual(await recordKofiSubscriptionPayment(payment), {
    duplicate: false,
    linked: false,
  });
  await prisma.premium_kofi_links.create({
    data: {
      user_id: user.id,
      email_digest: kofiEmailDigest(payerEmail),
      grandfathered: true,
    },
  });
  assert.deepEqual(await recordKofiSubscriptionPayment(payment), {
    duplicate: true,
    linked: true,
  });
  process.env.PREMIUM_ACCESS_ENABLED = "false";
  assert.equal((await getPremiumAccessStatus(user.id)).premiumEnabled, false);
  assert.equal((await getChatAccessStatus(user.id)).chatEnabled, false);
  process.env.PREMIUM_ACCESS_ENABLED = "true";
  assert.equal((await getPremiumAccessStatus(user.id)).premiumEnabled, true);
  assert.equal((await getChatAccessStatus(user.id)).chatEnabled, true);
  const accessToken = jwt.sign({ id: user.id }, accessTokenSecret, { expiresIn: "5m" });
  const premiumResponse = await checkLocalApi("/api/account/premium", accessToken);
  assert.equal(premiumResponse.premiumEnabled, true);
  assert.equal(premiumResponse.kofiLinked, true);
  assert.equal(premiumResponse.monthlyPriceCents, 500);
  assert.equal(premiumResponse.mcpEnabled, false);
  assert.equal((await checkLocalApi("/api/chat/access", accessToken)).chatEnabled, true);

  assert.deepEqual(await recordKofiSubscriptionPayment({
    ...payment,
    messageId: paymentIds[1],
    transactionId: paymentIds[1],
    paidAt: new Date(paidAt.getTime() + 60_000),
  }), { duplicate: false, linked: true });
  const account = await prisma.credit_accounts.findUniqueOrThrow({
    where: { user_id: user.id },
  });
  const grants = await prisma.credit_ledger_entries.findMany({
    where: { account_id: account.id },
  });
  assert.equal(grants.length, 1);
  assert.equal(grants[0].credits_delta, 1000);

  await prisma.credit_accounts.update({
    where: { id: account.id },
    data: { payment_restricted_at: new Date(), payment_restriction_reason: "fixture" },
  });
  assert.equal((await getPremiumAccessStatus(user.id)).premiumEnabled, false);
  assert.equal((await getChatAccessStatus(user.id)).chatEnabled, false);
  assert.equal((await checkLocalApi("/api/account/premium", accessToken)).premiumEnabled, false);
  assert.equal((await checkLocalApi("/api/chat/access", accessToken)).chatEnabled, false);
  console.log("Premium local database verification passed.");
} finally {
  if (userId !== null) {
    await prisma.premium_kofi_payments.deleteMany({ where: { message_id: { in: paymentIds } } });
    await prisma.premium_memberships.deleteMany({ where: { user_id: userId } });
    await prisma.premium_kofi_links.deleteMany({ where: { user_id: userId } });
    const account = await prisma.credit_accounts.findUnique({ where: { user_id: userId } });
    if (account) {
      await prisma.credit_ledger_entries.deleteMany({ where: { account_id: account.id } });
      await prisma.credit_accounts.delete({ where: { id: account.id } });
    }
    await prisma.users.delete({ where: { id: userId } });
  }
  if (originalSecret === undefined) delete process.env.KOFI_EMAIL_DIGEST_SECRET;
  else process.env.KOFI_EMAIL_DIGEST_SECRET = originalSecret;
  if (originalRollout === undefined) delete process.env.PREMIUM_ACCESS_ENABLED;
  else process.env.PREMIUM_ACCESS_ENABLED = originalRollout;
  await prisma.$disconnect();
}
