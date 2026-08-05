import {
  buildRecipeDraft,
  buildRecipeDraftInputSchema,
  calculateGravityTarget,
  calculateGravityTargetInputSchema,
  explainRecipe,
  explainRecipeInputSchema,
  type ChatbotRecipeWorkflowResult
} from "@meadtools/recipe-workflows";
import {
  fetchWikiPage,
  searchWikiIndex,
  type WikiFetcher,
  type WikiPageContent,
  type WikiSearchResult
} from "@meadtools/wiki-knowledge";
import {
  brewActionStages,
  createBrewActionProposal,
  type BrewActionProposal,
  type BrewActionTarget
} from "@meadtools/brew-domain/action-proposal";
import { z } from "zod";

export { hostedAgentPolicy } from "./policy";

export type RecipeAgentToolName =
  | "build_recipe_draft"
  | "explain_recipe";

export type RecipeAgentTool = {
  name: RecipeAgentToolName;
  description: string;
  inputSchema: {
    safeParse: (input: unknown) => { success: boolean };
  };
  execute: (input: unknown) => ChatbotRecipeWorkflowResult;
};

/**
 * Provider-neutral definitions for a future hosted model adapter. The adapter
 * may expose these as provider tools, but authoritative recipe work stays in
 * @meadtools/recipe-workflows.
 */
export const recipeAgentTools: readonly RecipeAgentTool[] = [
  {
    name: "build_recipe_draft",
    description:
      "Guide intake and create an unsaved MeadTools recipe draft for any recipe shape. It returns only the high-impact missing inputs until it can construct and calculate a valid recipe payload.",
    inputSchema: buildRecipeDraftInputSchema,
    execute: buildRecipeDraft
  },
  {
    name: "explain_recipe",
    description:
      "Return fresh calculation-engine facts that explain one aspect of an active recipe draft without modifying it.",
    inputSchema: explainRecipeInputSchema,
    execute: explainRecipe
  }
];

const gravityTargetToolName = "calculate_gravity_target" as const;
const prepareBrewActionToolName = "prepare_brew_action" as const;

export type GravityTargetAgentTool = {
  name: typeof gravityTargetToolName;
  description: string;
  inputSchema: {
    safeParse: (input: unknown) => { success: boolean };
  };
  execute: (input: unknown) => ReturnType<typeof calculateGravityTarget>;
};

export const gravityTargetAgentTool: GravityTargetAgentTool = {
  name: gravityTargetToolName,
  description:
    "Use MeadTools' shared calculation engine to find an original-gravity target from an ABV target and planned final gravity, with an optional extra OG-point offset.",
  inputSchema: calculateGravityTargetInputSchema,
  execute: calculateGravityTarget
};

export function executeGravityTargetAgentTool(input: unknown) {
  return { status: "ok" as const, result: gravityTargetAgentTool.execute(input) };
}

const actionEntryBaseSchema = z.object({
  datetime: z.string().datetime().optional(),
  title: z.string().trim().min(1).max(160).optional(),
  note: z.string().trim().min(1).max(2_000).optional()
});

const brewActionEntryInputSchema = z.discriminatedUnion("type", [
  actionEntryBaseSchema.extend({
    type: z.enum(["NOTE", "TASTING", "ISSUE"]),
    note: z.string().trim().min(1).max(2_000)
  }),
  actionEntryBaseSchema.extend({
    type: z.literal("ADDITION"),
    data: z.object({
      kind: z.enum(["INGREDIENT", "NUTRIENT", "YEAST", "OTHER"]),
      name: z.string().trim().min(1).max(160),
      amount: z.number().positive().optional(),
      unit: z.string().trim().min(1).max(30).optional()
    })
  }),
  actionEntryBaseSchema.extend({
    type: z.literal("GRAVITY"),
    gravity: z.number().min(0.9).max(1.3),
    data: z.object({
      readingRole: z.enum(["OG", "FG", "GENERAL"]).optional(),
      source: z.literal("measured").optional()
    }).optional()
  }),
  actionEntryBaseSchema.extend({
    type: z.literal("TEMPERATURE"),
    temperature: z.number().min(-50).max(150),
    temp_units: z.enum(["C", "F"])
  }),
  actionEntryBaseSchema.extend({
    type: z.literal("PH"),
    data: z.object({ ph: z.number().min(0).max(14) })
  }),
  actionEntryBaseSchema.extend({
    type: z.literal("VOLUME"),
    data: z.object({
      liters: z.number().positive(),
      displayValue: z.number().positive().optional(),
      displayUnit: z.string().trim().min(1).max(30).optional(),
      startingLiters: z.number().positive().optional()
    })
  }),
  actionEntryBaseSchema.extend({
    type: z.literal("STAGE_CHANGE"),
    stage_to: z.enum(brewActionStages)
  })
]);

