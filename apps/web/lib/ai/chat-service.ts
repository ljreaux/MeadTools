import { DEFAULT_MAX_TOTAL_PROVIDER_TOKENS } from "./chat-config";
import {
  executeHostedAgentTool,
  hostedAgentPolicy,
  isExplicitlyUnrelatedBrewingRequest,
  brewActionTargetFromAccountRead,
  isMcpAccountReadTool,
  type AccountReadAdapter,
  hostedAgentToolDefinitions,
  type AdditiveLookup,
  type IngredientLookup,
  type YeastLookup,
} from "@meadtools/recipe-agent";
import {
  buildRecipeDraftInputSchema,
  type BuildRecipeDraftInput,
} from "@meadtools/recipe-workflows";
import { CHAT_PROVIDER_HISTORY_MESSAGES, type ChatAnswerEvent, type ChatToolProgressDetail, describeChatToolProgress } from "@meadtools/chat-domain";
import { recipeDataV2Schema, type RecipeDataV2 } from "@meadtools/schemas";
import type { WikiFetcher } from "@meadtools/wiki-knowledge";
import { z } from "zod";
import type { SelectedChatContext } from "./chat-account-context";
import {
  assistantCapabilitiesAnswer,
  isAssistantCapabilitiesRequest,
} from "./chat-capabilities";
import type {
  ChatProvider,
  ChatModelClient,
  ChatCompletion,
  ChatFunctionTool,
  ChatMessage,
  ChatToolCall,
  ChatUsage,
} from "./chat-model";

export const chatRequestSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(4_000),
        }),
      )
      .min(1)
      .max(CHAT_PROVIDER_HISTORY_MESSAGES),
    activeRecipeData: recipeDataV2Schema.optional(),
    recipeDraftInput: buildRecipeDraftInputSchema.optional(),
  })
  .strict()
  .refine((request) => request.messages.at(-1)?.role === "user", {
    message: "The latest chat message must be from the user.",
    path: ["messages"],
  });

export type ChatRequest = z.infer<typeof chatRequestSchema> & {
  /**
   * Loaded only by the authenticated route from a user-selected ID. It is not
   * part of the client-controlled request schema.
   */
  selectedAccountContext?: SelectedChatContext;
};

export type ChatToolEvent =
  | { type: "tool_call"; toolName: string; detail?: ChatToolProgressDetail }
  | { type: "tool_result"; toolName: string; status: string; detail?: ChatToolProgressDetail };

export type ChatTurnEvent = ChatToolEvent | ChatAnswerEvent;

export type ChatTurnUsage = ChatUsage & {
  provider: ChatProvider;
  model: string;
  requestIds: string[];
  toolCalls: number;
  latencyMs: number;
};

export type ChatTurnResult = {
  answer: string;
  toolResults: Array<{ toolName: string; result: unknown }>;
  recipeDraftInput?: BuildRecipeDraftInput;
  /** The brewer explicitly discarded the active draft for this conversation. */
  clearRecipeDraft?: boolean;
  usage: ChatTurnUsage;
};

/**
 * Resolve the narrow, provider-free answers before the route reserves credits.
 * These checks must stay shared with `runChatTurn` so callers cannot disagree
 * about whether a first turn can safely avoid a provider request.
 */
export function runDeterministicChatTurn(options: {
  request: ChatRequest;
  provider: ChatProvider;
  startedAt?: number;
}): ChatTurnResult | undefined {
  const startedAt = options.startedAt ?? performance.now();
  const { request, provider } = options;
  const result = (
    answer: string,
    model: string,
    options?: { clearRecipeDraft?: boolean },
  ): ChatTurnResult => ({
    answer,
    toolResults: [],
    ...(options?.clearRecipeDraft
      ? { clearRecipeDraft: true }
      : { recipeDraftInput: request.recipeDraftInput }),
    usage: {
      ...emptyUsage(),
      provider,
      model,
      toolCalls: 0,
      latencyMs: Math.round(performance.now() - startedAt),
    },
  });
  if (isAssistantCapabilitiesRequest(request.messages.at(-1)?.content ?? "")) {
    return result(assistantCapabilitiesAnswer, "deterministic-capabilities");
  }
  if (isRecipeDraftResetRequest(request)) {
    return result(
      "I’ve cleared the active recipe draft for this chat. Tell me what you’d like to make next.",
      "deterministic-draft-reset",
      { clearRecipeDraft: true },
    );
  }
  if (!isMeadScopedRequest(request)) {
    return result(outOfScopeAnswer, "deterministic-scope-check");
  }
  return undefined;
}

