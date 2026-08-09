import { NextRequest, NextResponse } from "next/server";
import {
  chatAccessAdministrationResponseSchema,
  chatAccessErrorResponseSchema,
  updateChatAccessAdministrationRequestBodySchema
} from "@meadtools/api-contract/admin";
import {
  getChatAccessAdministration,
  setChatAccessMode
} from "@/lib/db/chat-access";
import { verifyAdmin } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Return the private-chat rollout policy and active beta invitations.
 * @response 200:ChatAccessAdministrationResponse
 * @responseSet none
 * @add 401:AdminAuthErrorResponse
 * @add 403:AdminAuthErrorResponse
 * @add 404:AdminAuthErrorResponse
 * @add 500:ChatAccessErrorResponse
 * @auth BearerAuth
 * @tag Admin
 * @openapi
 */
export async function GET(request: NextRequest) {
  const adminId = await verifyAdmin(request);
  if (adminId instanceof NextResponse) return adminId;

  try {
    const administration = await getChatAccessAdministration();
    return NextResponse.json(chatAccessAdministrationResponseSchema.parse({
      ...administration,
      updatedAt: administration.updatedAt?.toISOString() ?? null,
      grants: administration.grants.map((grant) => ({
        ...grant,
        grantedAt: grant.grantedAt.toISOString()
      }))
    }));
  } catch (error) {
    console.error("Unable to load chat access administration.", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(chatAccessErrorResponseSchema.parse({ error: "Unable to load chat access settings." }), { status: 500 });
  }
}

/**
 * Change whether chatbot access is restricted to beta grants or available to
 * every active MeadTools user.
 * @body UpdateChatAccessAdministrationRequestBody
 * @response 200:ChatAccessAdministrationResponse
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
export async function PATCH(request: NextRequest) {
  const adminId = await verifyAdmin(request);
  if (adminId instanceof NextResponse) return adminId;
  const parsed = updateChatAccessAdministrationRequestBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(chatAccessErrorResponseSchema.parse({ error: "Invalid chat access mode." }), { status: 400 });
  }

  try {
    await setChatAccessMode({ mode: parsed.data.mode, updatedByUserId: adminId });
    const administration = await getChatAccessAdministration();
    return NextResponse.json(chatAccessAdministrationResponseSchema.parse({
      ...administration,
      updatedAt: administration.updatedAt?.toISOString() ?? null,
      grants: administration.grants.map((grant) => ({ ...grant, grantedAt: grant.grantedAt.toISOString() }))
    }));
  } catch (error) {
    console.error("Unable to update chat access administration.", { error: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json(chatAccessErrorResponseSchema.parse({ error: "Unable to update chat access settings." }), { status: 500 });
  }
}
