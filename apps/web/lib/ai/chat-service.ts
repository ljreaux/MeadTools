import {
  executeHostedAgentTool,
  hostedAgentPolicy,
  hostedAgentToolDefinitions,
  type IngredientLookup,
  type YeastLookup
} from "@meadtools/recipe-agent";
import {
  buildRecipeDraftInputSchema,
  chatbotRecipeWorkflowResultSchema,
  gravityTargetCalculationResultSchema,
  type BuildRecipeDraftInput
} from "@meadtools/recipe-workflows";
import { recipeDataV2Schema, type RecipeDataV2 } from "@meadtools/schemas";
import { z } from "zod";
import type {
  ChatModelClient,
  FireworksCompletion,
  FireworksMessage,
  FireworksToolCall,
  FireworksUsage
} from "./fireworks";

export const chatRequestSchema = z
  .object({
    messages: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1).max(4_000)
        })
      )
      .min(1)
      .max(12),
    activeRecipeData: recipeDataV2Schema.optional(),
    recipeDraftInput: buildRecipeDraftInputSchema.optional()
  })
  .strict()
  .refine((request) => request.messages.at(-1)?.role === "user", {
    message: "The latest chat message must be from the user.",
    path: ["messages"]
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type ChatTurnEvent =
  | { type: "tool_call"; toolName: string }
  | { type: "tool_result"; toolName: string; status: string };

export type ChatTurnUsage = FireworksUsage & {
  provider: "fireworks";
  model: string;
  requestIds: string[];
  toolCalls: number;
  latencyMs: number;
};

export type ChatTurnResult = {
  answer: string;
  toolResults: Array<{ toolName: string; result: unknown }>;
  recipeDraftInput?: BuildRecipeDraftInput;
  usage: ChatTurnUsage;
};

const outOfScopeAnswer =
  "I can help with MeadTools, mead recipes, and mead-brewing process questions. What would you like to make or troubleshoot?";

const meadScopePattern =
  /\b(?:mead|melomel|cyser|pyment|metheglin|bochet|braggot|fruit\s+wine|honey|must|ferment(?:ation|ing|ed)?|yeast|nutrient|fermaid|go[\s-]?ferm|dap|yan|hydrometer|refractometer|gravity|og|fg|abv|brix|p\s*\.?\s*h|back[\s-]?sweeten(?:ing|ed)?|stabili[sz](?:e|ed|ing|ation)|sulf(?:ite|ur)|sorbate|k[\s-]?meta|campden|racking|rack(?:ed|ing)?|carboy|airlock|pitch(?:ing|ed)?|brew(?:ing|ed)?|vanilla\s+bean)\b/i;

const meadContinuationPattern =
  /^(?:yes|no|okay|ok|sure|please|continue|go\s+ahead|do\s+it|keep|change|use|same|that|this|it|then|and\s+then|(?:can\s+you\s+)?(?:turn|make)\s+(?:that|this)\s+into\s+(?:a\s+)?(?:mead\s+)?recipe\s+draft)(?:\b|[.!?,])/i;

const meadCatalogContinuationPattern = /\b(?:ingredient|catalog)\b/i;

export async function runChatTurn(options: {
  client: ChatModelClient;
  userId: number;
  request: ChatRequest;
  maxOutputTokens: number;
  maxToolCalls: number;
  ingredientLookup?: IngredientLookup;
  yeastLookup?: YeastLookup;
  onEvent?: (event: ChatTurnEvent) => void;
}): Promise<ChatTurnResult> {
  const startedAt = performance.now();
  if (!isMeadScopedRequest(options.request)) {
    return {
      answer: outOfScopeAnswer,
      toolResults: [],
      recipeDraftInput: options.request.recipeDraftInput,
      usage: {
        ...emptyUsage(),
        provider: "fireworks",
        model: "deterministic-scope-check",
        toolCalls: 0,
        latencyMs: Math.round(performance.now() - startedAt)
      }
    };
  }
  const sweetnessStrategyRequest = explainSweetnessStrategy(
    options.request.messages.at(-1)?.content ?? ""
  );
  if (sweetnessStrategyRequest) {
    return {
      answer: sweetnessStrategyRequest,
      toolResults: [],
      recipeDraftInput: options.request.recipeDraftInput,
      usage: {
        ...emptyUsage(),
        provider: "fireworks",
        model: "deterministic-intake-check",
        toolCalls: 0,
        latencyMs: Math.round(performance.now() - startedAt)
      }
    };
  }
  const messages = initialMessages(options.request);
  const toolResults: ChatTurnResult["toolResults"] = [];
  const usage = emptyUsage();
  let model = "unknown";
  let toolCalls = 0;
  let truncatedResponseRetries = 0;
  let renderRecipeIntake = false;
  let recipeDraftInput = options.request.recipeDraftInput;
  const forceGravityTargetTool = shouldForceGravityTargetTool(options.request);
  const forceYeastSearchTool = shouldForceYeastSearchTool(options.request);
  const forceIngredientSearchTool = shouldForceIngredientSearchTool(options.request);
  const forceRecipeDraftTool = shouldForceRecipeDraftTool(options.request);
  let requiredFollowupTool:
    | "build_recipe_draft"
    | "search_ingredients"
    | "search_yeasts"
    | undefined;
  let namedIngredientResolved = false;
  let namedYeastResolved = false;

  while (true) {
    const toolChoice =
      toolCalls >= options.maxToolCalls || renderRecipeIntake
        ? "none"
        : requiredFollowupTool
          ? { type: "function" as const, function: { name: requiredFollowupTool } }
          : toolCalls === 0 && forceGravityTargetTool
              ? { type: "function" as const, function: { name: "calculate_gravity_target" } }
              : toolCalls === 0 && forceYeastSearchTool
                ? { type: "function" as const, function: { name: "search_yeasts" } }
                : toolCalls === 0 && forceIngredientSearchTool
                  ? { type: "function" as const, function: { name: "search_ingredients" } }
                  : toolCalls === 0 && forceRecipeDraftTool
                    ? { type: "function" as const, function: { name: "build_recipe_draft" } }
                    : "auto";
    const completion = await options.client.complete({
      messages,
      tools:
        toolCalls < options.maxToolCalls && !renderRecipeIntake
          ? hostedAgentToolDefinitions.map((tool) => ({
              type: "function" as const,
              function: tool
            }))
          : undefined,
      toolChoice,
      maxOutputTokens:
        renderRecipeIntake
          ? Math.min(options.maxOutputTokens, 1_000)
          : toolChoice === "auto" || toolChoice === "none"
          ? options.maxOutputTokens
          : Math.min(options.maxOutputTokens, 1_200),
      userId: options.userId
    });
    model = completion.model;
    collectUsage(usage, completion);

    const calls = completion.message.tool_calls ?? [];
    if (calls.length === 0) {
      if (completionWasTruncated(completion, options.maxOutputTokens)) {
        if (truncatedResponseRetries < 1) {
          truncatedResponseRetries += 1;
          messages.push(completion.message);
          messages.push({
            role: "system",
            content:
              "Your previous response was truncated. Do not reveal or continue scratchwork. Reply now with only a concise final answer or the single next required question; use a MeadTools tool for any recipe calculation."
          });
          continue;
        }

        return resultForTruncatedResponse({
          usage,
          model,
          toolCalls,
          startedAt,
          toolResults,
          recipeDraftInput
        });
      }
      return {
        answer: sanitizeUserFacingRecipeAnswer(
          completion.message.content?.trim() ||
            "I could not produce a response for that request."
        ),
        toolResults,
        recipeDraftInput,
        usage: {
          ...usage,
          provider: "fireworks",
          model,
          toolCalls,
          latencyMs: Math.round(performance.now() - startedAt)
        }
      };
    }

    messages.push(completion.message);
    for (const call of calls) {
      const toolExecution = await executeToolCall({
        call,
        activeRecipeData: options.request.activeRecipeData,
        recipeDraftInput,
        latestUserMessage: options.request.messages.at(-1)?.content ?? "",
        shouldAssumeHoney: shouldAssumeHoneyForRequest(options.request),
        ingredientLookup: options.ingredientLookup,
        yeastLookup: options.yeastLookup,
        canExecute: toolCalls < options.maxToolCalls,
        onEvent: options.onEvent
      });
      const result = toolExecution.execution;
      if (toolExecution.recipeDraftInput) recipeDraftInput = toolExecution.recipeDraftInput;
      toolCalls += 1;
      toolResults.push({ toolName: call.function.name, result });

      if (call.function.name === "calculate_gravity_target" && isRecipeDesignRequest(options.request)) {
        recipeDraftInput = mergeCalculatedGravityTarget(recipeDraftInput, result);
      }
      if (call.function.name === "search_yeasts") {
        recipeDraftInput = mergeExactYeastLookup(
          recipeDraftInput,
          result,
          options.request.messages.at(-1)?.content ?? ""
        );
      }
      if (
        call.function.name === "search_ingredients" &&
        isSuccessfulCatalogResult(result)
      ) {
        namedIngredientResolved = true;
      }
      if (call.function.name === "search_yeasts" && isSuccessfulCatalogResult(result)) {
        namedYeastResolved = true;
      }

      requiredFollowupTool = requiredRecipeFollowupTool({
        toolName: call.function.name,
        execution: result,
        recipeDraftAvailable: recipeDraftInput !== undefined,
        mustResolveNamedYeast: forceYeastSearchTool && !namedYeastResolved,
        mustResolveNamedIngredient: forceIngredientSearchTool && !namedIngredientResolved
      });

      const directAnswer = directRecipeToolAnswer(call.function.name, result);
      if (
        call.function.name === "build_recipe_draft" &&
        isRecipeNeedsInput(result) &&
        !buildNeedsCatalogLookup(result)
      ) {
        renderRecipeIntake = true;
      }
      const continueRecipeDraft =
        call.function.name === "calculate_gravity_target" &&
        isRecipeDesignRequest(options.request) &&
        isCompletedGravityCalculation(result);
      const repeatedQuestionAnswer =
        directAnswer !== undefined && isRepeatedQuestionAnswer(options.request, directAnswer);
      if (directAnswer && !continueRecipeDraft && !repeatedQuestionAnswer) {
        return {
          answer: sanitizeUserFacingRecipeAnswer(directAnswer),
          toolResults,
          recipeDraftInput,
          usage: {
            ...usage,
            provider: "fireworks",
            model,
            toolCalls,
            latencyMs: Math.round(performance.now() - startedAt)
          }
        };
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result)
      });
      messages.push({
        role: "system",
        content: postToolInstruction(
          call.function.name,
          result,
          continueRecipeDraft,
          repeatedQuestionAnswer
        )
      });
    }
  }
}

