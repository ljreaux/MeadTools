import "server-only";

import prisma from "@/lib/prisma";

const MAX_CALLS_PER_MINUTE = 60;
const MAX_CONCURRENT_CALLS = 2;
const TOOL_TIMEOUT_MS = 25_000;
const LEASE_LIFETIME_MS = 35_000;

export class McpToolLimitError extends Error {}

async function acquireLease(userId: number) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    // Serialize admission across Vercel instances for this account.
    await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(438::integer, ${userId}::integer)`;
    await tx.mcp_tool_leases.deleteMany({
      where: { user_id: userId, expires_at: { lte: now } },
    });
    const active = await tx.mcp_tool_leases.count({ where: { user_id: userId } });
    if (active >= MAX_CONCURRENT_CALLS) {
      throw new McpToolLimitError("Too many concurrent MCP tool calls. Try again shortly.");
    }
    const bucket = await tx.mcp_rate_buckets.findUnique({ where: { user_id: userId } });
    const resetWindow = !bucket || bucket.window_start.getTime() <= now.getTime() - 60_000;
    if (!resetWindow && bucket.call_count >= MAX_CALLS_PER_MINUTE) {
      throw new McpToolLimitError("MCP call limit reached. Try again in a minute.");
    }
    await tx.mcp_rate_buckets.upsert({
      where: { user_id: userId },
      create: { user_id: userId, window_start: now, call_count: 1 },
      update: resetWindow
        ? { window_start: now, call_count: 1 }
        : { call_count: { increment: 1 } },
    });
    return tx.mcp_tool_leases.create({
      data: { user_id: userId, expires_at: new Date(now.getTime() + LEASE_LIFETIME_MS) },
      select: { id: true },
    });
  });
}

/** Bounded execution and metadata-only recording for a single protected tool call. */
export async function executeLimitedMcpTool<T extends { status: string }>(
  userId: number,
  toolName: string,
  execute: () => Promise<T>,
): Promise<T> {
  const lease = await acquireLease(userId);
  const started = Date.now();
  let resultClass = "error";
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      execute(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("MCP tool execution timed out.")), TOOL_TIMEOUT_MS);
      }),
    ]);
    resultClass = result.status.slice(0, 40);
    return result;
  } catch (error) {
    if (error instanceof Error && error.message.includes("timed out")) resultClass = "timeout";
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    // The underlying operation may still be settling after a timeout. Keep its
    // short lease until expiry so another request cannot take its slot at once.
    if (resultClass !== "timeout") {
      await prisma.mcp_tool_leases.deleteMany({ where: { id: lease.id } });
    }
    await prisma.mcp_tool_usage.create({ data: {
      user_id: userId,
      tool_name: toolName,
      result_class: resultClass,
      duration_ms: Math.min(Date.now() - started, 2_147_483_647),
    } });
  }
}
