import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import type { ChatTurnUsage } from "@/lib/ai/chat-service";

type UsageWindow = "hour" | "day";

export type ChatbotUsageLimits = {
  maxRequestsPerHour: number;
  maxRequestsPerDay: number;
  maxTokensPerDay: number;
};

export class ChatbotUsageLimitError extends Error {
  constructor() {
    super("The chatbot usage limit has been reached. Please try again later.");
    this.name = "ChatbotUsageLimitError";
  }
}

export async function reserveChatbotUsage(options: {
  requestId: string;
  userId: number;
  environment: string;
  model: string;
  limits: ChatbotUsageLimits;
  now?: Date;
}): Promise<void> {
  const now = options.now ?? new Date();
  const hourStart = startOfUtcHour(now);
  const dayStart = startOfUtcDay(now);

  await prisma.$transaction(async (tx) => {
    const hourlyReserved = await reserveWindow(tx, {
      userId: options.userId,
      window: "hour",
      windowStart: hourStart,
      maxRequests: options.limits.maxRequestsPerHour
    });
    if (!hourlyReserved) throw new ChatbotUsageLimitError();

    const dailyReserved = await reserveWindow(tx, {
      userId: options.userId,
      window: "day",
      windowStart: dayStart,
      maxRequests: options.limits.maxRequestsPerDay,
      maxTokens: options.limits.maxTokensPerDay
    });
    if (!dailyReserved) throw new ChatbotUsageLimitError();

    await tx.$executeRaw(Prisma.sql`
      INSERT INTO "chatbot_usage_events" (
        "request_id", "user_id", "environment", "model", "status"
      ) VALUES (
        ${options.requestId}::uuid,
        ${options.userId},
        ${options.environment},
        ${options.model},
        'reserved'
      )
    `);
  });
}

export async function completeChatbotUsage(options: {
  requestId: string;
  userId: number;
  usage: ChatTurnUsage;
  status: "completed" | "failed";
  windowAt?: Date;
}): Promise<void> {
  const now = options.windowAt ?? new Date();
  const hourStart = startOfUtcHour(now);
  const dayStart = startOfUtcDay(now);
  const providerCalls = options.usage.requestIds.length;
  const totalTokens = normalizedTotalTokens(options.usage);
  const providerRequestIds = options.usage.requestIds.length > 0
    ? Prisma.sql`ARRAY[${Prisma.join(options.usage.requestIds)}]::TEXT[]`
    : Prisma.sql`ARRAY[]::TEXT[]`;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`
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
    `);

    for (const window of [
      { window: "hour" as const, windowStart: hourStart },
      { window: "day" as const, windowStart: dayStart }
    ]) {
      await tx.$executeRaw(Prisma.sql`
        UPDATE "chatbot_usage_windows"
        SET
          "provider_calls" = "provider_calls" + ${providerCalls},
          "input_tokens" = "input_tokens" + ${options.usage.inputTokens},
          "cached_input_tokens" = "cached_input_tokens" + ${options.usage.cachedInputTokens},
          "output_tokens" = "output_tokens" + ${options.usage.outputTokens},
          "total_tokens" = "total_tokens" + ${totalTokens},
          "updated_at" = NOW()
        WHERE
          "user_id" = ${options.userId}
          AND "window" = ${window.window}
          AND "window_start" = ${window.windowStart}
      `);
    }
  });
}

async function reserveWindow(
  tx: Prisma.TransactionClient,
  options: {
    userId: number;
    window: UsageWindow;
    windowStart: Date;
    maxRequests: number;
    maxTokens?: number;
  }
): Promise<boolean> {
  const maxTokens = options.maxTokens ?? 2_147_483_647;
  const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO "chatbot_usage_windows" (
      "user_id", "window", "window_start", "request_count"
    ) VALUES (
      ${options.userId}, ${options.window}, ${options.windowStart}, 1
    )
    ON CONFLICT ("user_id", "window", "window_start") DO UPDATE
    SET
      "request_count" = "chatbot_usage_windows"."request_count" + 1,
      "updated_at" = NOW()
    WHERE
      "chatbot_usage_windows"."request_count" < ${options.maxRequests}
      AND "chatbot_usage_windows"."total_tokens" < ${maxTokens}
    RETURNING "id"
  `);
  return rows.length === 1;
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