/**
 * Scope is enforced before the provider sees a turn; an instruction alone
 * cannot prevent a general-purpose model from answering an unrelated prompt.
 */
function isMeadScopedRequest(request: ChatRequest): boolean {
  const latestMessage = request.messages.at(-1)?.content ?? "";
  if (meadScopePattern.test(latestMessage)) return true;
  const hasMeadConversation = request.messages.slice(0, -1).some(
    (message) => message.role === "user" && meadScopePattern.test(message.content)
  );
  if (!hasMeadConversation) return false;

  // A short catalog correction such as “Apple Juice is in the catalog; use
  // that” is a normal continuation of a recipe turn, even though it may not
  // repeat the word “mead.” Keep this narrow so ordinary unrelated questions
  // remain blocked before reaching the provider.
  return meadContinuationPattern.test(latestMessage) || meadCatalogContinuationPattern.test(latestMessage);
}

/** A finished sweetness preference must be made actionable before drafting. */
function explainSweetnessStrategy(message: string): string | undefined {
  if (!/\bmedium[\s-]?sweet\b/i.test(message)) return undefined;
  if (/\b(?:back\s*-?sweeten|stabiliz(?:e|ed|ing)|sorbate)\b/i.test(message)) return undefined;

  return [
    "Before I draft a medium-sweet mead, I need the sweetness strategy.",
    "MeadTools cannot turn “medium-sweet” into a reliable finished recipe from volume alone. The standard option is to ferment dry, stabilize, and then backsweeten to the desired final gravity. An intentionally sweet finish needs an explicit yeast, alcohol target, and residual-sugar plan instead.",
    "Would you like the standard stabilize-and-backsweeten plan, or are you intentionally targeting a naturally sweet finish? Please also give me a target ABV."
  ].join("\n\n");
}

function shouldForceGravityTargetTool(request: ChatRequest): boolean {
  if (request.activeRecipeData) return false;
  const latestMessage = request.messages.at(-1)?.content ?? "";
  return (
    /\b(?:target|aim(?:ing)?|goal)\s*(?:of\s*)?\d{1,2}(?:\.\d+)?\s*%/i.test(
      latestMessage
    ) ||
    (isRecipeDesignRequest(request) && /\b\d{1,2}(?:\.\d+)?\s*%/.test(latestMessage))
  );
}

