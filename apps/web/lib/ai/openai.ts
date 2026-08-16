import { z } from "zod";
import { ChatProviderRequestError } from "./chat-model";
import type {
  ChatCompletion,
  ChatCompletionRequest,
  ChatModelClient,
  ChatToolCall,
} from "./chat-model";

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const OPENAI_REQUEST_TIMEOUT_MS = 60_000;

const toolCallSchema = z.object({
  id: z.string().min(1),
  type: z.literal("function"),
  function: z.object({
    name: z.string().min(1),
    arguments: z.string(),
  }),
});

const completionSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable().optional(),
        message: z.object({
          role: z.literal("assistant"),
          content: z.string().nullable().optional(),
          tool_calls: z.array(toolCallSchema).optional(),
        }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
      total_tokens: z.number().int().nonnegative().optional(),
      prompt_tokens_details: z
        .object({ cached_tokens: z.number().int().nonnegative().optional() })
        .optional(),
    })
    .optional(),
});

const errorResponseSchema = z.object({
  error: z
    .object({
      message: z.string().optional(),
      type: z.string().optional(),
      code: z.union([z.string(), z.number()]).nullable().optional(),
      param: z.string().nullable().optional(),
    })
    .optional(),
});

/**
 * Direct OpenAI transport for the shared, OpenAI-compatible chat/tool loop.
 * It deliberately does not retry a completion: a failed request is surfaced
 * to the caller so credit settlement cannot hide a duplicate model charge.
 */
export class OpenAIChatClient implements ChatModelClient {
  readonly provider = "openai" as const;

  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      fetcher?: typeof fetch;
    },
  ) {}

  async complete(request: ChatCompletionRequest): Promise<ChatCompletion> {
    const response = await (this.options.fetcher ?? fetch)(
      OPENAI_CHAT_COMPLETIONS_URL,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          messages: request.messages,
          tools: request.tools,
          // OpenAI accepts tool_choice only alongside a tools array. A title
          // request is deliberately tool-free, so omit both fields there.
          ...(request.tools?.length
            ? {
                tool_choice: request.toolChoice ?? "auto",
                parallel_tool_calls: false,
              }
            : {}),
          ...openAIReasoningEffort(request.reasoningEffort),
          ...(request.responseFormat
            ? { response_format: request.responseFormat }
            : {}),
          max_completion_tokens: request.maxOutputTokens,
          store: false,
        }),
        signal: AbortSignal.timeout(OPENAI_REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      throw await openAIRequestError(response);
    }

    const parsed = completionSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("OpenAI returned an unexpected chat completion shape.");
    }

    const choice = parsed.data.choices[0];
    return {
      id: parsed.data.id,
      model: parsed.data.model,
      message: {
        role: "assistant",
        content: choice.message.content ?? null,
        tool_calls: choice.message.tool_calls as ChatToolCall[] | undefined,
      },
      usage: {
        inputTokens: parsed.data.usage?.prompt_tokens ?? 0,
        outputTokens: parsed.data.usage?.completion_tokens ?? 0,
        totalTokens: parsed.data.usage?.total_tokens ?? 0,
        cachedInputTokens:
          parsed.data.usage?.prompt_tokens_details?.cached_tokens ?? 0,
      },
      finishReason: choice.finish_reason,
    };
  }
}

async function openAIRequestError(
  response: Response,
): Promise<ChatProviderRequestError> {
  const parsed = errorResponseSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  const error = parsed.success ? parsed.data.error : undefined;
  return new ChatProviderRequestError("openai", response.status, {
    ...(error?.type ? { type: error.type } : {}),
    ...(error?.code !== null && error?.code !== undefined
      ? { code: String(error.code) }
      : {}),
    ...(error?.param ? { parameter: error.param } : {}),
    ...(error?.message
      ? { message: redactProviderErrorMessage(error.message) }
      : {}),
  });
}

function redactProviderErrorMessage(message: string): string {
  return message
    .replace(/(?:sk|rk|sess)-[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 500);
}

function openAIReasoningEffort(
  effort: ChatCompletionRequest["reasoningEffort"],
): Record<string, "none" | "low" | "medium" | "high"> {
  if (!effort) return {};
  return { reasoning_effort: effort === "max" ? "high" : effort };
}
