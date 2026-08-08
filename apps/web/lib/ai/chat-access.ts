import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getLocalChatbotConfig } from "./chat-config";
import { verifyUser } from "@/lib/userAccessFunctions";

/** The evaluator remains private while chat persistence is being built. */
export async function requireLocalChatbotUser(
  request: NextRequest
): Promise<{ userId: number } | NextResponse> {
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
  return { userId: authenticatedUser };
}
