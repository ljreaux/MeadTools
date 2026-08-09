import "server-only";

import { randomUUID } from "crypto";
import { chat_access_mode } from "@prisma/client";
import prisma from "@/lib/prisma";
import { recordCreditGrant } from "@/lib/db/credit-accounting";

export type ChatAccessMode = "beta_allowlist" | "all_active_users";

export type ChatAccessStatus = {
  mode: ChatAccessMode;
  chatEnabled: boolean;
  granted: boolean;
  paymentRestricted: boolean;
};

export async function getChatAccessStatus(userId: number): Promise<ChatAccessStatus> {
  const [settings, user] = await Promise.all([
    prisma.chat_access_settings.findUnique({ where: { id: true }, select: { mode: true } }),
    prisma.users.findUnique({
      where: { id: userId },
      select: {
        active: true,
        chat_access_grant: { select: { revoked_at: true } },
        credit_account: { select: { payment_restricted_at: true } }
      }
    })
  ]);
  const mode = settings?.mode ?? chat_access_mode.beta_allowlist;
  const granted = user?.chat_access_grant?.revoked_at === null;
  const paymentRestricted = Boolean(user?.credit_account?.payment_restricted_at);
  return {
    mode,
    chatEnabled: Boolean(user?.active) && !paymentRestricted && (mode === chat_access_mode.all_active_users || granted),
    granted,
    paymentRestricted
  };
}

export async function getChatAccessAdministration() {
  const [settings, grants] = await Promise.all([
    prisma.chat_access_settings.findUnique({ where: { id: true }, select: { mode: true, updated_at: true } }),
    prisma.chat_access_grants.findMany({
      where: { revoked_at: null },
      select: { user_id: true, granted_at: true, granted_by_user_id: true },
      orderBy: { granted_at: "desc" }
    })
  ]);
  return {
    mode: settings?.mode ?? chat_access_mode.beta_allowlist,
    updatedAt: settings?.updated_at ?? null,
    grants: grants.map((grant) => ({
      userId: grant.user_id,
      grantedAt: grant.granted_at,
      grantedByUserId: grant.granted_by_user_id
    }))
  };
}

export async function setChatAccessMode(options: {
  mode: ChatAccessMode;
  updatedByUserId: number;
}) {
  return prisma.chat_access_settings.upsert({
    where: { id: true },
    create: { id: true, mode: options.mode, updated_by_user_id: options.updatedByUserId },
    update: { mode: options.mode, updated_by_user_id: options.updatedByUserId }
  });
}

/**
 * Grants beta chat access. Credits are intentionally separate so an operator
 * can choose the beta allocation and make later adjustments independently.
 */
export async function grantChatBetaAccess(options: {
  userId: number;
  grantedByUserId: number;
  now?: Date;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.users.findUnique({
      where: { id: options.userId },
      select: { active: true }
    });
    if (!user?.active) throw new ChatAccessUserUnavailableError();

    const existing = await tx.chat_access_grants.findUnique({
      where: { user_id: options.userId },
      select: { id: true, revoked_at: true }
    });
    if (existing?.revoked_at === null) {
      return { granted: false };
    }

    await tx.chat_access_grants.upsert({
      where: { user_id: options.userId },
      create: {
        user_id: options.userId,
        granted_by_user_id: options.grantedByUserId,
        granted_at: options.now
      },
      update: {
        granted_by_user_id: options.grantedByUserId,
        granted_at: options.now,
        revoked_at: null
      }
    });
    return { granted: true };
  });
}

/** Records an operator-issued chat credit allocation without changing access. */
export async function grantChatEvaluationCredits(options: {
  userId: number;
  grantedByUserId: number;
  creditAmount: number;
  now?: Date;
}) {
  const user = await prisma.users.findUnique({
    where: { id: options.userId },
    select: { active: true }
  });
  if (!user?.active) throw new ChatAccessUserUnavailableError();

  return recordCreditGrant({
    userId: options.userId,
    operationId: randomUUID(),
    idempotencyKey: `chat-admin-credit-grant:${randomUUID()}`,
    creditAmount: options.creditAmount,
    metadata: {
      purpose: "chat evaluation credits",
      grantedByUserId: options.grantedByUserId
    },
    now: options.now
  });
}

export async function revokeChatBetaAccess(options: { userId: number; now?: Date }) {
  const result = await prisma.chat_access_grants.updateMany({
    where: { user_id: options.userId, revoked_at: null },
    data: { revoked_at: options.now ?? new Date() }
  });
  return { revoked: result.count > 0 };
}

export class ChatAccessUserUnavailableError extends Error {
  constructor() {
    super("Only active users can receive chat beta access.");
    this.name = "ChatAccessUserUnavailableError";
  }
}
