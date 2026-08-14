import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { ChatTurnUsage } from "@/lib/ai/chat-service";

/**
 * Stores an audit record before the provider call. Credits, rather than an
 * arbitrary request quota, control a user's ordinary chatbot access.
 */
export async function recordChatbotUsageStart(options: {
  requestId: string;
  userId: number;
  environment: string;
  model: string;
}): Promise<void> {
  await prisma.chatbot_usage_events.create({
    data: {
      request_id: options.requestId,
      user_id: options.userId,
      environment: options.environment,
      model: options.model,
      status: "reserved"
    }
  });
}

export async function completeChatbotUsage(options: {
  requestId: string;
  userId: number;
  usage: ChatTurnUsage;
  status: "completed" | "failed";
  windowAt?: Date;
}): Promise<string | undefined> {
  const now = options.windowAt ?? new Date();
  const hourStart = startOfUtcHour(now);
  const dayStart = startOfUtcDay(now);
  const providerCalls = options.usage.requestIds.length;
  const totalTokens = normalizedTotalTokens(options.usage);
  const providerRequestIds = options.usage.requestIds.length > 0
    ? Prisma.sql`ARRAY[${Prisma.join(options.usage.requestIds)}]::TEXT[]`
    : Prisma.sql`ARRAY[]::TEXT[]`;

  return prisma.$transaction(async (tx) => {
    const usageRows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      UPDATE "chatbot_usage_events"
      SET
        "status" = ${options.status},
        "provider_calls" = ${providerCalls},
        "input_tokens" = ${options.usage.inputTokens},
        "cached_input_tokens" = ${options.usage.cachedInputTokens},
        "output_tokens" = ${options.usage.outputTokens},
        "total_tokens" = ${totalTokens},
        "provider_request_ids" = ${providerRequestIds},
        "completed_at" = NOW()
      WHERE "request_id" = ${options.requestId}::uuid
        AND "status" = 'reserved'
      RETURNING "id"
    `);

    // Completion is intentionally idempotent. A retry after a transient
    // downstream failure must not double-count the same provider turn in the
    // hourly/daily audit windows.
    if (usageRows.length === 0) {
      const existing = await tx.chatbot_usage_events.findUnique({
        where: { request_id: options.requestId },
        select: { id: true }
      });
      return existing?.id;
    }

    for (const window of [
      { window: "hour" as const, windowStart: hourStart },
      { window: "day" as const, windowStart: dayStart }
    ]) {
      await tx.$executeRaw(Prisma.sql`
        INSERT INTO "chatbot_usage_windows" (
          "user_id", "window", "window_start", "request_count",
          "provider_calls", "input_tokens", "cached_input_tokens",
          "output_tokens", "total_tokens"
        ) VALUES (
          ${options.userId}, ${window.window}, ${window.windowStart}, 1,
          ${providerCalls}, ${options.usage.inputTokens},
          ${options.usage.cachedInputTokens}, ${options.usage.outputTokens},
          ${totalTokens}
        )
        ON CONFLICT ("user_id", "window", "window_start") DO UPDATE
        SET
          "request_count" = "chatbot_usage_windows"."request_count" + 1,
          "provider_calls" = "chatbot_usage_windows"."provider_calls" + ${providerCalls},
          "input_tokens" = "chatbot_usage_windows"."input_tokens" + ${options.usage.inputTokens},
          "cached_input_tokens" = "chatbot_usage_windows"."cached_input_tokens" + ${options.usage.cachedInputTokens},
          "output_tokens" = "chatbot_usage_windows"."output_tokens" + ${options.usage.outputTokens},
          "total_tokens" = "chatbot_usage_windows"."total_tokens" + ${totalTokens},
          "updated_at" = NOW()
      `);
    }

    return usageRows[0]?.id;
  });
}

function normalizedTotalTokens(usage: ChatTurnUsage): number {
  return usage.totalTokens > 0
    ? usage.totalTokens
    : usage.inputTokens + usage.outputTokens;
}

function startOfUtcHour(value: Date): Date {
  const result = new Date(value);
  result.setUTCMinutes(0, 0, 0);
  return result;
}

function startOfUtcDay(value: Date): Date {
  const result = new Date(value);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}
