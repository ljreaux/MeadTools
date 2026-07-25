export const DEFAULT_FIREWORKS_MODEL =
  "accounts/fireworks/models/deepseek-v4-flash";
/** Generous only for private, allow-listed evaluation sessions. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 4_000;
export const DEFAULT_MAX_TOOL_CALLS = 6;

export type LocalChatbotConfig = {
  apiKey: string;
  model: string;
  maxOutputTokens: number;
  maxToolCalls: number;
  allowedUserIds: ReadonlySet<number>;
};

/**
 * Local chat remains fail-closed until an operator both enables it and names
 * the authenticated user IDs permitted to incur provider usage.
 */
export function getLocalChatbotConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env
): LocalChatbotConfig | null {
  if (environment.CHATBOT_LOCAL_TEST_ENABLED !== "true") return null;

  const apiKey = environment.FIREWORKS_API_KEY?.trim();
  const allowedUserIds = parseUserIds(environment.CHATBOT_ALLOWED_USER_IDS);
  if (!apiKey || allowedUserIds.size === 0) return null;

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
      DEFAULT_MAX_TOOL_CALLS
    ),
    allowedUserIds
  };
}

function parseUserIds(value: string | undefined): ReadonlySet<number> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isSafeInteger(id) && id > 0)
  );
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
