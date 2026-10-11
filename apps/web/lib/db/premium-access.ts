import "server-only";

import { resolvePremiumAccess } from "@meadtools/premium-domain";
import prisma from "@/lib/prisma";

/** A single account-level decision reused by hosted chat and MCP adapters. */
export async function getPremiumAccessStatus(userId: number, now = new Date()) {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: {
      active: true,
      credit_account: { select: { payment_restricted_at: true } },
      premium_memberships: {
        select: { source: true, paid_through: true, revoked_at: true },
      },
    },
  });
  const membership = resolvePremiumAccess(
    (user?.premium_memberships ?? [])
      .filter((item) =>
        item.source === "kofi" || item.source === "stripe" || item.source === "manual",
      )
      .map((item) => ({
        source: item.source as "kofi" | "stripe" | "manual",
        paidThrough: item.paid_through,
        revokedAt: item.revoked_at,
      })),
    now,
  );
  const paymentRestricted = Boolean(user?.credit_account?.payment_restricted_at);
  return {
    ...membership,
    activeUser: Boolean(user?.active),
    paymentRestricted,
    premiumEnabled:
      process.env.PREMIUM_ACCESS_ENABLED === "true" &&
      Boolean(user?.active) && membership.entitled && !paymentRestricted,
  };
}