export class ChatSafetyLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatSafetyLimitError";
  }
}

const outOfScopeAnswer =
  "I can help with MeadTools, mead recipes, and mead-brewing process questions. What would you like to make or troubleshoot?";

const meadScopePattern =
  /\b(?:mead|melomel|cyser|pyment|metheglin|bochet|braggot|recipes?|fruit\s+wine|honey|must|ferment(?:ation|ing|ed)?|yeast|nutrient|fermaid|go[\s-]?ferm|dap|yan|hydrometer|refractometer|gravity|og|fg|abv|brix|p\s*\.?\s*h|back[\s-]?sweeten(?:ing|ed)?|stabili[sz](?:e|ed|ing|ation)|sulf(?:ite|ur)|sorbate|k[\s-]?meta|campden|racking|rack(?:ed|ing)?|carboy|airlock|pitch(?:ing|ed)?|brew(?:s|ing|ed)?|fruit|primary|secondary|clearing|clarif(?:y|ication)|fining|cold[\s-]?crash(?:ing)?|saniti[sz](?:e|ing|ation)|saved\s+recipes?|vanilla\s+bean|priming\s+sugar|carbonat(?:e|ion)|bottl(?:e|ing)|bench\s+trials?|blend(?:ing)?|met|metwein|rezept|honig|hefe|nährstoff|naehrstoff|gär(?:en|ung|t)?|most|stabilisier(?:en|ung|t)?|sulfit|sorbat|abfüll(?:en|ung)|karbonisier(?:en|ung))\b/i;

