import { NextRequest, NextResponse } from "next/server";
import {
  premiumAccessResponseSchema,
} from "@meadtools/api-contract/premium";
import { PREMIUM_MONTHLY_CHAT_CREDITS, PREMIUM_MONTHLY_PRICE_CENTS } from "@meadtools/premium-domain";
import { getPremiumAccessStatus } from "@/lib/db/premium-access";
import { arePremiumSubscriptionsAvailable } from "@/lib/billing/premium-subscription-config";
import { isMcpRolloutEnabled } from "@/lib/mcp/access";
import prisma from "@/lib/prisma";
import { verifyUser } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function kofiJoinUrl(): string | null {
  if (process.env.PREMIUM_SUBSCRIPTIONS_ENABLED !== "true") return null;
  const configured = process.env.PREMIUM_KOFI_JOIN_URL?.trim();
  if (!configured || !URL.canParse(configured)) return null;
  const url = new URL(configured);
  return url.protocol === "https:" && url.hostname === "ko-fi.com" ? url.toString() : null;
}

/**
 * Return account premium status and the planned bundle details.
 * @response 200:PremiumAccessResponse
 * @responseSet none
 * @add 401:PremiumErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
export async function GET(request: NextRequest) {
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [status, link, stripeLink] = await Promise.all([
    getPremiumAccessStatus(userId),
    prisma.premium_kofi_links.findUnique({
      where: { user_id: userId },
      select: { user_id: true },
    }),
    prisma.premium_stripe_subscriptions.findUnique({
      where: { user_id: userId },
      select: { user_id: true },
    }),
  ]);
  return NextResponse.json(
    premiumAccessResponseSchema.parse({
      entitled: status.entitled,
      premiumEnabled: status.premiumEnabled,
      source: status.source,
      paidThrough: status.paidThrough?.toISOString() ?? null,
      paymentRestricted: status.paymentRestricted,
      kofiLinked: Boolean(link),
      stripeLinked: Boolean(stripeLink),
      monthlyPriceCents: PREMIUM_MONTHLY_PRICE_CENTS,
      monthlyChatCredits: PREMIUM_MONTHLY_CHAT_CREDITS,
      subscriptionsEnabled: arePremiumSubscriptionsAvailable(),
      kofiJoinUrl: kofiJoinUrl(),
      mcpEnabled: status.premiumEnabled && isMcpRolloutEnabled(),
    }),
  );
}
