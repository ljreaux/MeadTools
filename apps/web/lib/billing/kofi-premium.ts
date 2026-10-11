import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import {
  kofiPaidThrough,
  kofiPaymentIsPremiumEligible,
  PREMIUM_MONTHLY_CHAT_CREDITS,
  type KofiSubscriptionPayment
} from "@meadtools/premium-domain";
import { Prisma } from "@prisma/client";
import {
  recordCreditGrantInTransaction,
  CreditPaymentRestrictedError
} from "@/lib/db/credit-accounting";
import { escapeHtml, sendEmail } from "@/lib/db/emailHelpers";
import prisma from "@/lib/prisma";

export class KofiPremiumUnavailableError extends Error {}
export class KofiLinkConflictError extends Error {}
export class KofiLinkInvalidError extends Error {}

function requiredSecret(
  name: "KOFI_VERIFICATION_TOKEN" | "KOFI_EMAIL_DIGEST_SECRET"
) {
  const value = process.env[name]?.trim();
  if (!value)
    throw new KofiPremiumUnavailableError(`${name} is not configured.`);
  return value;
}

export function verifyKofiWebhookToken(received: string): boolean {
  const expected = requiredSecret("KOFI_VERIFICATION_TOKEN");
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(received), digest(expected));
}

export function kofiEmailDigest(email: string): string {
  return createHmac("sha256", requiredSecret("KOFI_EMAIL_DIGEST_SECRET"))
    .update(email.trim().toLowerCase())
    .digest("hex");
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Stable across webhook retries and duplicate payments in one UTC month. */
export function kofiAllowanceOperation(emailDigest: string, paidAt: Date) {
  const period = paidAt.toISOString().slice(0, 7);
  const hex = createHash("sha256")
    .update(`kofi-premium:${emailDigest}:${period}`)
    .digest("hex")
    .slice(0, 32);
  return {
    period,
    operationId: `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`,
    idempotencyKey: `kofi-premium:${period}:${emailDigest}`
  };
}

export async function recordKofiSubscriptionPayment(
  payment: KofiSubscriptionPayment,
  now = new Date()
) {
  const digest = kofiEmailDigest(payment.email);
  const existing = await prisma.premium_kofi_payments.findUnique({
    where: { message_id: payment.messageId }
  });
  if (existing) {
    if (existing.transaction_id !== payment.transactionId) {
      throw new KofiLinkConflictError("Ko-fi event identity was reused.");
    }
    return applyStoredKofiPayment(existing, now);
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const stored = await tx.premium_kofi_payments.create({
        data: {
          message_id: payment.messageId,
          transaction_id: payment.transactionId,
          email_digest: digest,
          paid_at: payment.paidAt,
          amount_cents: payment.amountCents,
          currency: payment.currency
        }
      });
      const link = await tx.premium_kofi_links.findUnique({
        where: { email_digest: digest }
      });
      if (!link) return { duplicate: false, linked: false };
      const applied = await applyKofiPayment(tx, stored, link, now);
      return { duplicate: false, linked: applied };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate = await prisma.premium_kofi_payments.findFirst({
        where: {
          OR: [
            { message_id: payment.messageId },
            { transaction_id: payment.transactionId }
          ]
        }
      });
      if (
        duplicate?.message_id === payment.messageId &&
        duplicate.transaction_id === payment.transactionId
      ) {
        return applyStoredKofiPayment(duplicate, now);
      }
      throw new KofiLinkConflictError("Ko-fi payment identity was reused.");
    }
    throw error;
  }
}

type StoredKofiPayment = Awaited<
  ReturnType<typeof prisma.premium_kofi_payments.create>
>;
type StoredKofiLink = Awaited<
  ReturnType<typeof prisma.premium_kofi_links.create>
>;

async function applyStoredKofiPayment(payment: StoredKofiPayment, now: Date) {
  if (payment.applied_user_id) return { duplicate: true, linked: true };
  return prisma.$transaction(async (tx) => {
    const link = await tx.premium_kofi_links.findUnique({
      where: { email_digest: payment.email_digest }
    });
    if (!link) return { duplicate: true, linked: false };
    const linked = await applyKofiPayment(tx, payment, link, now);
    return { duplicate: true, linked };
  });
}

async function applyKofiPayment(
  tx: Prisma.TransactionClient,
  payment: StoredKofiPayment,
  link: StoredKofiLink,
  now: Date
): Promise<boolean> {
  if (
    payment.applied_user_id ||
    !kofiPaymentIsPremiumEligible({
      amountCents: payment.amount_cents,
      currency: payment.currency,
      grandfathered: link.grandfathered
    })
  ) {
    return Boolean(payment.applied_user_id);
  }
  const user = await tx.users.findUnique({
    where: { id: link.user_id },
    select: { active: true }
  });
  if (!user?.active) return false;

  const paidThrough = kofiPaidThrough(payment.paid_at);
  const current = await tx.premium_memberships.findUnique({
    where: { user_id_source: { user_id: link.user_id, source: "kofi" } }
  });
  if (!current || current.paid_through < paidThrough) {
    await tx.premium_memberships.upsert({
      where: { user_id_source: { user_id: link.user_id, source: "kofi" } },
      create: {
        user_id: link.user_id,
        source: "kofi",
        external_reference: payment.email_digest,
        paid_through: paidThrough
      },
      update: {
        paid_through: paidThrough,
        revoked_at: null
      }
    });
  }

  if (paidThrough > now) {
    const allowance = kofiAllowanceOperation(
      payment.email_digest,
      payment.paid_at
    );
    try {
      await recordCreditGrantInTransaction(tx, {
        userId: link.user_id,
        operationId: allowance.operationId,
        idempotencyKey: allowance.idempotencyKey,
        creditAmount: PREMIUM_MONTHLY_CHAT_CREDITS,
        metadata: { source: "kofi-premium", period: allowance.period },
        now
      });
    } catch (error) {
      if (error instanceof CreditPaymentRestrictedError) return false;
      throw error;
    }
  }
  await tx.premium_kofi_payments.update({
    where: { id: payment.id },
    data: { applied_user_id: link.user_id, applied_at: now }
  });
  return true;
}

