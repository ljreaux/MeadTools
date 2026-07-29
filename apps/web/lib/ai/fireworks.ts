import { z } from "zod";

const FIREWORKS_INFERENCE_URL =
  "https://api.fireworks.ai/inference/v1/chat/completions";
const FIREWORKS_REQUEST_TIMEOUT_MS = 60_000;

const toolCallSchema = z.object({
  id: z.string().min(1),
  type: z.literal("function"),
  function: z.object({
    name: z.string().min(1),
    arguments: z.string()
  })
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
          tool_calls: z.array(toolCallSchema).optional()
        })
      })
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number().int().nonnegative().optional(),
      completion_tokens: z.number().int().nonnegative().optional(),
      total_tokens: z.number().int().nonnegative().optional(),
      prompt_tokens_details: z
        .object({ cached_tokens: z.number().int().nonnegative().optional() })
        .optional()
    })
    .optional()
});

export type FireworksMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: FireworksToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type FireworksToolCall = z.infer<typeof toolCallSchema>;

export type FireworksFunctionTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type FireworksToolChoice =
  | "auto"
  | "none"
  | { type: "function"; function: { name: string } };

export type FireworksUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedInputTokens: number;
};

export type FireworksCompletion = {
  id: string;
  model: string;
  message: Extract<FireworksMessage, { role: "assistant" }>;
  usage: FireworksUsage;
  finishReason?: string | null;
};

export type FireworksCompletionRequest = {
  messages: FireworksMessage[];
  tools?: FireworksFunctionTool[];
  toolChoice?: FireworksToolChoice;
  maxOutputTokens: number;
  userId: number;
};

export interface ChatModelClient {
  complete(request: FireworksCompletionRequest): Promise<FireworksCompletion>;
}

export class FireworksChatClient implements ChatModelClient {
  constructor(
    private readonly options: {
      apiKey: string;
      model: string;
      annotations?: { project: string; environment: string };
      fetcher?: typeof fetch;
    }
  ) {}

  async complete(
    request: FireworksCompletionRequest
  ): Promise<FireworksCompletion> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await (this.options.fetcher ?? fetch)(
          FIREWORKS_INFERENCE_URL,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${this.options.apiKey}`,
              "content-type": "application/json",
              ...(this.options.annotations
                ? {
                    "fireworks-annotations": `team=meadtools,project=${this.options.annotations.project},environment=${this.options.annotations.environment}`
                  }
                : {})
            },
            body: JSON.stringify({
              model: this.options.model,
              messages: request.messages,
              tools: request.tools,
              tool_choice: request.toolChoice ?? "auto",
              parallel_tool_calls: false,
              temperature: 0.2,
              max_tokens: request.maxOutputTokens,
              user: String(request.userId)
            }),
            signal: AbortSignal.timeout(FIREWORKS_REQUEST_TIMEOUT_MS)
          }
        );

        if (!response.ok) {
          throw new Error(`Fireworks inference failed with HTTP ${response.status}.`);
        }

        const parsed = completionSchema.safeParse(await response.json());
        if (!parsed.success) {
          throw new Error("Fireworks returned an unexpected chat completion shape.");
        }

        const choice = parsed.data.choices[0];
        return {
          id: parsed.data.id,
          model: parsed.data.model,
          message: {
            role: "assistant",
            content: choice.message.content ?? null,
            tool_calls: choice.message.tool_calls
          },
          usage: {
            inputTokens: parsed.data.usage?.prompt_tokens ?? 0,
            outputTokens: parsed.data.usage?.completion_tokens ?? 0,
            totalTokens: parsed.data.usage?.total_tokens ?? 0,
            cachedInputTokens:
              parsed.data.usage?.prompt_tokens_details?.cached_tokens ?? 0
          },
          finishReason: choice.finish_reason
        };
      } catch (error) {
        lastError = error;
        if (attempt === 0 && isRetryableFireworksError(error)) continue;
        throw error;
      }
    }
    throw lastError;
  }

}

function isRetryableFireworksError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    /timeout|aborted/i.test(error.message) ||
    /Fireworks inference failed with HTTP (408|429|5\d\d)\./.test(error.message)
  );
}
