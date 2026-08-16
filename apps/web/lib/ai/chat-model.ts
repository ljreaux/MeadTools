export type ChatProvider = "fireworks" | "openai";

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ChatToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ChatToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type ChatFunctionTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatToolChoice =
  | "auto"
  | "none"
  | { type: "function"; function: { name: string } };

export type ChatResponseFormat = {
  type: "json_schema";
  json_schema: {
    name: string;
    schema: Record<string, unknown>;
    strict?: boolean;
  };
};

export type ChatUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
};

export type ChatCompletion = {
  id: string;
  model: string;
  message: Extract<ChatMessage, { role: "assistant" }>;
  usage: ChatUsage;
  finishReason?: string | null;
};

export type ChatCompletionRequest = {
  messages: ChatMessage[];
  tools?: ChatFunctionTool[];
  toolChoice?: ChatToolChoice;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "max";
  responseFormat?: ChatResponseFormat;
  maxOutputTokens: number;
  userId: number;
};

/**
 * Provider adapters translate the shared recipe-agent protocol into their
 * provider API. The workflow never chooses a provider or arbitrary model.
 */
export interface ChatModelClient {
  /** Optional only to keep legacy deterministic test doubles concise. */
  readonly provider?: ChatProvider;
  complete(request: ChatCompletionRequest): Promise<ChatCompletion>;
}

/** An adapter failure that is safe to map to a generic customer-facing retry. */
export class ChatProviderRequestError extends Error {
  constructor(
    readonly provider: ChatProvider,
    readonly status: number,
    readonly details?: {
      type?: string;
      code?: string;
      parameter?: string;
      message?: string;
    },
  ) {
    super(
      `${provider} inference failed with HTTP ${status}.` +
        (details?.message ? ` ${details.message}` : ""),
    );
    this.name = "ChatProviderRequestError";
  }
}