function shouldForceYeastSearchTool(request: ChatRequest): boolean {
  if (
    request.activeRecipeData ||
    (!request.recipeDraftInput && !isRecipeDesignRequest(request))
  ) {
    return false;
  }
  const nutrients = request.recipeDraftInput?.nutrients;
  if (nutrients?.yeastId || (nutrients?.yeastBrand && nutrients?.yeastStrain)) return false;
  const latestMessage = request.messages.at(-1)?.content ?? "";
  return /\b(?:yeast|lalvin|red\s*star|premier|ec[-\s]?1118|d[-\s]?47|k1[-\s]?v1116|71b)\b/i.test(
    latestMessage
  );
}

function shouldForceRecipeDraftTool(request: ChatRequest): boolean {
  if (request.activeRecipeData || !request.recipeDraftInput) return false;
  return isRecipeDesignRequest(request);
}

function shouldForceIngredientSearchTool(request: ChatRequest): boolean {
  if (request.activeRecipeData || request.recipeDraftInput) return false;
  return isRecipeDesignRequest(request);
}

function isRecipeDesignRequest(request: ChatRequest): boolean {
  return request.messages.some(
    (message) =>
      message.role === "user" &&
      /\b(?:make|build|create|draft|design)\b[\s\S]{0,120}\b(?:mead|melomel|cyser|pyment|metheglin|recipe)\b/i.test(
        message.content
      )
  );
}

function completionWasTruncated(
  completion: FireworksCompletion,
  maxOutputTokens: number
): boolean {
  return (
    completion.finishReason === "length" ||
    (completion.finishReason === undefined &&
      completion.usage.outputTokens >= maxOutputTokens)
  );
}

function resultForTruncatedResponse(options: {
  usage: ReturnType<typeof emptyUsage>;
  model: string;
  toolCalls: number;
  startedAt: number;
  toolResults: ChatTurnResult["toolResults"];
  recipeDraftInput?: BuildRecipeDraftInput;
}): ChatTurnResult {
  return {
    answer:
      "I could not complete that response within the local test limit. Please retry with a narrower request or provide the remaining recipe target directly.",
    toolResults: options.toolResults,
    recipeDraftInput: options.recipeDraftInput,
    usage: {
      ...options.usage,
      provider: "fireworks",
      model: options.model,
      toolCalls: options.toolCalls,
      latencyMs: Math.round(performance.now() - options.startedAt)
    }
  };
}

function initialMessages(request: ChatRequest): FireworksMessage[] {
  const activeDraftInstruction = request.activeRecipeData
    ? "An active unsaved recipe draft is available. Refine and explain tools receive it from the server; do not ask the user to paste it."
    : "No active recipe draft is available. Do not call refine or explain tools until one is available.";
  return [
    {
      role: "system",
      content: [
        ...hostedAgentPolicy.instructions,
        activeDraftInstruction,
        request.recipeDraftInput
          ? `A partial recipe intake is available and will be merged with the next build_recipe_draft call: ${JSON.stringify(request.recipeDraftInput)}. Extract every new answer from the latest user message into that tool call. Do not repeat a question when its answer is already present in this intake.`
          : "No partial recipe intake is available yet. When the user supplies recipe details, include every stated detail in build_recipe_draft tool arguments."
      ].join("\n")
    },
    ...request.messages
  ];
}

async function executeToolCall(options: {
  call: FireworksToolCall;
  activeRecipeData: RecipeDataV2 | undefined;
  recipeDraftInput: BuildRecipeDraftInput | undefined;
  latestUserMessage: string;
  shouldAssumeHoney: boolean;
  ingredientLookup: IngredientLookup | undefined;
  yeastLookup: YeastLookup | undefined;
  canExecute: boolean;
  onEvent?: (event: ChatTurnEvent) => void;
}): Promise<{ execution: unknown; recipeDraftInput?: BuildRecipeDraftInput }> {
  const toolName = options.call.function.name;
  if (!options.canExecute) {
    return { execution: { status: "error", message: "The per-turn tool-call limit was reached." } };
  }
  options.onEvent?.({ type: "tool_call", toolName });

  let input: unknown;
  try {
    input = JSON.parse(options.call.function.arguments);
  } catch {
    return { execution: { status: "error", message: "The tool arguments were not valid JSON." } };
  }

  if (toolName === "explain_recipe") {
    if (!options.activeRecipeData) {
      return { execution: { status: "error", message: "No active recipe draft is available." } };
    }
    input = {
      ...(isRecord(input) ? input : {}),
      activeRecipeData: options.activeRecipeData
    };
  }

  let mergedRecipeDraftInput: BuildRecipeDraftInput | undefined;
  if (toolName === "build_recipe_draft") {
    const parsed = buildRecipeDraftInputSchema.safeParse(
      mergeRecipeDraftInput(
        options.recipeDraftInput,
        input,
        options.latestUserMessage,
        options.shouldAssumeHoney
      )
    );
    if (parsed.success) {
      input = parsed.data;
      mergedRecipeDraftInput = parsed.data;
    } else {
      const recovered = buildRecipeDraftInputSchema.safeParse(
        mergeRecipeDraftInput(
          options.recipeDraftInput,
          {},
          options.latestUserMessage,
          options.shouldAssumeHoney
        )
      );
      if (recovered.success) {
        input = recovered.data;
        mergedRecipeDraftInput = recovered.data;
      }
    }
  }

  if (toolName === "calculate_gravity_target" && isRecord(input)) {
    const explicitFinalGravity = fermentationFinalGravityFromMessage(options.latestUserMessage);
    const knownFinalGravity =
      explicitFinalGravity ?? options.recipeDraftInput?.fermentationFinalGravity;
    if (knownFinalGravity !== undefined) {
      input = { ...input, fermentationFinalGravity: knownFinalGravity };
    }
  }

  const execution = await executeHostedAgentTool(toolName, input, {
    ingredientLookup: options.ingredientLookup,
    yeastLookup: options.yeastLookup
  });
  options.onEvent?.({ type: "tool_result", toolName, status: execution.status });
  return { execution, recipeDraftInput: mergedRecipeDraftInput };
}

function requiredRecipeFollowupTool(options: {
  toolName: string;
  execution: unknown;
  recipeDraftAvailable: boolean;
  mustResolveNamedYeast: boolean;
  mustResolveNamedIngredient: boolean;
}): "build_recipe_draft" | "search_ingredients" | "search_yeasts" | undefined {
  if (!isSuccessfulToolResult(options.execution)) return undefined;
  if (options.toolName === "search_ingredients") {
    if (!Array.isArray(options.execution.result) || options.execution.result.length === 0) {
      return undefined;
    }
    return options.mustResolveNamedYeast ? "search_yeasts" : "build_recipe_draft";
  }
  if (options.toolName === "search_yeasts") {
    if (!Array.isArray(options.execution.result) || options.execution.result.length === 0) {
      return undefined;
    }
    return options.mustResolveNamedIngredient ? "search_ingredients" : "build_recipe_draft";
  }
  if (
    options.toolName === "calculate_gravity_target" &&
    options.recipeDraftAvailable &&
    isCompletedGravityCalculation(options.execution)
  ) {
    if (options.mustResolveNamedIngredient) return "search_ingredients";
    return options.mustResolveNamedYeast ? "search_yeasts" : "build_recipe_draft";
  }
  if (options.toolName === "build_recipe_draft" && buildNeedsCatalogLookup(options.execution)) {
    return "search_ingredients";
  }
  return undefined;
}