export type BrewActionAgentTool = {
  name: typeof prepareBrewActionToolName;
  description: string;
  inputSchema: typeof brewActionEntryInputSchema;
};

/**
 * This tool validates only an action draft. A trusted adapter binds it to the
 * selected brew context; the model cannot choose a different account record.
 */
export const prepareBrewActionAgentTool: BrewActionAgentTool = {
  name: prepareBrewActionToolName,
  description:
    "Prepare a reviewable action for the explicitly selected brew. Use only after get_selected_account_context returned a brew and only when the user asks to log or make a specific brew change. It creates no entry and changes nothing. Provide the exact entry payload for a note, addition, measurement, volume reading, or stage change; do not include a brew ID, client ID, recipe ID, or device action.",
  inputSchema: brewActionEntryInputSchema
};

export type BrewActionAgentToolExecution =
  | { status: "ok"; result: BrewActionProposal }
  | { status: "invalid_input"; issues: string[] }
  | { status: "error"; message: string };

export function executePrepareBrewActionTool(
  input: unknown,
  target: BrewActionTarget | undefined
): BrewActionAgentToolExecution {
  const parsed = brewActionEntryInputSchema.safeParse(input);
  if (!parsed.success) return invalidInput(parsed.error.issues);
  if (!target) {
    return {
      status: "error",
      message: "Select a brew and retrieve its context before preparing an action."
    };
  }
  return {
    status: "ok",
    result: createBrewActionProposal(target, parsed.data)
  };
}

export type RecipeAgentToolExecution =
  | { status: "ok"; result: ChatbotRecipeWorkflowResult }
  | { status: "unknown_tool"; toolName: string };

export function executeRecipeAgentTool(
  toolName: string,
  input: unknown
): RecipeAgentToolExecution {
  const tool = recipeAgentTools.find((candidate) => candidate.name === toolName);
  if (!tool) return { status: "unknown_tool", toolName };

  return { status: "ok", result: tool.execute(input) };
}

const wikiSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(500),
  limit: z.number().int().min(1).max(10).optional()
});

const wikiFetchInputSchema = z.object({
  url: z.string().trim().min(1).max(2_000)
});

// Accept legacy query fields but intentionally ignore them: the model now
// receives the complete compact catalog and performs the semantic selection.
const ingredientCatalogInputSchema = z.object({}).passthrough();

const yeastSearchInputSchema = z.object({
  query: z.string().trim().min(2).max(160),
  limit: z.number().int().min(1).max(10).optional()
});

export type CatalogIngredient = {
  id: number;
  name: string;
  category: string;
  brix: number;
};

/**
 * The ingredient catalog is intentionally small (under 200 entries). A recipe
 * agent receives the complete compact list, selects the best semantic match,
 * and then uses that entry's authoritative fields in the draft workflow.
 */
export type IngredientLookup = () => Promise<CatalogIngredient[]>;
export type CatalogAdditive = {
  id: string;
  name: string;
  /** The catalog's standard amount per US gallon. */
  dosagePerGallon: number;
  unit: string;
};
export type AdditiveLookup = () => Promise<CatalogAdditive[]>;
export type CatalogYeast = {
  id: number;
  brand: string;
  name: string;
  nitrogenRequirement: "Very Low" | "Low" | "Medium" | "High" | "Very High";
  tolerance: number | undefined;
  lowTemperature: number | undefined;
  highTemperature: number | undefined;
};

export type YeastLookup = (query: string, limit: number) => Promise<CatalogYeast[]>;
export type CatalogAgentToolName = "search_ingredients" | "search_additives" | "search_yeasts";
export type CatalogAgentToolExecution =
  | { status: "ok"; result: CatalogIngredient[] | CatalogAdditive[] | CatalogYeast[] }
  | { status: "invalid_input"; issues: string[] }
  | { status: "error"; message: string };

