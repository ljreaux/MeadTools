import { NextRequest, NextResponse } from "next/server";
import { premiumCheckoutResponseSchema, premiumCheckoutRequestBodySchema } from "@meadtools/api-contract/premium";
import {
  createPremiumStripeCheckout,
  PremiumSubscriptionConflictError,
  PremiumSubscriptionUnavailableError,
} from "@/lib/billing/stripe-premium";
import { arePremiumSubscriptionsAvailable } from "@/lib/billing/premium-subscription-config";
import { verifyUser } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Create a premium Stripe Checkout Session for the selected billing interval.
 * @body PremiumCheckoutRequestBody
 * @response 200:PremiumCheckoutResponse
 * @responseSet none
 * @add 401:PremiumErrorResponse
 * @add 400:PremiumErrorResponse
 * @add 403:PremiumErrorResponse
 * @add 409:PremiumErrorResponse
 * @add 503:PremiumErrorResponse
 * @add 500:PremiumErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
export async function POST(request: NextRequest) {
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }
  if (!arePremiumSubscriptionsAvailable()) {
    return NextResponse.json({ error: "Premium subscriptions are unavailable" }, { status: 503 });
  }
  try {
    const text = await request.text();
    let body: unknown;
    try { body = text ? JSON.parse(text) : {}; } catch { return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 }); }
    const parsed = premiumCheckoutRequestBodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
    const origin = request.nextUrl.origin;
    const result = await createPremiumStripeCheckout({
      userId,
      interval: parsed.data.interval,
      successUrl: new URL("/account/premium?checkout=success", origin).toString(),
      cancelUrl: new URL("/account/premium?checkout=cancelled", origin).toString(),
    });
    return NextResponse.json(premiumCheckoutResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof PremiumSubscriptionConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof PremiumSubscriptionUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Unable to create premium checkout.", {
      userId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Unable to create premium checkout" }, { status: 500 });
  }
}