function isCompletedGravityCalculation(execution: unknown): boolean {
  if (!isRecord(execution) || execution.status !== "ok") return false;
  const calculation = gravityTargetCalculationResultSchema.safeParse(execution.result);
  return calculation.success && calculation.data.status === "calculation";
}

function isSuccessfulToolResult(
  execution: unknown
): execution is { status: "ok"; result: unknown } & Record<string, unknown> {
  return isRecord(execution) && execution.status === "ok" && "result" in execution;
}

function isSuccessfulCatalogResult(execution: unknown): boolean {
  return (
    isSuccessfulToolResult(execution) &&
    Array.isArray(execution.result) &&
    execution.result.length > 0
  );
}

function mergeRecipeDraftInput(
  previous: BuildRecipeDraftInput | undefined,
  next: unknown,
  latestUserMessage: string,
  shouldAssumeHoney: boolean
): unknown {
  if (!isRecord(next)) return next;
  if (!previous) {
    return discardUnstatedRecipeValues(
      applyExplicitRecipeIntakeHints(next, latestUserMessage, shouldAssumeHoney),
      latestUserMessage
    );
  }
  const nextIngredients = Array.isArray(next.ingredients) ? next.ingredients : [];
  const nextAdditives = Array.isArray(next.additives) ? next.additives : undefined;
  return discardUnstatedRecipeValues(
    applyExplicitRecipeIntakeHints(
      {
        ...previous,
        ...next,
        batchVolume: mergeRecord(previous.batchVolume, next.batchVolume),
        nutrients: mergeRecord(previous.nutrients, next.nutrients),
        stabilizers: mergeRecord(previous.stabilizers, next.stabilizers),
        ingredients: mergeRecipeIngredients(previous.ingredients, nextIngredients, latestUserMessage),
        ...(nextAdditives === undefined ? {} : { additives: nextAdditives })
      },
      latestUserMessage,
      shouldAssumeHoney
    ),
    latestUserMessage,
    previous
  );
}

/** Preserve unambiguous user choices if a provider omits them from its call. */
function applyExplicitRecipeIntakeHints(
  input: Record<string, unknown>,
  latestUserMessage: string,
  shouldAssumeHoney: boolean
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...input };
  addImpliedHoneyForMead(result, latestUserMessage, shouldAssumeHoney);
  moveVanillaToAdditives(result);
  const volume = batchVolumeFromMessage(latestUserMessage);
  if (volume !== undefined) {
    result.batchVolume = {
      value: volume.value,
      unit: volume.unit
    };
  }

  const finalGravity = fermentationFinalGravityFromMessage(latestUserMessage);
  if (finalGravity !== undefined) result.fermentationFinalGravity = finalGravity;

  const nutrientWords = /\bfermaid\s*k\b/i.test(latestUserMessage) || /\bgo[\s-]?ferm\b/i.test(latestUserMessage);
  if (nutrientWords) {
    const nutrients: Record<string, unknown> = isRecord(result.nutrients)
      ? { ...result.nutrients }
      : { enabled: true };
    if (/\bfermaid\s*k\b/i.test(latestUserMessage)) nutrients.schedule = "justK";
    if (/\bgo[\s-]?ferm\b/i.test(latestUserMessage)) nutrients.goFermType = "Go-Ferm";
    result.nutrients = nutrients;
  }

  if (declinesStabilizers(latestUserMessage)) {
    result.stabilizers = {
      ...(isRecord(result.stabilizers) ? result.stabilizers : {}),
      enabled: false
    };
  } else if (/\bback\s*-?sweeten(?:ing|ed)?\b/i.test(latestUserMessage)) {
    result.stabilizers = {
      ...(isRecord(result.stabilizers) ? result.stabilizers : {}),
      enabled: true
    };
  }
  if (
    typeof result.targetOriginalGravity === "number" &&
    userSelectedHoneyAsAdjustable(latestUserMessage) &&
    Array.isArray(result.ingredients)
  ) {
    result.ingredients = result.ingredients.map((ingredient) =>
      isRecord(ingredient) &&
      typeof ingredient.name === "string" &&
      ingredient.name.trim().toLowerCase() === "honey" &&
      ingredient.secondary !== true
        ? {
            ...ingredient,
            ...(ingredient.amount === undefined ? {} : { amount: undefined }),
            role: "adjustable_fermentable"
          }
        : ingredient
    );
  }
  if (
    isRecord(result.stabilizers) &&
    result.stabilizers.enabled === true &&
    /\bpotassium\b/i.test(latestUserMessage)
  ) {
    result.stabilizers = { ...result.stabilizers, type: "kmeta" };
  }
  if (
    isRecord(result.stabilizers) &&
    result.stabilizers.enabled === true &&
    /\b(?:not|no)\s+(?:(?:take|taking)\s+)?(?:a\s+)?p\s*\.?\s*h\s*(?:reading|test)?s?\b/i.test(latestUserMessage)
  ) {
    result.stabilizers = { ...result.stabilizers, phReading: 3.5 };
    addDraftAssumption(
      result,
      "The stabilizer calculation uses an assumed pH of 3.5 because no pH reading will be taken."
    );
  }

  if (/\b(?:in\s+)?(?:both\s+)?primary\s+(?:and|&)\s+secondary\b/i.test(latestUserMessage)) {
    result.ingredients = duplicateIngredientsAcrossStages(result.ingredients);
  }
  applyWholeVanillaBeanAmount(result, latestUserMessage);
  const heavyBlackberryRequested = /\bheavy\s+blackberr(?:y|ies)\b/i.test(latestUserMessage);
  const heavyFruitRequested = /\bheavy\s+fruit\b/i.test(latestUserMessage);
  const containsBlackberry = Array.isArray(result.ingredients) && result.ingredients.some(
    (ingredient) =>
      isRecord(ingredient) &&
      typeof ingredient.name === "string" &&
      /^blackberr(?:y|ies)$/i.test(ingredient.name.trim())
  );
  if (heavyBlackberryRequested || (heavyFruitRequested && containsBlackberry)) {
    applyHeavyBlackberryAssumption(result, {
      replaceUnstatedAmounts: !hasExplicitIngredientAmount(latestUserMessage, "blackberr(?:y|ies)")
    });
  }
  return result;
}

