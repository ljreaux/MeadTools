import { NextRequest, NextResponse } from "next/server";
import {
  creditActivityQuerySchema,
  creditActivityResponseSchema,
} from "@meadtools/api-contract/credits";
import { getCreditBalance } from "@/lib/db/credit-accounting";
import {
  InvalidCreditActivityCursorError,
  getCreditActivityPage,
} from "@/lib/db/credit-history";
import { verifyUser } from "@/lib/userAccessFunctions";
import { canUserPurchaseCredits } from "@/lib/billing/credit-purchase-config";
import { getChatbotConfig } from "@/lib/ai/chat-config";
import { getChatAccessStatus } from "@/lib/db/chat-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Return grouped prepaid-credit activity for the signed-in user's wallet.
 * @params CreditActivityQuery
 * @response 200:CreditActivityResponse
 * @responseSet none
 * @add 400:CreditAccountErrorResponse
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

  const parsed = creditActivityQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid credit history query." },
      { status: 400 },
    );
  }

  try {
    const [balance, activity, access] = await Promise.all([
      getCreditBalance(userId),
      getCreditActivityPage({ userId, ...parsed.data }),
      getChatAccessStatus(userId),
    ]);
    return NextResponse.json(
      creditActivityResponseSchema.parse({
        availableCredits: balance.availableCredits,
        purchasesEnabled: canUserPurchaseCredits(
          access.chatEnabled,
          Boolean(getChatbotConfig()),
        ),
        activities: activity.activities.map((item) => ({
          ...item,
          occurredAt: item.occurredAt.toISOString(),
        })),
        nextCursor: activity.nextCursor,
      }),
    );
  } catch (error) {
    if (
      error instanceof InvalidCreditActivityCursorError ||
      error instanceof RangeError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Unable to load credit history.", {
      userId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { error: "Unable to load credit history." },
      { status: 500 },
    );
  }
}
