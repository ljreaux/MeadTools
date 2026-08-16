import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { getChatbotConfig } from "./chat-config";
import { verifyUser } from "@/lib/userAccessFunctions";
import { getChatAccessStatus } from "@/lib/db/chat-access";

/** Ensures a configured chatbot request also has database-backed access. */
export async function requireChatbotUser(
  request: NextRequest,
): Promise<{ userId: number } | NextResponse> {
  const authenticatedUser = await verifyUser(request);
  if (authenticatedUser instanceof NextResponse) return authenticatedUser;
  if (typeof authenticatedUser !== "number") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getChatbotConfig();
  if (!config) {
    return NextResponse.json(
      { error: "The recipe assistant is not currently available." },
      { status: 503 },
    );
  }
  const status = await getChatAccessStatus(authenticatedUser);
  if (!status.chatEnabled) {
    return NextResponse.json(
      { error: "This user is not permitted to use the recipe chatbot." },
      { status: 403 },
    );
  }
  return { userId: authenticatedUser };
}
