import { z } from "zod";
import { ChatProviderRequestError } from "./chat-model";
import type {
  ChatCompletion,
  ChatCompletionRequest,
  ChatModelClient,
  ChatToolCall,
} from "./chat-model";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const OPENAI_REQUEST_TIMEOUT_MS = 60_000;

const responseOutputItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    role: z.literal("assistant"),
    content: z.array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
      }).passthrough(),
    ),
  }),
  z.object({
    type: z.literal("function_call"),
    call_id: z.string().min(1),
    name: z.string().min(1),
    arguments: z.string(),
  }),
  z.object({ type: z.literal("reasoning") }).passthrough(),
]);

const responseSchema = z.object({
  id: z.string().min(1),
  model: z.string().min(1),
  status: z.string().optional(),
  incomplete_details: z
    .object({ reason: z.string().nullable().optional() })
    .nullable()
    .optional(),
  output: z.array(responseOutputItemSchema),
  usage: z
    .object({
      input_tokens: z.number().int().nonnegative().optional(),
      output_tokens: z.number().int().nonnegative().optional(),
      total_tokens: z.number().int().nonnegative().optional(),
      input_tokens_details: z
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
 * Direct OpenAI Responses transport for the shared chat/tool loop.
 *
 * GPT-5.4 reasoning models support their current tool-use behavior through
 * Responses. The shared protocol remains provider-neutral, so the workflow
 * and credit accounting continue to receive one normalized completion per
 * provider dispatch.
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
      OPENAI_RESPONSES_URL,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          input: responseInputFromMessages(request.messages),
          tools: request.tools?.map((tool) => ({
            type: "function" as const,
            name: tool.function.name,
            description: tool.function.description,
            parameters: tool.function.parameters,
          })),
          // Responses accepts tool_choice only alongside a tools array. A
          // title request is deliberately tool-free, so omit both fields.
          ...(request.tools?.length
            ? {
                tool_choice: responseToolChoice(request.toolChoice),
                parallel_tool_calls: false,
              }
            : {}),
          ...openAIReasoningEffort(request.reasoningEffort),
          ...(request.responseFormat ? { text: responseText(request) } : {}),
          max_output_tokens: request.maxOutputTokens,
          store: false,
        }),
        signal: AbortSignal.timeout(OPENAI_REQUEST_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      throw await openAIRequestError(response);
    }

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error("OpenAI returned an unexpected Responses API shape.");
    }

    const toolCalls = parsed.data.output.flatMap((item) =>
      item.type === "function_call"
        ? [
            {
              id: item.call_id,
              type: "function" as const,
              function: { name: item.name, arguments: item.arguments },
            },
          ]
        : [],
    );
    const content = parsed.data.output
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content)
      .flatMap((item) =>
        item.type === "output_text" && item.text ? [item.text] : [],
      )
      .join("\n")
      .trim();
    if (!content && toolCalls.length === 0) {
      throw new Error("OpenAI Responses API returned no message or tool call.");
    }
    return {
      id: parsed.data.id,
      model: parsed.data.model,
      message: {
        role: "assistant",
        content: content || null,
        tool_calls:
          toolCalls.length > 0 ? (toolCalls as ChatToolCall[]) : undefined,
      },
      usage: {
        inputTokens: parsed.data.usage?.input_tokens ?? 0,
        outputTokens: parsed.data.usage?.output_tokens ?? 0,
        totalTokens: parsed.data.usage?.total_tokens ?? 0,
        cachedInputTokens:
          parsed.data.usage?.input_tokens_details?.cached_tokens ?? 0,
      },
      finishReason:
        parsed.data.status === "incomplete" &&
        parsed.data.incomplete_details?.reason === "max_output_tokens"
          ? "length"
          : parsed.data.status,
    };
  }
}

type ResponseInputItem =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      type: "function_call";
      call_id: string;
      name: string;
      arguments: string;
    }
  | { type: "function_call_output"; call_id: string; output: string };

function responseInputFromMessages(
  request: ChatCompletionRequest["messages"],
): ResponseInputItem[] {
  const input: ResponseInputItem[] = [];
  for (const message of request) {
    if (message.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: message.tool_call_id,
        output: message.content,
      });
      continue;
    }
    if (message.role === "assistant" && message.tool_calls?.length) {
      if (message.content) {
        input.push({ role: "assistant", content: message.content });
      }
      for (const toolCall of message.tool_calls) {
        input.push({
          type: "function_call",
          call_id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
        });
      }
      continue;
    }
    if (message.role === "assistant") {
      if (message.content) {
        input.push({ role: "assistant", content: message.content });
      }
      continue;
    }
    input.push({ role: message.role, content: message.content });
  }
  return input;
}

function responseToolChoice(request: ChatCompletionRequest["toolChoice"]) {
  if (
    !request ||
    request === "auto" ||
    request === "none" ||
    request === "required"
  )
    return request ?? "auto";
  return { type: "function" as const, name: request.function.name };
}

function responseText(request: ChatCompletionRequest) {
  const format = request.responseFormat;
  if (!format) return undefined;
  return {
    format: {
      type: format.type,
      name: format.json_schema.name,
      schema: format.json_schema.schema,
      ...(format.json_schema.strict !== undefined
        ? { strict: format.json_schema.strict }
        : {}),
    },
  };
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
): Record<string, { effort: "none" | "low" | "medium" | "high" }> {
  if (!effort) return {};
  return { reasoning: { effort: effort === "max" ? "high" : effort } };
}