/** Sends proof to the Ko-fi payer address, never trusting account email alone. */
export async function requestKofiAccountLink(options: {
  userId: number;
  email: string;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  const email = options.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    throw new KofiLinkInvalidError("Enter a valid Ko-fi payer email.");
  }
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (!baseUrl || !URL.canParse(baseUrl)) {
    throw new KofiPremiumUnavailableError(
      "Account-link email is not configured."
    );
  }
  const digest = kofiEmailDigest(email);
  const token = randomBytes(32).toString("base64url");
  const challenge = await prisma.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
      where: { id: options.userId },
      select: { active: true }
    });
    if (!user?.active)
      throw new KofiLinkInvalidError("Account is unavailable.");
    const existing = await tx.premium_kofi_links.findUnique({
      where: { user_id: options.userId }
    });
    if (existing)
      throw new KofiLinkConflictError("A Ko-fi account is already linked.");
    const recent = await tx.premium_kofi_link_challenges.count({
      where: {
        user_id: options.userId,
        created_at: { gt: new Date(now.getTime() - 60 * 60_000) }
      }
    });
    if (recent >= 3)
      throw new KofiLinkInvalidError(
        "Too many link requests. Try again later."
      );
    return tx.premium_kofi_link_challenges.create({
      data: {
        user_id: options.userId,
        email_digest: digest,
        token_hash: tokenHash(token),
        expires_at: new Date(now.getTime() + 15 * 60_000)
      }
    });
  });
  const url = new URL("/en/account/premium", baseUrl);
  url.searchParams.set("claim", token);
  await sendEmail({
    to: email,
    fromName: "MeadTools",
    subject: "Link your Ko-fi support to MeadTools",
    text: `To link your Ko-fi support to your MeadTools account, open this link within 15 minutes: ${url.toString()}`,
    html: `<p>To link your Ko-fi support to your MeadTools account, open this link within 15 minutes:</p><p><a href="${escapeHtml(url.toString())}">Link Ko-fi support</a></p>`
  });
  return { expiresAt: challenge.expires_at };
}

export async function claimKofiAccountLink(options: {
  userId: number;
  token: string;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(options.token)) {
    throw new KofiLinkInvalidError("This link is invalid or expired.");
  }
  try {
    return await prisma.$transaction(async (tx) => {
      const challenge = await tx.premium_kofi_link_challenges.findUnique({
        where: { token_hash: tokenHash(options.token) }
      });
      if (
        !challenge ||
        challenge.user_id !== options.userId ||
        challenge.consumed_at ||
        challenge.expires_at <= now
      ) {
        throw new KofiLinkInvalidError("This link is invalid or expired.");
      }
      const claimed = await tx.premium_kofi_link_challenges.updateMany({
        where: { id: challenge.id, consumed_at: null, expires_at: { gt: now } },
        data: { consumed_at: now }
      });
      if (claimed.count !== 1)
        throw new KofiLinkInvalidError("This link has already been used.");
      const existing = await tx.premium_kofi_links.findUnique({
        where: { user_id: options.userId }
      });
      if (existing)
        throw new KofiLinkConflictError("A Ko-fi account is already linked.");
      const cutoffRaw = process.env.PREMIUM_KOFI_GRANDFATHER_CUTOFF?.trim();
      const cutoff = cutoffRaw ? new Date(cutoffRaw) : null;
      if (cutoff && !Number.isFinite(cutoff.getTime())) {
        throw new KofiPremiumUnavailableError(
          "Ko-fi grandfather cutoff is invalid."
        );
      }
      const hadPrelaunchPayment = cutoff
        ? (await tx.premium_kofi_payments.count({
            where: {
              email_digest: challenge.email_digest,
              paid_at: { lt: cutoff }
            }
          })) > 0
        : true;
      const link = await tx.premium_kofi_links.create({
        data: {
          user_id: options.userId,
          email_digest: challenge.email_digest,
          grandfathered: hadPrelaunchPayment
        }
      });
      const recent = await tx.premium_kofi_payments.findMany({
        where: {
          email_digest: challenge.email_digest,
          paid_at: { gte: new Date(now.getTime() - 35 * 24 * 60 * 60_000) }
        },
        orderBy: { paid_at: "desc" },
        take: 4
      });
      for (const payment of recent) {
        await applyKofiPayment(tx, payment, link, now);
      }
      return { linked: true, activePaymentFound: recent.length > 0 };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new KofiLinkConflictError("This Ko-fi address is already linked.");
    }
    throw error;
  }
}