function moveVanillaToAdditives(input: Record<string, unknown>): void {
  if (!Array.isArray(input.ingredients)) return;
  const additives = Array.isArray(input.additives) ? [...input.additives] : [];
  let moved = false;
  input.ingredients = input.ingredients.filter((ingredient) => {
    if (!isRecord(ingredient) || typeof ingredient.name !== "string" || !/\bvanilla\b/i.test(ingredient.name)) {
      return true;
    }
    const amount = isRecord(ingredient.amount) && typeof ingredient.amount.value === "number"
      ? ingredient.amount.value
      : undefined;
    const unit = isRecord(ingredient.amount) && typeof ingredient.amount.unit === "string"
      ? ingredient.amount.unit
      : undefined;
    additives.push({
      name: ingredient.name,
      ...(amount === undefined ? {} : { amount }),
      ...(unit === undefined ? {} : { unit }),
      ...(ingredient.secondary === true ? { secondary: true } : {})
    });
    if (ingredient.secondary === true) {
      addDraftAssumption(input, "Vanilla is planned for secondary.");
    }
    moved = true;
    return false;
  });
  if (moved) input.additives = additives;
}

function applyWholeVanillaBeanAmount(
  input: Record<string, unknown>,
  message: string
): void {
  if (!Array.isArray(input.additives)) return;
  const match = message.match(/\b(one|two|three|four|five|\d+(?:\.\d+)?)\s+whole\s+vanilla\s+beans?\b/i);
  if (!match) return;
  const count = writtenNumber(match[1]);
  if (count === undefined) return;

  input.additives = input.additives.map((additive) => {
    if (
      !isRecord(additive) ||
      typeof additive.name !== "string" ||
      !/\bvanilla\b/i.test(additive.name) ||
      additive.amount !== undefined
    ) {
      return additive;
    }
    return {
      ...additive,
      amount: count,
      unit: count === 1 ? "whole bean" : "whole beans"
    };
  });
}

function writtenNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const spelled: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5
  };
  return spelled[value.toLowerCase()] ?? Number(value);
}

/** Mead defaults to honey unless the user explicitly asks for a fruit wine or cider. */
function addImpliedHoneyForMead(
  input: Record<string, unknown>,
  message: string,
  shouldAssumeHoney: boolean
): void {
  if (
    /\b(?:fruit\s+wine|cider)\b/i.test(message) ||
    !shouldAssumeHoney
  ) {
    return;
  }

  const ingredients = Array.isArray(input.ingredients) ? input.ingredients : [];
  const hasHoneyOrAdjustablePrimary = ingredients.some(
    (ingredient) =>
      isRecord(ingredient) &&
      typeof ingredient.name === "string" &&
      (ingredient.name.trim().toLowerCase() === "honey" ||
        (ingredient.secondary !== true && ingredient.role === "adjustable_fermentable"))
  );
  if (hasHoneyOrAdjustablePrimary) return;

  input.ingredients = [
    {
      name: "Honey",
      ...(typeof input.targetOriginalGravity === "number"
        ? { role: "adjustable_fermentable" }
        : {})
    },
    ...ingredients
  ];
}

function shouldAssumeHoneyForRequest(request: ChatRequest): boolean {
  const userMessages = request.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content)
    .join("\n");
  return (
    /\b(?:mead|traditional\s+mead|melomel|cyser|pyment|metheglin|bochet|braggot)\b/i.test(
      userMessages
    ) && !/\bfruit\s+wine\b/i.test(userMessages)
  );
}

function applyHeavyBlackberryAssumption(
  input: Record<string, unknown>,
  options: { replaceUnstatedAmounts: boolean }
): void {
  if (!isRecord(input.batchVolume) || !Array.isArray(input.ingredients)) return;
  const volume = input.batchVolume.value;
  const unit = input.batchVolume.unit;
  if (typeof volume !== "number" || (unit !== "gal" && unit !== "L")) return;

  const amountPerStage = unit === "gal" ? volume : volume * 0.119826;
  let updated = false;
  input.ingredients = input.ingredients.map((ingredient) => {
    if (
      !isRecord(ingredient) ||
      typeof ingredient.name !== "string" ||
      !/^blackberr(?:y|ies)$/i.test(ingredient.name.trim()) ||
      (!options.replaceUnstatedAmounts && ingredient.amount !== undefined)
    ) {
      return ingredient;
    }
    updated = true;
    return {
      ...ingredient,
      amount: {
        kind: "weight",
        value: Number(amountPerStage.toFixed(3)),
        unit: unit === "gal" ? "lb" : "kg"
      }
    };
  });
  if (updated) {
    addDraftAssumption(
      input,
      "Assumed a heavy blackberry profile at 2 lb per gallon total, split evenly between primary and secondary."
    );
  }
}

function addDraftAssumption(input: Record<string, unknown>, assumption: string): void {
  const assumptions = Array.isArray(input.assumptions)
    ? input.assumptions.filter((item): item is string => typeof item === "string")
    : [];
  if (!assumptions.includes(assumption)) input.assumptions = [...assumptions, assumption];
}

