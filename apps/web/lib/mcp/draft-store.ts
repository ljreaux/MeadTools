import "server-only";

import { randomUUID } from "node:crypto";
import {
  decodeDraftHandoff,
  encodeDraftHandoff,
  type DraftHandoff
} from "@meadtools/recipe-workflows/draft-handoff";
import prisma from "@/lib/prisma";
import { isMcpDraftId } from "./draft-link";

const DRAFT_LIFETIME_MS = 24 * 60 * 60 * 1000;

export async function storeMcpDraft(userId: number, draft: DraftHandoff) {
  const payload = encodeDraftHandoff(draft);
  const id = randomUUID();
  const now = new Date();

  // The expiration predicate also protects reads when no new drafts are made.
  await prisma.mcp_draft_handoffs.deleteMany({ where: { expires_at: { lte: now } } });
  await prisma.mcp_draft_handoffs.create({
    data: {
      id,
      user_id: userId,
      payload,
      expires_at: new Date(now.getTime() + DRAFT_LIFETIME_MS)
    }
  });
  return id;
}

export async function loadMcpDraft(userId: number, id: unknown) {
  if (!isMcpDraftId(id)) return null;
  const draft = await prisma.mcp_draft_handoffs.findFirst({
    where: { id, user_id: userId, expires_at: { gt: new Date() } },
    select: { payload: true }
  });
  return draft ? decodeDraftHandoff(draft.payload) : null;
}
