import { NextRequest, NextResponse } from "next/server";
import { verifyUser } from "@/lib/userAccessFunctions";
import { getCreditBalance } from "@/lib/db/credit-accounting";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Return the signed-in user's available prepaid prompt credits.
 * @response 200:CreditBalanceResponse
 * @responseSet none
 * @add 401:CreditAccountErrorResponse
 * @add 500:CreditAccountErrorResponse
 * @auth BearerAuth
 * @tag Account
 * @openapi
 */
export async function GET(request: NextRequest) {
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const balance = await getCreditBalance(userId);
    return NextResponse.json({ availableCredits: balance.availableCredits });
  } catch (error) {
    console.error("Unable to load credit balance.", {
      userId,
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ error: "Unable to load credit balance." }, { status: 500 });
  }
}