/** Prevent a provider from silently converting an unspecified user choice into intake state. */
function discardUnstatedRecipeValues(
  input: Record<string, unknown>,
  latestUserMessage: string,
  previous?: BuildRecipeDraftInput
): Record<string, unknown> {
  const result = { ...input };
  if (!previous?.batchVolume && batchVolumeFromMessage(latestUserMessage) === undefined) {
    delete result.batchVolume;
  }
  if (
    previous?.fermentationFinalGravity !== undefined &&
    fermentationFinalGravityFromMessage(latestUserMessage) === undefined
  ) {
    // A post-stabilization or backsweetening gravity is not the gravity used
    // to calculate fermentation ABV. Keep the established fermentation target
    // unless the user explicitly replaces that target.
    result.fermentationFinalGravity = previous.fermentationFinalGravity;
  }
  const hasConfirmedHoneyAmount = previous?.ingredients.some(
    (ingredient) =>
      ingredient.name.trim().toLowerCase() === "honey" &&
      !ingredient.secondary &&
      ingredient.amount !== undefined
  );
  if (
    typeof result.targetOriginalGravity === "number" &&
    !hasConfirmedHoneyAmount &&
    !honeyAmountFromMessage(latestUserMessage) &&
    Array.isArray(result.ingredients)
  ) {
    result.ingredients = result.ingredients.map((ingredient) =>
      isRecord(ingredient) &&
      typeof ingredient.name === "string" &&
      ingredient.name.trim().toLowerCase() === "honey" &&
      ingredient.secondary !== true
        ? {
            ...ingredient,
            ...(ingredient.amount === undefined ? {} : { amount: undefined }),
            role: "adjustable_fermentable"
          }
      : ingredient
    );
  }
  const priorHoneyWasAdjustable = previous?.ingredients.some(
    (ingredient) =>
      ingredient.name.trim().toLowerCase() === "honey" &&
      !ingredient.secondary &&
      ingredient.role === "adjustable_fermentable"
  );
  if (
    typeof result.targetOriginalGravity === "number" &&
    priorHoneyWasAdjustable &&
    !honeyAmountFromMessage(latestUserMessage) &&
    Array.isArray(result.ingredients)
  ) {
    const hasPrimaryHoney = result.ingredients.some(
      (ingredient) =>
        isRecord(ingredient) &&
        typeof ingredient.name === "string" &&
        ingredient.name.trim().toLowerCase() === "honey" &&
        ingredient.secondary !== true
    );
    result.ingredients = hasPrimaryHoney
      ? result.ingredients.map((ingredient) =>
          isRecord(ingredient) &&
          typeof ingredient.name === "string" &&
          ingredient.name.trim().toLowerCase() === "honey" &&
          ingredient.secondary !== true
            ? { ...ingredient, amount: undefined, role: "adjustable_fermentable" }
            : ingredient
        )
      : [...result.ingredients, { name: "Honey", role: "adjustable_fermentable" }];
  }
  if (
    typeof result.targetOriginalGravity === "number" &&
    Array.isArray(result.ingredients) &&
    result.ingredients.some(
      (ingredient) =>
        isRecord(ingredient) &&
        typeof ingredient.name === "string" &&
        !/^(?:honey|water)$/i.test(ingredient.name.trim())
    ) &&
    !result.ingredients.some(
      (ingredient) =>
        isRecord(ingredient) &&
        typeof ingredient.name === "string" &&
        !ingredient.secondary &&
        ingredient.role === "adjustable_fermentable"
    ) &&
    !result.ingredients.some(
      (ingredient) =>
        isRecord(ingredient) &&
        typeof ingredient.name === "string" &&
        !ingredient.secondary &&
        ingredient.name.trim().toLowerCase() === "honey"
    )
  ) {
    result.ingredients = [
      ...result.ingredients,
      { name: "Honey", role: "adjustable_fermentable" }
    ];
  }
  return result;
}

function honeyAmountFromMessage(message: string): boolean {
  return hasExplicitIngredientAmount(message, "honey");
}

function hasExplicitIngredientAmount(message: string, ingredientPattern: string): boolean {
  const amount = "(?:\\d+(?:\\.\\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)";
  const unit = "(?:lb|lbs|pounds?|kg|kilograms?|oz|ounces?)";
  return new RegExp(
    `(?:\\b${amount}\\s*${unit}(?:\\s+of)?\\s+${ingredientPattern}\\b|\\b${ingredientPattern}[^.]{0,50}\\b${amount}\\s*${unit}\\b)`,
    "i"
  ).test(message);
}

function userSelectedHoneyAsAdjustable(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    /^(?:the\s+)?honey[.!]?$/.test(normalized) ||
    /\b(?:adjust|reduce|use|make)\b[^.]{0,30}\bhoney\b/i.test(message)
  );
}

function declinesStabilizers(message: string): boolean {
  return /\b(?:no|without|do\s+not|don't|will\s+not|won't)\b[^.]{0,50}\b(?:back\s*-?sweeten(?:ing|ed)?|stabili[sz](?:e|ed|ing|ation|ers?)|sulfites?|metabisulfites?|k\s*-?meta|campden)\b/i.test(
    message
  );
}

function batchVolumeFromMessage(
  message: string
): { value: number; unit: "gal" | "L" } | undefined {
  const match = message.match(
    /\b(?:around\s+|about\s+|approximately\s+)?(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\s*(gallons?|gals?|liters?|litres?|l)\b/i
  );
  if (!match) return undefined;
  const numberWords: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10
  };
  const value = Number(match[1]) || numberWords[match[1]?.toLowerCase() ?? ""];
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return { value, unit: /^l/i.test(match[2] ?? "") ? "L" : "gal" };
}

function fermentationFinalGravityFromMessage(message: string): number | undefined {
  if (/\b(?:finish|end|ferment)\s+dry\b/i.test(message)) return 0.999;
  if (/\bback[\s-]?sweeten(?:ing|ed)?\b/i.test(message)) return 0.999;
  const finalGravity = message.match(
    /\b(?:fermentation\s+)?(?:final\s+)?(?:fg|gravity)\s*(?:of|is|=|to)?\s*(0\.\d{3,4})\b/i
  );
  if (finalGravity) return Number(finalGravity[1]);
  return undefined;
}

function duplicateIngredientsAcrossStages(ingredients: unknown): unknown {
  if (!Array.isArray(ingredients)) return ingredients;
  const result = ingredients.map((ingredient) =>
    isRecord(ingredient) ? { ...ingredient } : ingredient
  );
  for (const ingredient of ingredients) {
    if (!isRecord(ingredient) || typeof ingredient.name !== "string") continue;
    if (/^(?:honey|water)$/i.test(ingredient.name)) continue;
    const sameName = (candidate: unknown) =>
      isRecord(candidate) && candidate.name === ingredient.name;
    const hasPrimary = ingredients.some(
      (candidate) => sameName(candidate) && candidate.secondary !== true
    );
    const hasSecondary = ingredients.some(
      (candidate) => sameName(candidate) && candidate.secondary === true
    );
    if (ingredient.secondary !== true && !hasSecondary) {
      result.push({ ...ingredient, secondary: true });
    }
    if (ingredient.secondary === true && !hasPrimary) {
      result.push({ ...ingredient, secondary: false });
    }
  }
  return result;
}

function mergeRecord(previous: unknown, next: unknown): unknown {
  if (!isRecord(previous)) return next;
  if (!isRecord(next)) return previous;
  return { ...previous, ...next };
}

function mergeRecipeIngredients(
  previous: BuildRecipeDraftInput["ingredients"],
  next: unknown[],
  latestUserMessage: string
): unknown[] {
  const merged = [...previous];
  for (const ingredient of next) {
    if (!isRecord(ingredient) || typeof ingredient.name !== "string") {
      merged.push(ingredient as BuildRecipeDraftInput["ingredients"][number]);
      continue;
    }
    const ingredientName = ingredient.name;
    const ingredientIsSecondary = ingredient.secondary === true;
    const index = merged.findIndex(
      (candidate) =>
        candidate.name.trim().toLowerCase() === ingredientName.trim().toLowerCase() &&
        (candidate.secondary === true) === ingredientIsSecondary
    );
    if (index === -1) {
      merged.push(ingredient as BuildRecipeDraftInput["ingredients"][number]);
    } else {
      const priorIngredient = merged[index];
      merged[index] = {
        ...priorIngredient,
        ...ingredient,
        ...(shouldPreserveIngredientAmount(priorIngredient, ingredient, latestUserMessage)
          ? { amount: priorIngredient.amount }
          : {})
      };
    }
  }
  return merged;
}

