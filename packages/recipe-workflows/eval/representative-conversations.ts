import type { TraditionalMeadInput } from "../src/create-traditional";

export type RecipeConversationEvaluation = {
  id: string;
  readiness: "foundation" | "hosted_poc";
  workflow: "create" | "refine" | "explain";
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  toolInput?: TraditionalMeadInput;
  expectedStatus: "needs_input" | "recipe";
  criteria: string[];
};

export const representativeRecipeConversations: RecipeConversationEvaluation[] = [
  {
    id: "create-vague-traditional",
    readiness: "foundation",
    workflow: "create",
    messages: [{ role: "user", content: "Help me make a traditional mead." }],
    toolInput: {},
    expectedStatus: "needs_input",
    criteria: [
      "Asks for volume and strength rather than inventing them.",
      "Distinguishes fermentation FG from perceived sweetness.",
      "Asks about nutrients and stabilizers."
    ]
  },
  {
    id: "create-complete-one-gallon",
    readiness: "foundation",
    workflow: "create",
    messages: [
      {
        role: "user",
        content:
          "Make a 1 gallon traditional at 1.100 OG and 0.996 fermentation FG, without nutrients or stabilizers."
      }
    ],
    toolInput: {
      batchVolume: { value: 1, unit: "gal" },
      targetOriginalGravity: 1.1,
      fermentationFinalGravity: 0.996,
      nutrients: { enabled: false },
      stabilizers: { enabled: false }
    },
    expectedStatus: "recipe",
    criteria: [
      "Returns an authoritative v2 recipe payload.",
      "Uses core calculations for volume, gravity, and ABV.",
      "Does not claim the draft was saved."
    ]
  },
  {
    id: "create-nutrients-missing-details",
    readiness: "foundation",
    workflow: "create",
    messages: [
      {
        role: "user",
        content:
          "Make a 5 liter traditional at 1.090 OG and 0.998 FG. Include nutrients; no stabilizers."
      }
    ],
    toolInput: {
      batchVolume: { value: 5, unit: "L" },
      targetOriginalGravity: 1.09,
      fermentationFinalGravity: 0.998,
      nutrients: { enabled: true },
      stabilizers: { enabled: false }
    },
    expectedStatus: "needs_input",
    criteria: [
      "Requests yeast and nutrient schedule details.",
      "Does not invent authoritative nutrient inputs."
    ]
  },
  {
    id: "refine-active-draft-strength",
    readiness: "hosted_poc",
    workflow: "refine",
    messages: [
      { role: "user", content: "Make that draft a little stronger." }
    ],
    expectedStatus: "recipe",
    criteria: [
      "Clarifies the target when 'a little' is ambiguous.",
      "Recalculates through the deterministic refine operation.",
      "Summarizes exactly what changed."
    ]
  },
  {
    id: "explain-calculated-abv",
    readiness: "hosted_poc",
    workflow: "explain",
    messages: [{ role: "user", content: "Why is the ABV shown as 13.6%?" }],
    expectedStatus: "recipe",
    criteria: [
      "Uses the active draft's derived values.",
      "Explains the inputs without recalculating authoritatively in the model."
    ]
  }
];
