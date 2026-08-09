import { NextRequest, NextResponse } from "next/server";
import { getChatContextOptions } from "@/lib/ai/chat-account-context";
import { requireLocalChatbotUser } from "@/lib/ai/chat-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Return picker-safe summaries of records owned by the authenticated local
 * chatbot evaluator user. Full recipe/brew data is fetched only after a
 * selected identifier is re-authorized by the chat turn route.
 *
 * @response 200:ChatContextOptionsResponse
 * @responseSet none
 * @add 401:ChatContextErrorResponse
 * @add 403:ChatContextErrorResponse
 * @add 500:ChatContextErrorResponse
 * @add 503:ChatContextErrorResponse
 * @auth BearerAuth
 * @tag Chat
 * @openapi
 */
export async function GET(request: NextRequest) {
  const access = await requireLocalChatbotUser(request);
  if (access instanceof NextResponse) return access;

  try {
    return NextResponse.json(
      { contexts: await getChatContextOptions(access.userId) },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unable to load chatbot context options.", {
      userId: access.userId,
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      { error: "Unable to load recipe and brew context." },
      { status: 500 }
    );
  }
}