// A "traditional" is established mead shorthand, but the word alone is too
// broad to treat as domain context. Allow it only when the user is clearly
// asking to create or brew a recipe.
const traditionalMeadRecipeIntentPattern =
  /\b(?:let'?s\s+)?(?:make|build|create|draft|design|brew)\b[\s\S]{0,80}\btraditional\b/i;

const ambiguousMeadStarterPattern =
  /^(?:what|how)\s+(?:do|should)\s+i\s+need\s+to\s+(?:get\s+)?started\??$/i;

const meadContinuationPattern =
  /^(?:yes|no|okay|ok|sure|please|continue|go\s+ahead|do\s+it|keep|change|use|same|that|this|it|then|and\s+then|(?:can\s+you\s+)?(?:turn|make)\s+(?:that|this)\s+into\s+(?:a\s+)?(?:mead\s+)?recipe\s+draft)(?:\b|[.!?,])/i;

const meadCatalogContinuationPattern = /\b(?:ingredient|catalog)\b/i;


export async function runChatTurn(options: {
  client: ChatModelClient;
  userId: number;
  request: ChatRequest;
  maxOutputTokens: number;
  maxToolCalls: number;
  reasoningEffort?: "low" | "medium";
  maxProviderCalls?: number;
  maxTotalOutputTokens?: number;
  maxProviderInputCharacters?: number;
  maxTotalProviderTokens?: number;
  ingredientLookup?: IngredientLookup;
  additiveLookup?: AdditiveLookup;
  yeastLookup?: YeastLookup;
  accountReadAdapter?: AccountReadAdapter;
  wikiFetcher?: WikiFetcher;
  onEvent?: (event: ChatTurnEvent) => void;
  /** Called immediately before every provider dispatch. Must fail closed. */
  onProviderAttempt?: () => Promise<void> | void;
  /** Called after every successful provider completion with all known usage. */
  onUsage?: (usage: ChatTurnUsage) => Promise<void> | void;
}): Promise<ChatTurnResult> {
  const startedAt = performance.now();
  const provider = options.client.provider ?? "openai";
  const deterministic = runDeterministicChatTurn({
    request: options.request,
    provider,
    startedAt,
  });
  if (deterministic) return deterministic;
  const messages = initialMessages(options.request);
  const toolResults: ChatTurnResult["toolResults"] = [];
  const readCache = new Map<string, Awaited<ReturnType<typeof executeToolCall>>>();
  const usage = emptyUsage();
  let model = "unknown";
  let toolCalls = 0;
  let recipeDraftInput = options.request.recipeDraftInput;
  let activeRecipeData = options.request.activeRecipeData;
  let brewActionTarget: ReturnType<typeof brewActionTargetFromAccountRead>;
  const maxProviderCalls = options.maxProviderCalls ?? options.maxToolCalls + 1;
  // Direct callers retain a combined output bound even without route configuration.
  const maxTotalOutputTokens =
    options.maxTotalOutputTokens ?? options.maxOutputTokens * 2;
  const maxProviderInputCharacters =
    options.maxProviderInputCharacters ?? 60_000;
  const maxTotalProviderTokens = options.maxTotalProviderTokens ?? DEFAULT_MAX_TOTAL_PROVIDER_TOKENS;

  while (true) {
    if (usage.totalTokens >= maxTotalProviderTokens) {
      return resultForSafetyLimit({
        provider,
        usage,
        model,
        toolCalls,
        startedAt,
        toolResults,
        recipeDraftInput,
        message:
          "I reached the safe provider-token limit for this turn. Please send a short follow-up so I can continue from the details already gathered.",
      });
    }
    if (usage.requestIds.length >= maxProviderCalls) {
      return resultForSafetyLimit({
        provider,
        usage,
        model,
        toolCalls,
        startedAt,
        toolResults,
        recipeDraftInput,
        message:
          "I reached the safe provider-call limit for this turn. Please send a short follow-up with the remaining recipe detail or a narrower process question.",
      });
    }
    const toolChoice = toolCalls >= options.maxToolCalls ? "none" : "auto";
    const remainingOutputTokens = maxTotalOutputTokens - usage.outputTokens;
    if (remainingOutputTokens < 128) {
      return resultForSafetyLimit({
        provider,
        usage,
        model,
        toolCalls,
        startedAt,
        toolResults,
        recipeDraftInput,
        message:
          "I reached the safe output limit for this turn. Please send a short follow-up so I can continue from the recipe details already gathered.",
      });
    }
    const tools =
      toolCalls < options.maxToolCalls
        ? hostedAgentToolDefinitions
            .filter((tool) => !isMcpAccountReadTool(tool.name) || options.accountReadAdapter)
            .map(({ name, description, parameters }) => ({
              type: "function" as const,
              function: { name, description, parameters },
            }))
        : undefined;
    if (
      serializedProviderInputLength(messages, tools) >
      maxProviderInputCharacters
    ) {
      throw new ChatSafetyLimitError(
        "This chat turn grew beyond the safe provider-context limit. Please start a new chat or send a shorter follow-up.",
      );
    }
    await options.onProviderAttempt?.();
    options.onEvent?.({ type: "answer_reset" });
    const completion = await options.client.complete({
      messages,
      tools,
      toolChoice,
      ...(options.onEvent ? {
        onTextDelta: (delta: string) => options.onEvent?.({ type: "answer_delta", delta }),
        onTextReset: () => options.onEvent?.({ type: "answer_reset" }),
      } : {}),
      // Tool-bearing recipe turns need enough deliberate reasoning to carry
      // catalog results into the next structured call. The compact title path
      // remains tool-free and explicitly uses no reasoning.
      reasoningEffort: tools ? (options.reasoningEffort ?? "low") : undefined,
      maxOutputTokens: Math.min(
        options.maxOutputTokens,
        remainingOutputTokens,
      ),
      userId: options.userId,
    });
    model = completion.model;
    collectUsage(usage, completion);
    await options.onUsage?.(
      usageSnapshot({
        usage,
        provider,
        model,
        toolCalls,
        startedAt,
      }),
    );

    const calls = completion.message.tool_calls ?? [];
    if (calls.length === 0) {
      if (completionWasTruncated(completion, options.maxOutputTokens)) {
        return resultForTruncatedResponse({ provider, usage, model, toolCalls, startedAt, toolResults, recipeDraftInput });
      }
      return {
        answer: completion.message.content?.trim() || "I could not produce a response for that request.",
        toolResults,
        recipeDraftInput,
        usage: usageSnapshot({ usage, provider, model, toolCalls, startedAt }),
      };
    }

    options.onEvent?.({ type: "answer_reset" });
    messages.push(completion.message);
    for (const call of calls) {
      const readKey = cacheableReadKey(call);
      const cached = readKey && toolCalls < options.maxToolCalls ? readCache.get(readKey) : undefined;
      let progressInput: unknown;
      try { progressInput = JSON.parse(call.function.arguments); } catch { /* Tool validation reports this below. */ }
      options.onEvent?.({ type: "tool_call", toolName: call.function.name, detail: describeChatToolProgress(call.function.name, progressInput) });
      const toolExecution = cached ?? await executeToolCall({
        call,
        activeRecipeData,
        accountReadAdapter: options.accountReadAdapter,
        brewActionTarget,
        ingredientLookup: options.ingredientLookup,
        additiveLookup: options.additiveLookup,
        yeastLookup: options.yeastLookup,
        wikiFetcher: options.wikiFetcher,
        canExecute: toolCalls < options.maxToolCalls,
      });
      const result = toolExecution.execution;
      if (call.function.name === "build_recipe_draft" &&
          isRecord(result) && result.status === "ok" &&
          isRecord(result.result) && result.result.status === "recipe") {
        const parsedDraft = recipeDataV2Schema.safeParse(result.result.recipeData);
        if (parsedDraft.success) activeRecipeData = parsedDraft.data;
      }
      const detail = describeChatToolProgress(call.function.name, progressInput, result);
      if (cached) detail.cached = true;
      options.onEvent?.({ type: "tool_result", toolName: call.function.name,
        status: detail.issue ? "error" : isRecord(result) && typeof result.status === "string" ? result.status : "error", detail });
      if (!cached && readKey && isRecord(result) && result.status === "ok") readCache.set(readKey, toolExecution);
      if (call.function.name === "get_brew") {
        brewActionTarget = brewActionTargetFromAccountRead(result);
      }
      if (toolExecution.recipeDraftInput)
        recipeDraftInput = toolExecution.recipeDraftInput;
      toolCalls += 1;
      toolResults.push({ toolName: call.function.name, result });

      // Return the actual result; the model chooses its next tool or final answer.
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });

    }
  }
}


