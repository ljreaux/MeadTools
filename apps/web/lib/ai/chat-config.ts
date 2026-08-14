export const DEFAULT_FIREWORKS_MODEL =
  "accounts/fireworks/models/deepseek-v4-flash";
/** Generous only for private evaluator sessions. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4_000;
export const DEFAULT_MAX_TOOL_CALLS = 7;
/** A turn may use tools, but cannot run an unbounded provider loop. */
// A full recipe draft can legitimately use the compact ingredient, additive,
// yeast, plan, calculation, and draft tools before it produces its final
// response. Leave room for that final response without making the loop
// unbounded.
export const DEFAULT_MAX_PROVIDER_CALLS = 10;
/** Bounds combined model output across tool calls and the final response. */
export const DEFAULT_MAX_TOTAL_OUTPUT_TOKENS = 8_000;
/** Limits the serialized provider context for every completion request. */
export const DEFAULT_MAX_PROVIDER_INPUT_CHARACTERS = 60_000;
/** Stops a turn once cumulative provider-reported token usage becomes excessive. */
export const DEFAULT_MAX_TOTAL_PROVIDER_TOKENS = 60_000;

export type LocalChatbotConfig = {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  maxToolCalls: number;
  maxProviderCalls: number;
  maxTotalOutputTokens: number;
  maxProviderInputCharacters: number;
  maxTotalProviderTokens: number;
  usageEnvironment: string;
};

/**
 * Chat remains fail-closed until an operator enables it and configures a
 * provider key. Per-user entitlement is enforced by the database-backed chat
 * access policy, so it can be audited and managed from the admin panel.
 */
export function getLocalChatbotConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env
): LocalChatbotConfig | null {
  if (environment.CHATBOT_LOCAL_TEST_ENABLED !== "true") return null;

  const apiKey = environment.FIREWORKS_API_KEY?.trim();
  if (!apiKey) return null;

  return {
    apiKey,
    model:
      environment.CHATBOT_FIREWORKS_MODEL?.trim() || DEFAULT_FIREWORKS_MODEL,
    maxOutputTokens: parseBoundedInteger(
      environment.CHATBOT_MAX_OUTPUT_TOKENS,
      DEFAULT_MAX_OUTPUT_TOKENS,
      128,
      8_000
    ),
    maxToolCalls: parseBoundedInteger(
      environment.CHATBOT_MAX_TOOL_CALLS,
      DEFAULT_MAX_TOOL_CALLS,
      1,
      8
    ),
    maxProviderCalls: parseBoundedInteger(
      environment.CHATBOT_MAX_PROVIDER_CALLS,
      DEFAULT_MAX_PROVIDER_CALLS,
      1,
      12
    ),
    maxTotalOutputTokens: parseBoundedInteger(
      environment.CHATBOT_MAX_TOTAL_OUTPUT_TOKENS,
      DEFAULT_MAX_TOTAL_OUTPUT_TOKENS,
      256,
      12_000
    ),
    maxProviderInputCharacters: parseBoundedInteger(
      environment.CHATBOT_MAX_PROVIDER_INPUT_CHARACTERS,
      DEFAULT_MAX_PROVIDER_INPUT_CHARACTERS,
      8_000,
      80_000
    ),
    maxTotalProviderTokens: parseBoundedInteger(
      environment.CHATBOT_MAX_TOTAL_PROVIDER_TOKENS,
      DEFAULT_MAX_TOTAL_PROVIDER_TOKENS,
      8_000,
      100_000
    ),
    usageEnvironment: parseUsageEnvironment(
      environment.CHATBOT_USAGE_ENVIRONMENT ?? environment.VERCEL_ENV ?? "local"
    )
  };
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

function parseUsageEnvironment(value: string): string {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9_-]{1,32}$/.test(normalized) ? normalized : "local";
}
