import { NextRequest, NextResponse } from "next/server";
import { chatAccessStatusResponseSchema } from "@meadtools/api-contract/admin";
import { getLocalChatbotConfig } from "@/lib/ai/chat-config";
import { getChatAccessStatus } from "@/lib/db/chat-access";
import { verifyUser } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Return whether the signed-in user can use the private recipe chatbot.
 * This endpoint intentionally reports a denial instead of failing so the UI
 * can hide private chat affordances without exposing protected chat data.
 * @response 200:ChatAccessStatusResponse
 * @responseSet none
 * @add 401:ChatAccessErrorResponse
 * @auth BearerAuth
 * @tag Chat
 * @openapi
 */
export async function GET(request: NextRequest) {
  const userId = await verifyUser(request);
  if (userId instanceof NextResponse || typeof userId !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getChatAccessStatus(userId);
  return NextResponse.json(
    chatAccessStatusResponseSchema.parse({
      ...status,
      chatEnabled: status.chatEnabled && Boolean(getLocalChatbotConfig()),
    }),
  );
}