function initialMessages(request: ChatRequest): ChatMessage[] {
  const selection = request.selectedAccountContext;
  return [
    { role: "system", content: [
      ...hostedAgentPolicy.instructions,
      JSON.stringify({
        applicationContext: {
          activeDraftAvailable: Boolean(request.activeRecipeData),
          recipePlan: request.recipeDraftInput ?? null,
          selectedRecord: selection ? { kind: selection.kind, id: selection.kind === "recipe" ? selection.recipe.id : selection.brew.id } : null,
        },
      }),
    ].join("\n") },
    ...recipeMessagesSinceLastDraftReset(request.messages),
  ];
}

async function executeToolCall(options: {
  call: ChatToolCall;
  activeRecipeData: RecipeDataV2 | undefined;
  accountReadAdapter: AccountReadAdapter | undefined;
  brewActionTarget: ReturnType<typeof brewActionTargetFromAccountRead>;
  ingredientLookup: IngredientLookup | undefined;
  additiveLookup: AdditiveLookup | undefined;
  yeastLookup: YeastLookup | undefined;
  wikiFetcher: WikiFetcher | undefined;
  canExecute: boolean;
}): Promise<{ execution: unknown; recipeDraftInput?: BuildRecipeDraftInput }> {
  const toolName = options.call.function.name;
  if (!options.canExecute) {
    return {
      execution: {
        status: "error",
        message: "The per-turn tool-call limit was reached.",
      },
    };
  }

  let input: unknown;
  try {
    input = JSON.parse(options.call.function.arguments);
  } catch {
    return {
      execution: {
        status: "error",
        message: "The tool arguments were not valid JSON.",
      },
    };
  }

  if (toolName === "explain_recipe") {
    if (!options.activeRecipeData) {
      return {
        execution: {
          status: "error",
          message: "No active recipe draft is available.",
        },
      };
    }
    input = {
      ...(isRecord(input) ? input : {}),
      activeRecipeData: options.activeRecipeData,
    };
  }

  let validatedRecipeDraftInput: BuildRecipeDraftInput | undefined;
  if (toolName === "record_recipe_plan") {
    const plan = isRecord(input) ? input.plan : undefined;
    const parsed = buildRecipeDraftInputSchema.safeParse(plan);
    if (!parsed.success) {
      return {
        execution: {
          status: "invalid_input",
          issues: parsed.error.issues.map((issue) => issue.message),
        },
      };
    }
    input = { plan: parsed.data };
    validatedRecipeDraftInput = parsed.data;
  }
  if (toolName === "build_recipe_draft") {
    const parsed = buildRecipeDraftInputSchema.safeParse(input);
    if (parsed.success) validatedRecipeDraftInput = parsed.data;
  }
  const execution = await executeHostedAgentTool(toolName, input, {
    fetcher: options.wikiFetcher,
    ingredientLookup: options.ingredientLookup,
    additiveLookup: options.additiveLookup,
    yeastLookup: options.yeastLookup,
    brewActionTarget: options.brewActionTarget,
    accountReadAdapter: options.accountReadAdapter,
  });
  return { execution, recipeDraftInput: validatedRecipeDraftInput };
}