export const ingredientSearchAgentTool = {
  name: "search_ingredients" as const,
  description:
    "Return the complete compact MeadTools ingredient catalog (under 200 entries) with canonical name, category, catalog ID, and Brix. Use it once before drafting with named ingredients other than water or honey. Choose the best semantic match yourself from the returned list, including plural, regional, or descriptive wording, and use its returned values exactly.",
  inputSchema: ingredientCatalogInputSchema
};

export const yeastSearchAgentTool = {
  name: "search_yeasts" as const,
  description:
    "Search the MeadTools yeast catalog by brand or strain. Returns the exact catalog yeast identity plus authoritative nitrogen requirement, alcohol tolerance, and temperature range. Use it before asking a user to supply a catalog yeast's nutrient requirement.",
  inputSchema: yeastSearchInputSchema
};

export const additiveSearchAgentTool = {
  name: "search_additives" as const,
  description:
    "Return the complete MeadTools additive catalog with each additive's canonical unit and standard dosage per US gallon. Use it before drafting with a named catalog additive when the user did not supply both an amount and unit. Select the best semantic match, preserve its canonical unit, and multiply its dosage per gallon by the requested batch volume. Do not invent an additive unit or dose.",
  inputSchema: ingredientCatalogInputSchema
};

export type WikiAgentToolName = "search_wiki" | "fetch_wiki_page";

export type WikiAgentToolExecution =
  | { status: "ok"; result: WikiSearchResult[] | WikiPageContent }
  | { status: "invalid_input"; issues: string[] }
  | { status: "error"; message: string };

export type WikiAgentTool = {
  name: WikiAgentToolName;
  description: string;
  inputSchema: {
    safeParse: (input: unknown) => { success: boolean };
  };
  execute: (input: unknown) => Promise<WikiAgentToolExecution>;
};

export function createWikiAgentTools(
  options: { fetcher?: WikiFetcher } = {}
): readonly WikiAgentTool[] {
  return [
    {
      name: "search_wiki",
      description:
        "Search the reviewed MeadTools wiki catalog for process, technique, troubleshooting, or ingredient guidance. Fetch a selected page before making a factual process claim.",
      inputSchema: wikiSearchInputSchema,
      async execute(input) {
        const parsed = wikiSearchInputSchema.safeParse(input);
        if (!parsed.success) return invalidInput(parsed.error.issues);

        return {
          status: "ok",
          result: searchWikiIndex(parsed.data.query, { limit: parsed.data.limit })
        };
      }
    },
    {
      name: "fetch_wiki_page",
      description:
        "Fetch one approved MeadTools wiki page selected from search results. Cite the returned canonical URL when using the page for brewing guidance.",
      inputSchema: wikiFetchInputSchema,
      async execute(input) {
        const parsed = wikiFetchInputSchema.safeParse(input);
        if (!parsed.success) return invalidInput(parsed.error.issues);

        try {
          return {
            status: "ok",
            result: await fetchWikiPage(parsed.data.url, options)
          };
        } catch (error) {
          return {
            status: "error",
            message: error instanceof Error ? error.message : "Wiki retrieval failed."
          };
        }
      }
    }
  ];
}

/**
 * Wiki tools are kept separate from recipeAgentTools so existing deterministic
 * recipe consumers do not gain HTTP behavior implicitly. A hosted adapter can
 * opt into this complete surface explicitly.
 */
export const wikiAgentTools = createWikiAgentTools();

export type HostedAgentTool = RecipeAgentTool | GravityTargetAgentTool | BrewActionAgentTool | WikiAgentTool | typeof ingredientSearchAgentTool | typeof additiveSearchAgentTool | typeof yeastSearchAgentTool;
export const hostedAgentTools: readonly HostedAgentTool[] = [
  ...recipeAgentTools,
  gravityTargetAgentTool,
  prepareBrewActionAgentTool,
  ingredientSearchAgentTool,
  additiveSearchAgentTool,
  yeastSearchAgentTool,
  ...wikiAgentTools
];

