import { NextRequest, NextResponse } from "next/server";
import { getLocalChatbotConfig } from "@/lib/ai/chat-config";
import { getChatContextOptions } from "@/lib/ai/chat-account-context";
import { verifyUser } from "@/lib/userAccessFunctions";

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
  const authenticatedUser = await verifyUser(request);
  if (authenticatedUser instanceof NextResponse) return authenticatedUser;
  if (typeof authenticatedUser !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getLocalChatbotConfig();
  if (!config) {
    return NextResponse.json(
      { error: "Local chatbot testing is not configured." },
      { status: 503 }
    );
  }
  if (!config.allowedUserIds.has(authenticatedUser)) {
    return NextResponse.json(
      { error: "This user is not permitted to use the local chatbot." },
      { status: 403 }
    );
  }

  try {
    return NextResponse.json(
      { contexts: await getChatContextOptions(authenticatedUser) },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unable to load chatbot context options.", {
      userId: authenticatedUser,
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      { error: "Unable to load recipe and brew context." },
      { status: 500 }
    );
  }
}
