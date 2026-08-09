import { NextRequest, NextResponse } from "next/server";
import {
  chatAccessErrorResponseSchema,
  createChatAccessGrantRequestBodySchema,
  createChatAccessGrantResponseSchema
} from "@meadtools/api-contract/admin";
import {
  ChatAccessUserUnavailableError,
  grantChatBetaAccess
} from "@/lib/db/chat-access";
import { verifyAdmin } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Grant an active user private chatbot access. Credit allocations are a
 * separate, explicit administrative action.
 * @body CreateChatAccessGrantRequestBody
 * @response 200:CreateChatAccessGrantResponse
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
  const parsed = createChatAccessGrantRequestBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(chatAccessErrorResponseSchema.parse({ error: "A valid user is required." }), { status: 400 });
  }

  try {
    const result = await grantChatBetaAccess({ userId: parsed.data.userId, grantedByUserId: adminId });
    return NextResponse.json(createChatAccessGrantResponseSchema.parse(result));
  } catch (error) {
    if (error instanceof ChatAccessUserUnavailableError) {
      return NextResponse.json(chatAccessErrorResponseSchema.parse({ error: error.message }), { status: 400 });
    }
    console.error("Unable to grant chat beta access.", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(chatAccessErrorResponseSchema.parse({ error: "Unable to grant chat beta access." }), { status: 500 });
  }
}