/** Do not let a model silently change a user-supplied ingredient amount. */
function shouldPreserveIngredientAmount(
  previous: BuildRecipeDraftInput["ingredients"][number],
  next: Record<string, unknown>,
  latestUserMessage: string
): boolean {
  if (!previous.amount || next.amount === undefined) return false;
  const ingredientName = escapeRegExp(previous.name.trim());
  return (
    !hasExplicitIngredientAmount(latestUserMessage, ingredientName) &&
    !userRequestsIngredientAmountChange(latestUserMessage, ingredientName)
  );
}

function userRequestsIngredientAmountChange(message: string, ingredientPattern: string): boolean {
  return new RegExp(
    `(?:\\b(?:adjust|reduce|increase|change|replace|remove)\\b[^.]{0,50}\\b${ingredientPattern}\\b|\\b${ingredientPattern}\\b[^.]{0,50}\\b(?:adjust|reduce|increase|change|replace|remove)\\b)`,
    "i"
  ).test(message);
}

function mergeCalculatedGravityTarget(
  previous: BuildRecipeDraftInput | undefined,
  execution: unknown
): BuildRecipeDraftInput | undefined {
  if (!isRecord(execution) || execution.status !== "ok") return previous;
  const calculation = gravityTargetCalculationResultSchema.safeParse(execution.result);
  if (!calculation.success || calculation.data.status !== "calculation") return previous;
  return buildRecipeDraftInputSchema.parse({
    ...(previous ?? {}),
    targetOriginalGravity: calculation.data.targetOriginalGravity
  });
}

function mergeExactYeastLookup(
  previous: BuildRecipeDraftInput | undefined,
  execution: unknown,
  latestUserMessage: string
): BuildRecipeDraftInput | undefined {
  if (!previous || !isRecord(execution) || execution.status !== "ok" || !Array.isArray(execution.result)) {
    return previous;
  }
  const normalizedMessage = latestUserMessage.toLowerCase();
  const exact = execution.result.find(
    (yeast) =>
      isRecord(yeast) &&
      typeof yeast.name === "string" &&
      new RegExp(`\\b${escapeRegExp(yeast.name)}\\b`, "i").test(normalizedMessage)
  );
  if (!isRecord(exact)) return previous;
  const nitrogenRequirement = exact.nitrogenRequirement;
  if (
    typeof exact.id !== "number" ||
    typeof exact.brand !== "string" ||
    typeof exact.name !== "string" ||
    nitrogenRequirement !== "Very Low" &&
    nitrogenRequirement !== "Low" &&
    nitrogenRequirement !== "Medium" &&
    nitrogenRequirement !== "High" &&
    nitrogenRequirement !== "Very High"
  ) {
    return previous;
  }
  return buildRecipeDraftInputSchema.parse({
    ...previous,
    nutrients: {
      enabled: true,
      ...previous.nutrients,
      yeastId: exact.id,
      yeastBrand: exact.brand,
      yeastStrain: exact.name,
      nitrogenRequirement
    }
  });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function emptyUsage(): Omit<ChatTurnUsage, "provider" | "model" | "toolCalls" | "latencyMs"> {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0, cachedInputTokens: 0, requestIds: [] };
}