function isMeadScopedRequest(request: ChatRequest): boolean {
  const latestMessage = request.messages.at(-1)?.content ?? "";
  // Evaluate explicit unrelated requests before broad brewing vocabulary. A
  // prompt can mention an ingredient while still asking for a resume, code,
  // or financial advice, and that must remain outside the assistant's scope.
  if (isExplicitlyUnrelatedBrewingRequest(latestMessage)) return false;
  // A concise first-turn request such as "What do I need to get started?"
  // is a common way a brewer opens this assistant. It is still ambiguous in
  // isolation, so permit only this narrow starter phrasing and let the hosted
  // policy establish the MeadTools context before it gives advice.
  if (
    ambiguousMeadStarterPattern.test(latestMessage) &&
    !isExplicitlyUnrelatedBrewingRequest(latestMessage)
  )
    return true;
  if (
    meadScopePattern.test(latestMessage) ||
    traditionalMeadRecipeIntentPattern.test(latestMessage)
  )
    return true;
  // Selecting an owned MeadTools recipe or brew makes concise follow-ups such
  // as “what should I adjust?” meaningful even without prior chat history.
  // Explicit unrelated pivots still fail closed before a provider call.
  if (request.selectedAccountContext) {
    return !isExplicitlyUnrelatedBrewingRequest(latestMessage);
  }
  // A retained recipe draft provides enough MeadTools context for concise
  // corrections such as “1 lb as an additive.” Keep explicit unrelated
  // pivots blocked before they can reach the provider.
  if (request.recipeDraftInput || request.activeRecipeData) {
    return !isExplicitlyUnrelatedBrewingRequest(latestMessage);
  }
  const hasMeadConversation = request.messages
    .slice(0, -1)
    .some(
      (message) =>
        message.role === "user" && meadScopePattern.test(message.content),
    );
  if (!hasMeadConversation) return false;

  // Recipe and process conversations routinely continue with a number, unit,
  // confirmation, or correction. Reject only clearly unrelated pivots here;
  // the hosted policy remains responsible for ambiguous requests.
  if (isExplicitlyUnrelatedBrewingRequest(latestMessage)) return false;
  return (
    Boolean(request.recipeDraftInput || request.activeRecipeData) ||
    meadContinuationPattern.test(latestMessage) ||
    meadCatalogContinuationPattern.test(latestMessage) ||
    latestMessage.trim().length > 0
  );
}

function recipeMessagesSinceLastDraftReset(
  messages: readonly ChatMessage[],
): readonly ChatMessage[] {
  let resetIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && isRecipeDraftResetPhrase(message.content)) {
      resetIndex = index;
      break;
    }
  }
  return resetIndex === -1 ? messages : messages.slice(resetIndex + 1);
}

