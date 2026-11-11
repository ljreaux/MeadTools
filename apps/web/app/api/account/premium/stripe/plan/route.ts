import { NextRequest, NextResponse } from "next/server";
import { premiumPlanChangeRequestBodySchema, premiumPlanChangeResponseSchema } from "@meadtools/api-contract/premium";
import { verifyUser } from "@/lib/userAccessFunctions";
import { schedulePremiumPlanChange } from "@/lib/billing/premium-plan-change";
import { PremiumSubscriptionConflictError, PremiumSubscriptionUnavailableError } from "@/lib/billing/stripe-premium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Schedule a Premium billing interval change at the end of the current paid period.
 * @body PremiumPlanChangeRequestBody
 * @response 200:PremiumPlanChangeResponse
 * @responseSet none
 * @add 400:PremiumErrorResponse
 * @add 401:PremiumErrorResponse
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
  if (userId instanceof NextResponse || typeof userId !== "number") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const parsed = premiumPlanChangeRequestBodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
  try {
    return NextResponse.json(premiumPlanChangeResponseSchema.parse(await schedulePremiumPlanChange(userId, parsed.data.interval)));
  } catch (error) {
    if (error instanceof PremiumSubscriptionConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof PremiumSubscriptionUnavailableError) return NextResponse.json({ error: error.message }, { status: 503 });
    console.error("Unable to schedule premium plan change.", { userId, error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Unable to change billing interval" }, { status: 500 });
  }
}