function collectUsage(
  aggregate: ReturnType<typeof emptyUsage>,
  completion: FireworksCompletion
): void {
  aggregate.inputTokens += completion.usage.inputTokens;
  aggregate.outputTokens += completion.usage.outputTokens;
  aggregate.totalTokens += completion.usage.totalTokens;
  aggregate.cachedInputTokens += completion.usage.cachedInputTokens;
  aggregate.requestIds.push(completion.id);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function postToolInstruction(
  toolName: string,
  execution: unknown,
  continueRecipeDraft = false,
  repeatedQuestionAnswer = false
): string {
  if (repeatedQuestionAnswer) {
    return "Your last tool result would repeat questions that were already shown before the user's latest reply. Do not repeat them. Read the latest user message, extract every answer it contains into build_recipe_draft arguments, and call the tool again. If an answer is genuinely still missing, ask only that narrower remaining question.";
  }
  if (toolName === "calculate_gravity_target" && continueRecipeDraft) {
    return "The gravity target is authoritative recipe context, not the final answer. Continue the recipe draft now using its target original gravity. Search the ingredient catalog only if a named ingredient is still unresolved. Do not end the response after reporting the gravity calculation.";
  }
  if (toolName === "build_recipe_draft" && buildNeedsCatalogLookup(execution)) {
    return "The draft is missing Brix for a named ingredient. Call search_ingredients for that ingredient now. If the catalog returns a match, call build_recipe_draft again using the returned catalogId, category, and Brix. Do not ask the user for Brix while the catalog can resolve it.";
  }
  if (
    toolName === "build_recipe_draft" ||
    toolName === "explain_recipe"
  ) {
    if (toolName === "build_recipe_draft" && isRecipeNeedsInput(execution)) {
      return "The tool returned the authoritative intake state. Reply conversationally in no more than 120 words: briefly acknowledge the concrete details the user already supplied, then ask at most three grouped, high-impact remaining questions. Do not repeat an answered question, dump the full workflow checklist, mention catalog/tool/internal values, or give brewing advice. Do not call another tool in this response.";
    }
    return "The previous tool result is the complete authoritative recipe context for this turn. Render only its returned recipe facts, assumptions, warnings, questions, and explanation. Keep a completed draft concise: use a clear title and short sections, stay under 500 words, and do not use emoji. Render recipeData.ingredients only in an Ingredients section. Render recipeData.additives only in a separate Additives section; never place an additive such as vanilla in Ingredients. A completed draft already includes its nutrient plan: do not ask a follow-up question or request yeast amounts after rendering it. When honey was implied for a mead draft, treat the plain Honey entry as the chosen adjustable fermentable; do not ask for a honey variety. Do not add a notes section, brewing advice, ingredient characterization, fermentation prediction, stabilization recommendation, save confirmation, causal mechanism, or inferred explanation beyond the exact returned explanation summary and facts. To add any process guidance, first search and fetch a relevant wiki page, then cite its canonical URL.";
  }
  if (toolName === "fetch_wiki_page") {
    return "Use the retrieved page as evidence for any process guidance or clearly labeled recipe-draft assumption. Cite its canonical URL next to each grounded claim. If this is a recipe-design request, continue with the required catalog lookup and recipe-draft tools instead of replying from the page alone.";
  }
  if (toolName === "search_ingredients") {
    if (isRecord(execution) && execution.status === "ok" && Array.isArray(execution.result) && execution.result.length === 0) {
      return "The ingredient catalog has no match. Tell the user that MeadTools could not identify that ingredient and ask them to clarify the ingredient or provide a label/analysis. Do not invent a Brix value.";
    }
    return "Do not report search details to the user. Immediately call build_recipe_draft using the matched ingredient's catalogId, category, and Brix. Add the ingredient at its intended stage, then let the workflow ask only for genuinely missing inputs. Do not ask the user for Brix or repeat catalog IDs.";
  }
  if (toolName === "search_yeasts") {
    if (isRecord(execution) && execution.status === "ok" && Array.isArray(execution.result) && execution.result.length === 0) {
      return "No matching MeadTools yeast was found. Ask the user for a more specific brand or strain, or offer to choose a catalog yeast. Do not ask them for nitrogen requirement or describe the search implementation.";
    }
    return "Do not report catalog IDs, internal fields, or tool details. Use the selected yeast's exact ID, brand, strain, and nitrogen requirement in build_recipe_draft, then ask only for remaining nutrient inputs.";
  }
  return "Search results are routing information, not evidence. Fetch a selected wiki page before making a process claim.";
}

function isRepeatedQuestionAnswer(request: ChatRequest, answer: string): boolean {
  const previousAssistantAnswer = [...request.messages]
    .reverse()
    .find((message) => message.role === "assistant")?.content;
  return previousAssistantAnswer?.trim() === answer.trim();
}

/**
 * The deterministic workflows already carry the complete answer for missing
 * inputs and calculation explanations. Rendering these two shapes directly
 * avoids an extra model pass that could embellish them with uncited process
 * guidance or substitute a calculation of its own.
 */
export function directRecipeToolAnswer(
  toolName: string,
  execution: unknown
): string | undefined {
  if (
    toolName === "search_ingredients" &&
    isRecord(execution) &&
    execution.status === "ok" &&
    Array.isArray(execution.result) &&
    execution.result.length === 0
  ) {
    return "MeadTools could not identify that ingredient well enough to calculate the draft without guessing. Please provide the product label or a measured sugar reading, and I will use it while keeping the other recipe details unchanged.";
  }
  if (toolName === "calculate_gravity_target") {
    return directGravityTargetAnswer(execution);
  }
  if (
    toolName !== "build_recipe_draft" &&
    toolName !== "explain_recipe"
  ) {
    return undefined;
  }
  if (!isRecord(execution) || execution.status !== "ok") return undefined;

  const workflow = chatbotRecipeWorkflowResultSchema.safeParse(execution.result);
  if (!workflow.success) return undefined;

  if (workflow.data.status === "needs_input") {
    if (toolName === "build_recipe_draft" && workflow.data.questions.some((question) => question.id.endsWith("_brix"))) {
      return undefined;
    }
    return undefined;
  }
  if (workflow.data.status === "error") return workflow.data.message;
  if (toolName !== "explain_recipe" || !workflow.data.explanation) return undefined;

  const facts = workflow.data.explanation.facts
    .map((fact) => `- **${fact.label}:** ${formatCalculationValue(fact.value)}`)
    .join("\n");
  const assumptions = workflow.data.assumptions.map((item) => `- ${item}`).join("\n");
  const warnings = workflow.data.warnings.map((item) => `- ${item}`).join("\n");

  return [
    workflow.data.explanation.summary,
    facts,
    assumptions ? `**Assumptions**\n${assumptions}` : "",
    warnings ? `**Warnings**\n${warnings}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");
}

function isRecipeNeedsInput(execution: unknown): boolean {
  if (!isRecord(execution) || execution.status !== "ok") return false;
  const workflow = chatbotRecipeWorkflowResultSchema.safeParse(execution.result);
  return workflow.success && workflow.data.status === "needs_input";
}

function buildNeedsCatalogLookup(execution: unknown): boolean {
  if (!isRecord(execution) || execution.status !== "ok") return false;
  const workflow = chatbotRecipeWorkflowResultSchema.safeParse(execution.result);
  return workflow.success && workflow.data.status === "needs_input" && workflow.data.questions.some(
    (question) => question.id.endsWith("_brix")
  );
}

function directGravityTargetAnswer(execution: unknown): string | undefined {
  if (!isRecord(execution) || execution.status !== "ok") return undefined;

  const calculation = gravityTargetCalculationResultSchema.safeParse(execution.result);
  if (!calculation.success) return undefined;
  if (calculation.data.status === "needs_input") {
    return calculation.data.questions.map((question) => question.prompt).join("\n\n");
  }
  if (calculation.data.status === "error") return calculation.data.message;

  return [
    "MeadTools calculated this gravity target with the shared calculation engine:",
    `- **Target ABV:** ${formatCalculationValue(calculation.data.targetAbv)}%`,
    `- **Planned fermentation final gravity:** ${formatCalculationValue(calculation.data.fermentationFinalGravity)}`,
    `- **Base original gravity for that ABV:** ${formatCalculationValue(calculation.data.baseOriginalGravity)}`,
    `- **Additional OG points:** ${formatCalculationValue(calculation.data.additionalOgPoints)}`,
    `- **Target original gravity after the offset:** ${formatCalculationValue(calculation.data.targetOriginalGravity)}`,
    `- **Calculated ABV at that target:** ${formatCalculationValue(calculation.data.calculatedAbvAtTargetOg)}%`
  ].join("\n");
}

function formatCalculationValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3);
}

/** Remove internal recipe-model labels if a provider echoes them in prose. */
function sanitizeUserFacingRecipeAnswer(answer: string): string {
  return answer
    .replace(/\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0E|\uFE0F)?)*?/gu, "")
    .replace(/[\uFE0E\uFE0F]/g, "")
    .replace(/\s*\(catalog\)/gi, "")
    .replace(/\s*\(adjustable(?:\s+fermentable)?\)/gi, "")
    .replace(/\s*\([^)]*\bBrix\b[^)]*\)/gi, "")
    .replace(/\s*\(justK\)/gi, "")
    .replace(/\s*\(kmeta\)/gi, "")
    // A completed draft is authoritative; a model must not append an invented
    // intake question after it. Questions issued by the workflow are rendered
    // in their own turn before a draft exists.
    .replace(/\n{2,}(?:\*{0,2}next steps:?\*{0,2})[\s\S]*$/i, "")
    .replace(/^\s*Do not ask them about catalog IDs or internal fields\.\s*$/gim, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
