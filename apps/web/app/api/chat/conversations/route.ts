import { NextRequest, NextResponse } from "next/server";
import {
  chatConversationListQuerySchema,
  createChatConversationRequestBodySchema
} from "@meadtools/api-contract/chat";
import { requireLocalChatbotUser } from "@/lib/ai/chat-access";
import {
  createChatConversation,
  listChatConversations
} from "@/lib/db/chat-conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * List private, non-expired chatbot conversation summaries for the signed-in user.
 * @params ChatConversationListQuery
 * @response 200:ChatConversationsResponse
 * @responseSet none
 * @add 400:ChatConversationErrorResponse
 * @add 401:ChatConversationErrorResponse
 * @add 403:ChatConversationErrorResponse
 * @add 500:ChatConversationErrorResponse
 * @add 503:ChatConversationErrorResponse
 * @auth BearerAuth
 * @tag Chat
 * @openapi
 */
export async function GET(request: NextRequest) {
  const access = await requireLocalChatbotUser(request);
  if (access instanceof NextResponse) return access;

  const parsed = chatConversationListQuerySchema.safeParse({
    state: request.nextUrl.searchParams.get("state") ?? undefined,
    query: request.nextUrl.searchParams.get("query") ?? undefined,
    before: request.nextUrl.searchParams.get("before") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chat conversation query." }, { status: 400 });
  }

  try {
    return NextResponse.json(await listChatConversations({
      userId: access.userId,
      ...(parsed.data.state ? { state: parsed.data.state } : {}),
      ...(parsed.data.query ? { query: parsed.data.query } : {}),
      ...(parsed.data.limit ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.before ? { before: new Date(parsed.data.before) } : {})
    }));
  } catch (error) {
    console.error("Unable to list chat conversations.", {
      userId: access.userId,
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ error: "Unable to load chat conversations." }, { status: 500 });
  }
}

/**
 * Create an empty, private chatbot conversation for the signed-in user.
 * @body CreateChatConversationRequestBody
 * @response 201:CreateChatConversationResponse
 * @responseSet none
 * @add 400:ChatConversationErrorResponse
 * @add 401:ChatConversationErrorResponse
 * @add 403:ChatConversationErrorResponse
 * @add 500:ChatConversationErrorResponse
 * @add 503:ChatConversationErrorResponse
 * @auth BearerAuth
 * @tag Chat
 * @openapi
 */
export async function POST(request: NextRequest) {
  const access = await requireLocalChatbotUser(request);
  if (access instanceof NextResponse) return access;

  const body = await request.json().catch(() => null);
  const parsed = createChatConversationRequestBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid chat conversation." }, { status: 400 });
  }

  try {
    const conversation = await createChatConversation({
      userId: access.userId,
      title: parsed.data.title
    });
    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error("Unable to create chat conversation.", {
      userId: access.userId,
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ error: "Unable to create chat conversation." }, { status: 500 });
  }
}
