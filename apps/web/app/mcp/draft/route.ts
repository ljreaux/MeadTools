import { NextRequest, NextResponse } from "next/server";
import { loadMcpDraft } from "@/lib/mcp/draft-store";
import { verifyUser } from "@/lib/userAccessFunctions";

export const runtime = "nodejs";

function draftResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" }
  });
}

// Browser handoff only. The MCP bearer and the draft ID alone grant no access.
export async function POST(request: NextRequest) {
  const userId = await verifyUser(request);
  if (typeof userId !== "number") {
    return draftResponse({ error: "Sign in to open this draft." }, 401);
  }

  const id: unknown = await request.json().catch(() => null);
  try {
    const draft = await loadMcpDraft(userId, id);
    return draft
      ? draftResponse(draft, 200)
      : draftResponse({ error: "Draft unavailable." }, 404);
  } catch {
    return draftResponse({ error: "Draft unavailable." }, 500);
  }
}
