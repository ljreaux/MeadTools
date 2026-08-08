import { NextRequest, NextResponse } from "next/server";
import {
  chatConversationIdPathParamsSchema,
  chatThreadQuerySchema,
  updateChatConversationRequestBodySchema
} from "@meadtools/api-contract/chat";
import { requireLocalChatbotUser } from "@/lib/ai/chat-access";
import {
  ChatConversationNotFoundError,
  deleteChatConversation,
  getChatThread,
  updateChatConversationState
} from "@/lib/db/chat-conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ conversationId: string }> };

/**
 * Load one private chatbot thread and a page of its visible transcript.
 * @params ChatConversationIdPathParams
 * @params ChatThreadQuery
 * @response 200:ChatConversationThreadResponse
 * @responseSet none
 * @add 400:ChatConversationErrorResponse
 * @add 401:ChatConversationErrorResponse
 * @add 403:ChatConversationErrorResponse
 * @add 404:ChatConversationErrorResponse
 * @add 500:ChatConversationErrorResponse
 * @add 503:ChatConversationErrorResponse
 * @auth BearerAuth
 * @tag Chat
 * @openapi
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const access = await requireLocalChatbotUser(request);
  if (access instanceof NextResponse) return access;
  const path = chatConversationIdPathParamsSchema.safeParse(await context.params);
  const query = chatThreadQuerySchema.safeParse({
    beforeSequence: request.nextUrl.searchParams.get("beforeSequence") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined
  });
  if (!path.success || !query.success) {
    return NextResponse.json({ error: "Invalid chat conversation request." }, { status: 400 });
  }

  try {
    return NextResponse.json(await getChatThread({
      userId: access.userId,
      conversationId: path.data.conversationId,
      ...query.data
    }));
  } catch (error) {
    if (error instanceof ChatConversationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Unable to load chat conversation.", {
      userId: access.userId,
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ error: "Unable to load chat conversation." }, { status: 500 });
  }
}

/**
 * Rename, archive, or restore one private chatbot conversation.
 * @params ChatConversationIdPathParams
 * @body UpdateChatConversationRequestBody
 * @response 200:UpdateChatConversationResponse
 * @responseSet none
 * @add 400:ChatConversationErrorResponse
 * @add 401:ChatConversationErrorResponse
 * @add 403:ChatConversationErrorResponse
 * @add 404:ChatConversationErrorResponse
 * @add 500:ChatConversationErrorResponse
 * @add 503:ChatConversationErrorResponse
 * @auth BearerAuth
 * @tag Chat
 * @openapi
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const access = await requireLocalChatbotUser(request);
  if (access instanceof NextResponse) return access;
  const path = chatConversationIdPathParamsSchema.safeParse(await context.params);
  const body = updateChatConversationRequestBodySchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!path.success || !body.success) {
    return NextResponse.json({ error: "Invalid chat conversation update." }, { status: 400 });
  }

  try {
    const conversation = await updateChatConversationState({
      userId: access.userId,
      conversationId: path.data.conversationId,
      ...body.data
    });
    return NextResponse.json({ conversation });
  } catch (error) {
    if (error instanceof ChatConversationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Unable to update chat conversation.", {
      userId: access.userId,
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ error: "Unable to update chat conversation." }, { status: 500 });
  }
}

/**
 * Permanently delete one private chatbot conversation and its retained draft snapshots.
 * @params ChatConversationIdPathParams
 * @response 200:DeleteChatConversationResponse
 * @responseSet none
 * @add 400:ChatConversationErrorResponse
 * @add 401:ChatConversationErrorResponse
 * @add 403:ChatConversationErrorResponse
 * @add 404:ChatConversationErrorResponse
 * @add 500:ChatConversationErrorResponse
 * @add 503:ChatConversationErrorResponse
 * @auth BearerAuth
 * @tag Chat
 * @openapi
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const access = await requireLocalChatbotUser(request);
  if (access instanceof NextResponse) return access;
  const path = chatConversationIdPathParamsSchema.safeParse(await context.params);
  if (!path.success) {
    return NextResponse.json({ error: "Invalid chat conversation." }, { status: 400 });
  }

  try {
    await deleteChatConversation({
      userId: access.userId,
      conversationId: path.data.conversationId
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof ChatConversationNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Unable to delete chat conversation.", {
      userId: access.userId,
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json({ error: "Unable to delete chat conversation." }, { status: 500 });
  }
}