export type HostedAgentToolDefinition = {
  name: RecipeAgentToolName | WikiAgentToolName | CatalogAgentToolName | typeof gravityTargetToolName | typeof prepareBrewActionToolName;
  description: string;
  parameters: Record<string, unknown>;
};

/**
 * JSON Schema definitions are deliberately provider-neutral. Recipe refinement
 * and explanation receive the active draft from the authenticated server
 * request, never from model-controlled tool arguments.
 */
export const hostedAgentToolDefinitions: readonly HostedAgentToolDefinition[] = [
  {
    name: "build_recipe_draft",
    description: descriptionFor("build_recipe_draft"),
    parameters: {
      type: "object",
      properties: {
        batchVolume: {
          type: "object",
          properties: {
            value: { type: "number", minimum: 0.001 },
            unit: { type: "string", enum: ["gal", "L"] }
          },
          additionalProperties: false
        },
        name: { type: "string", maxLength: 160 },
        style: { type: "string", maxLength: 80 },
        targetOriginalGravity: { type: "number", minimum: 1.001, maximum: 1.2 },
        fermentationFinalGravity: { type: "number", minimum: 0.97, maximum: 1.2 },
        backsweetening: {
          type: "object",
          properties: {
            targetFinalGravity: { type: "number", minimum: 0.97, maximum: 1.2 },
            sweetener: {
              type: "object",
              properties: {
                name: { type: "string", minLength: 1, maxLength: 160 },
                catalogId: { type: "integer", minimum: 1 },
                category: { type: "string", minLength: 1, maxLength: 80 },
                brix: { type: "number", minimum: 0, maximum: 100 }
              },
              required: ["name"],
              additionalProperties: false
            }
          },
          required: ["targetFinalGravity"],
          additionalProperties: false
        },
        ingredients: {
          type: "array",
          maxItems: 30,
          items: {
            type: "object",
            properties: {
              name: { type: "string", minLength: 1, maxLength: 160 },
              catalogId: { type: "integer", minimum: 1 },
              category: { type: "string", minLength: 1, maxLength: 80 },
              brix: { type: "number", minimum: 0, maximum: 100 },
              secondary: { type: "boolean" },
              role: { type: "string", enum: ["fixed", "adjustable_fermentable", "fill_liquid"] },
              amount: {
                type: "object",
                properties: {
                  kind: { type: "string", enum: ["weight", "volume"] },
                  value: { type: "number", minimum: 0.000001 },
                  unit: { type: "string", enum: ["kg", "g", "lb", "oz", "L", "mL", "gal", "qt", "pt", "fl_oz", "imp_gal", "imp_qt", "imp_pt", "imp_fl_oz"] }
                },
                required: ["kind", "value", "unit"],
                additionalProperties: false
              }
            },
            required: ["name"],
            additionalProperties: false
          }
        },
        additives: {
          type: "array",
          maxItems: 20,
          items: {
            type: "object",
            properties: { name: { type: "string", minLength: 1, maxLength: 160 }, amount: { type: "number", minimum: 0.000001 }, unit: { type: "string", minLength: 1, maxLength: 30 } },
            required: ["name", "amount", "unit"],
            additionalProperties: false
          }
        },
        nutrients: {
          type: "object",
          properties: {
            enabled: { const: true },
            yeastBrand: { type: "string" },
            yeastStrain: { type: "string" },
            yeastId: { type: "integer", minimum: 1 },
            nitrogenRequirement: {
              type: "string",
              enum: ["Very Low", "Low", "Medium", "High", "Very High"]
            },
            schedule: {
              type: "string",
              enum: ["tbe", "tosna", "justK", "dap", "oAndk", "oAndDap", "kAndDap", "other"]
            },
            numberOfAdditions: { type: "integer", minimum: 1, maximum: 10 },
            goFermType: {
              type: "string",
              enum: ["Go-Ferm", "protect", "sterol-flash", "none"]
            }
          },
          required: ["enabled"],
          additionalProperties: false
        },
        stabilizers: {
          type: "object",
          properties: {
            enabled: { type: "boolean" },
            type: { type: "string", enum: ["kmeta", "nameta"] },
            phReading: { type: "number", minimum: 2, maximum: 5 }
          },
          required: ["enabled"],
          additionalProperties: false
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "explain_recipe",
    description: descriptionFor("explain_recipe"),
    parameters: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["abv", "gravity", "volume", "nutrients", "stabilizers"]
        }
      },
      additionalProperties: false
    }
  },
  {
    name: gravityTargetToolName,
    description: descriptionFor(gravityTargetToolName),
    parameters: {
      type: "object",
      properties: {
        targetAbv: { type: "number", minimum: 0, maximum: 30 },
        fermentationFinalGravity: { type: "number", minimum: 0.97, maximum: 1.2 },
        additionalOgPoints: { type: "number", minimum: 0, maximum: 100 }
      },
      required: ["targetAbv"],
      additionalProperties: false
    }
  },
  {
    name: prepareBrewActionToolName,
    description: descriptionFor(prepareBrewActionToolName),
    parameters: {
      type: "object",
      oneOf: [
        {
          properties: {
            type: { type: "string", enum: ["NOTE", "TASTING", "ISSUE"] },
            title: { type: "string", minLength: 1, maxLength: 160 },
            note: { type: "string", minLength: 1, maxLength: 2000 },
            datetime: { type: "string", format: "date-time" }
          },
          required: ["type", "note"],
          additionalProperties: false
        },
        {
          properties: {
            type: { const: "ADDITION" },
            title: { type: "string", minLength: 1, maxLength: 160 },
            note: { type: "string", minLength: 1, maxLength: 2000 },
            datetime: { type: "string", format: "date-time" },
            data: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["INGREDIENT", "NUTRIENT", "YEAST", "OTHER"] },
                name: { type: "string", minLength: 1, maxLength: 160 },
                amount: { type: "number", exclusiveMinimum: 0 },
                unit: { type: "string", minLength: 1, maxLength: 30 }
              },
              required: ["kind", "name"],
              additionalProperties: false
            }
          },
          required: ["type", "data"],
          additionalProperties: false
        },
        {
          properties: {
            type: { const: "GRAVITY" },
            title: { type: "string", minLength: 1, maxLength: 160 },
            note: { type: "string", minLength: 1, maxLength: 2000 },
            datetime: { type: "string", format: "date-time" },
            gravity: { type: "number", minimum: 0.9, maximum: 1.3 },
            data: {
              type: "object",
              properties: {
                readingRole: { type: "string", enum: ["OG", "FG", "GENERAL"] },
                source: { const: "measured" }
              },
              additionalProperties: false
            }
          },
          required: ["type", "gravity"],
          additionalProperties: false
        },
        {
          properties: {
            type: { const: "TEMPERATURE" },
            title: { type: "string", minLength: 1, maxLength: 160 },
            note: { type: "string", minLength: 1, maxLength: 2000 },
            datetime: { type: "string", format: "date-time" },
            temperature: { type: "number", minimum: -50, maximum: 150 },
            temp_units: { type: "string", enum: ["C", "F"] }
          },
          required: ["type", "temperature", "temp_units"],
          additionalProperties: false
        },
        {
          properties: {
            type: { const: "PH" },
            title: { type: "string", minLength: 1, maxLength: 160 },
            note: { type: "string", minLength: 1, maxLength: 2000 },
            datetime: { type: "string", format: "date-time" },
            data: {
              type: "object",
              properties: { ph: { type: "number", minimum: 0, maximum: 14 } },
              required: ["ph"],
              additionalProperties: false
            }
          },
          required: ["type", "data"],
          additionalProperties: false
        },
        {
          properties: {
            type: { const: "VOLUME" },
            title: { type: "string", minLength: 1, maxLength: 160 },
            note: { type: "string", minLength: 1, maxLength: 2000 },
            datetime: { type: "string", format: "date-time" },
            data: {
              type: "object",
              properties: {
                liters: { type: "number", exclusiveMinimum: 0 },
                displayValue: { type: "number", exclusiveMinimum: 0 },
                displayUnit: { type: "string", minLength: 1, maxLength: 30 },
                startingLiters: { type: "number", exclusiveMinimum: 0 }
              },
              required: ["liters"],
              additionalProperties: false
            }
          },
          required: ["type", "data"],
          additionalProperties: false
        },
        {
          properties: {
            type: { const: "STAGE_CHANGE" },
            title: { type: "string", minLength: 1, maxLength: 160 },
            note: { type: "string", minLength: 1, maxLength: 2000 },
            datetime: { type: "string", format: "date-time" },
            stage_to: { type: "string", enum: [...brewActionStages] }
          },
          required: ["type", "stage_to"],
          additionalProperties: false
        }
      ]
    }
  },
  {
    name: "search_ingredients",
    description: descriptionFor("search_ingredients"),
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "search_additives",
    description: descriptionFor("search_additives"),
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "search_yeasts",
    description: descriptionFor("search_yeasts"),
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 2, maxLength: 160 },
        limit: { type: "integer", minimum: 1, maximum: 10 }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "search_wiki",
    description: descriptionFor("search_wiki"),
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", minLength: 2, maxLength: 500 },
        limit: { type: "integer", minimum: 1, maximum: 10 }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "fetch_wiki_page",
    description: descriptionFor("fetch_wiki_page"),
    parameters: {
      type: "object",
      properties: { url: { type: "string", minLength: 1, maxLength: 2_000 } },
      required: ["url"],
      additionalProperties: false
    }
  }
];