function isRecipeDraftResetPhrase(message: string): boolean {
  return (
    /\bstart\s+(?:over|fresh|again)\b/i.test(message) ||
    /\b(?:scrap|discard|clear|reset|forget|abandon)\b[\s\S]{0,80}\b(?:recipe|draft|plan|it|that)\b/i.test(
      message,
    )
  );
}

function isRecipeDraftResetRequest(request: ChatRequest): boolean {
  return (
    Boolean(request.activeRecipeData || request.recipeDraftInput) &&
    isRecipeDraftResetPhrase(request.messages.at(-1)?.content ?? "")
  );
}

function completionWasTruncated(
  completion: ChatCompletion,
  maxOutputTokens: number,
): boolean {
  return (
    completion.finishReason === "length" ||
    (completion.finishReason === undefined &&
      completion.usage.outputTokens >= maxOutputTokens)
  );
}

function resultForTruncatedResponse(options: {
  provider: ChatProvider;
  usage: ReturnType<typeof emptyUsage>;
  model: string;
  toolCalls: number;
  startedAt: number;
  toolResults: ChatTurnResult["toolResults"];
  recipeDraftInput?: BuildRecipeDraftInput;
}): ChatTurnResult {
  return {
    answer:
      "I could not complete that response within the response limit. Please retry with a narrower request or provide the remaining recipe target directly.",
    toolResults: options.toolResults,
    recipeDraftInput: options.recipeDraftInput,
    usage: {
      ...options.usage,
      provider: options.provider,
      model: options.model,
      toolCalls: options.toolCalls,
      latencyMs: Math.round(performance.now() - options.startedAt),
    },
  };
}

function resultForSafetyLimit(options: {
  provider: ChatProvider;
  usage: ReturnType<typeof emptyUsage>;
  model: string;
  toolCalls: number;
  startedAt: number;
  toolResults: ChatTurnResult["toolResults"];
  recipeDraftInput?: BuildRecipeDraftInput;
  message: string;
}): ChatTurnResult {
  return {
    answer: options.message,
    toolResults: options.toolResults,
    recipeDraftInput: options.recipeDraftInput,
    usage: {
      ...options.usage,
      provider: options.provider,
      model: options.model,
      toolCalls: options.toolCalls,
      latencyMs: Math.round(performance.now() - options.startedAt),
    },
  };
}

function serializedProviderInputLength(
  messages: ChatMessage[],
  tools: ChatFunctionTool[] | undefined,
): number {
  return JSON.stringify({ messages, tools }).length;
}

function emptyUsage(): Omit<
  ChatTurnUsage,
  "provider" | "model" | "toolCalls" | "latencyMs"
> {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cachedInputTokens: 0,
    requestIds: [],
  };
}

function collectUsage(
  aggregate: ReturnType<typeof emptyUsage>,
  completion: ChatCompletion,
): void {
  aggregate.inputTokens += completion.usage.inputTokens;
  aggregate.outputTokens += completion.usage.outputTokens;
  aggregate.totalTokens += completion.usage.totalTokens;
  aggregate.cachedInputTokens += completion.usage.cachedInputTokens;
  aggregate.requestIds.push(completion.id);
}

function usageSnapshot(options: {
  usage: ReturnType<typeof emptyUsage>;
  provider: ChatProvider;
  model: string;
  toolCalls: number;
  startedAt: number;
}): ChatTurnUsage {
  return {
    ...options.usage,
    requestIds: [...options.usage.requestIds],
    provider: options.provider,
    model: options.model,
    toolCalls: options.toolCalls,
    latencyMs: Math.round(performance.now() - options.startedAt),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cacheableReadKey(call: ChatToolCall): string | undefined {
  if (!isMcpAccountReadTool(call.function.name) && !["search_ingredients", "search_additives", "search_yeasts", "search_wiki", "fetch_wiki_page"].includes(call.function.name)) return undefined;
  try {
    const input = JSON.parse(call.function.arguments);
    const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : isRecord(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
    return JSON.stringify([call.function.name, canonical(input)]);
  } catch { return undefined; }
}
