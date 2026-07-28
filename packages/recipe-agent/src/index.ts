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
export type CatalogAgentToolName = "search_ingredients" | "search_yeasts";
export type CatalogAgentToolExecution =
  | { status: "ok"; result: CatalogIngredient[] | CatalogYeast[] }
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

export type HostedAgentTool = RecipeAgentTool | GravityTargetAgentTool | WikiAgentTool | typeof ingredientSearchAgentTool | typeof yeastSearchAgentTool;
export const hostedAgentTools: readonly HostedAgentTool[] = [
  ...recipeAgentTools,
  gravityTargetAgentTool,
  ingredientSearchAgentTool,
  yeastSearchAgentTool,
  ...wikiAgentTools
];

export type HostedAgentToolDefinition = {
  name: RecipeAgentToolName | WikiAgentToolName | CatalogAgentToolName | typeof gravityTargetToolName;
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
    name: "search_ingredients",
    description: descriptionFor("search_ingredients"),
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
  | CatalogAgentToolExecution
  | WikiAgentToolExecution;

export async function executeHostedAgentTool(
  toolName: string,
  input: unknown,
  options: {
    fetcher?: WikiFetcher;
    ingredientLookup?: IngredientLookup;
    yeastLookup?: YeastLookup;
  } = {}
): Promise<HostedAgentToolExecution> {
  if (recipeAgentTools.some((tool) => tool.name === toolName)) {
    return executeRecipeAgentTool(toolName, input);
  }
  if (toolName === gravityTargetToolName) {
    return executeGravityTargetAgentTool(input);
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

  const tool = createWikiAgentTools(options).find(
    (candidate) => candidate.name === toolName
  );
  if (!tool) return { status: "unknown_tool", toolName };

  return tool.execute(input);
}

function invalidInput(
  issues: Array<{ path: Array<PropertyKey>; message: string }>
): WikiAgentToolExecution {
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
  toolName: RecipeAgentToolName | WikiAgentToolName | CatalogAgentToolName | typeof gravityTargetToolName
): string {
  const tool = hostedAgentTools.find((candidate) => candidate.name === toolName);
  if (!tool) throw new Error(`Missing hosted agent tool definition for ${toolName}.`);
  return tool.description;
}