export type HostedAgentToolExecution =
  | RecipeAgentToolExecution
  | ReturnType<typeof executeGravityTargetAgentTool>
  | BrewActionAgentToolExecution
  | CatalogAgentToolExecution
  | WikiAgentToolExecution;

export async function executeHostedAgentTool(
  toolName: string,
  input: unknown,
  options: {
    fetcher?: WikiFetcher;
    ingredientLookup?: IngredientLookup;
    additiveLookup?: AdditiveLookup;
    yeastLookup?: YeastLookup;
    brewActionTarget?: BrewActionTarget;
  } = {}
): Promise<HostedAgentToolExecution> {
  if (recipeAgentTools.some((tool) => tool.name === toolName)) {
    return executeRecipeAgentTool(toolName, input);
  }
  if (toolName === gravityTargetToolName) {
    return executeGravityTargetAgentTool(input);
  }
  if (toolName === prepareBrewActionToolName) {
    return executePrepareBrewActionTool(input, options.brewActionTarget);
  }
  if (toolName === ingredientSearchAgentTool.name) {
    const parsed = ingredientCatalogInputSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error.issues);
    if (!options.ingredientLookup) {
      return { status: "error", message: "Ingredient lookup is not configured for this chat." };
    }
    try {
      return {
        status: "ok",
        result: await options.ingredientLookup()
      };
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Ingredient lookup failed." };
    }
  }
  if (toolName === yeastSearchAgentTool.name) {
    const parsed = yeastSearchInputSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error.issues);
    if (!options.yeastLookup) {
      return { status: "error", message: "Yeast lookup is not configured for this chat." };
    }
    try {
      return {
        status: "ok",
        result: await options.yeastLookup(parsed.data.query, parsed.data.limit ?? 5)
      };
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Yeast lookup failed." };
    }
  }
  if (toolName === additiveSearchAgentTool.name) {
    const parsed = ingredientCatalogInputSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error.issues);
    if (!options.additiveLookup) {
      return { status: "error", message: "Additive lookup is not configured for this chat." };
    }
    try {
      return { status: "ok", result: await options.additiveLookup() };
    } catch (error) {
      return { status: "error", message: error instanceof Error ? error.message : "Additive lookup failed." };
    }
  }

  const tool = createWikiAgentTools(options).find(
    (candidate) => candidate.name === toolName
  );
  if (!tool) return { status: "unknown_tool", toolName };

  return tool.execute(input);
}

function invalidInput(
  issues: Array<{ path: Array<PropertyKey>; message: string }>
): { status: "invalid_input"; issues: string[] } {
  return {
    status: "invalid_input",
    issues: issues.map((issue) =>
      issue.path.length > 0
        ? `${issue.path.map(String).join(".")}: ${issue.message}`
        : issue.message
    )
  };
}

function descriptionFor(
  toolName: RecipeAgentToolName | WikiAgentToolName | CatalogAgentToolName | typeof gravityTargetToolName | typeof prepareBrewActionToolName
): string {
  const tool = hostedAgentTools.find((candidate) => candidate.name === toolName);
  if (!tool) throw new Error(`Missing hosted agent tool definition for ${toolName}.`);
  return tool.description;
}
