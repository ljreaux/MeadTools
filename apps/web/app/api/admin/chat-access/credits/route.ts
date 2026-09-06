import { NextRequest, NextResponse } from "next/server";
import {
  chatAccessErrorResponseSchema,
  createChatCreditGrantRequestBodySchema,
  createChatCreditGrantResponseSchema,
} from "@meadtools/api-contract/admin";
import {
  ChatAccessUserUnavailableError,
  grantChatEvaluationCredits,
} from "@/lib/db/chat-access";
import { verifyAdmin } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Add an arbitrary positive prompt-credit allocation to an active user's
 * immutable ledger without granting or changing chatbot access.
 * @body CreateChatCreditGrantRequestBody
 * @response 200:CreateChatCreditGrantResponse
 * @responseSet none
 * @add 400:ChatAccessErrorResponse
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 404:AdminAuthErrorResponse
 * @add 500:ChatAccessErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
export async function POST(request: NextRequest) {
  const adminId = await verifyAdmin(request);
  if (adminId instanceof NextResponse) return adminId;
  const parsed = createChatCreditGrantRequestBodySchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      chatAccessErrorResponseSchema.parse({
        error: "A valid user and credit amount are required.",
      }),
      { status: 400 },
    );
  }

  try {
    const credit = await grantChatEvaluationCredits({
      userId: parsed.data.userId,
      creditAmount: parsed.data.creditAmount,
      grantedByUserId: adminId,
    });
    return NextResponse.json(
      createChatCreditGrantResponseSchema.parse({
        creditsGranted: parsed.data.creditAmount,
        availableCredits: credit.availableCredits,
      }),
    );
  } catch (error) {
    if (
      error instanceof ChatAccessUserUnavailableError ||
      error instanceof RangeError
    ) {
      return NextResponse.json(
        chatAccessErrorResponseSchema.parse({ error: error.message }),
        { status: 400 },
      );
    }
    console.error("Unable to grant chat credits.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      chatAccessErrorResponseSchema.parse({
        error: "Unable to grant chat credits.",
      }),
      { status: 500 },
    );
  }
}
