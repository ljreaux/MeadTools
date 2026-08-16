import { NextRequest, NextResponse } from "next/server";
import {
  chatAccessErrorResponseSchema,
  chatAccessGrantPathParamsSchema,
  deleteChatAccessGrantResponseSchema,
} from "@meadtools/api-contract/admin";
import { revokeChatBetaAccess } from "@/lib/db/chat-access";
import { verifyAdmin } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Revoke a user's explicit beta invitation. Existing ledger activity remains immutable.
 * @path ChatAccessGrantPathParams
 * @response 200:DeleteChatAccessGrantResponse
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
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ userId: string }> },
) {
  const adminId = await verifyAdmin(request);
  if (adminId instanceof NextResponse) return adminId;
  const parsed = chatAccessGrantPathParamsSchema.safeParse(
    await context.params,
  );
  if (!parsed.success) {
    return NextResponse.json(
      chatAccessErrorResponseSchema.parse({ error: "Invalid user." }),
      { status: 400 },
    );
  }

  try {
    const result = await revokeChatBetaAccess({
      userId: Number(parsed.data.userId),
    });
    return NextResponse.json(deleteChatAccessGrantResponseSchema.parse(result));
  } catch (error) {
    console.error("Unable to revoke chat beta access.", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      chatAccessErrorResponseSchema.parse({
        error: "Unable to revoke chat beta access.",
      }),
      { status: 500 },
    );
  }
}
