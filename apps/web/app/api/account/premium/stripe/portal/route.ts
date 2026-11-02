import { NextRequest, NextResponse } from "next/server";
import { premiumPortalResponseSchema } from "@meadtools/api-contract/premium";
import {
  createPremiumStripePortal,
  PremiumSubscriptionUnavailableError,
} from "@/lib/billing/stripe-premium";
import { verifyUser } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Open Stripe Billing Portal for an account's linked premium subscription.
 * @response 200:PremiumPortalResponse
 * @responseSet none
 * @add 401:PremiumErrorResponse
 * @add 403:PremiumErrorResponse
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
  try {
    const result = await createPremiumStripePortal({
      userId,
      returnUrl: new URL("/account/premium", request.nextUrl.origin).toString(),
    });
    return NextResponse.json(premiumPortalResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof PremiumSubscriptionUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Unable to open premium billing portal.", {
      userId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Unable to open billing portal" }, { status: 500 });
  }
}
