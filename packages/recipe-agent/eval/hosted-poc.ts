import type { RecipeAgentToolName, WikiAgentToolName } from "../src/index";

export type HostedAgentEvaluation = {
  id: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  activeDraft: boolean;
  expectedToolSequence: Array<RecipeAgentToolName | WikiAgentToolName>;
  citationRequired: boolean;
  responseCriteria: string[];
};

/**
 * Provider-independent POC cases. A later provider runner records tool calls
 * and final output against this contract without changing the product intent.
 */
export const hostedPocEvaluations: readonly HostedAgentEvaluation[] = [
  {
    id: "clarify-vague-recipe",
    messages: [{ role: "user", content: "Help me make a blackberry mead." }],
    activeDraft: false,
    expectedToolSequence: [],
    citationRequired: false,
    responseCriteria: [
      "Uses the general recipe-intake path rather than treating a style as a separate calculator.",
      "Asks for batch volume, ingredient details, and explicit strength/gravity targets.",
      "Does not invent nutrient or stabilizer choices."
    ]
  },
  {
    id: "create-complete-recipe",
    messages: [
      {
        role: "user",
        content:
          "Make a 1 gallon honey recipe at 1.100 OG and 0.996 fermentation FG, without nutrients or stabilizers."
      }
    ],
    activeDraft: false,
    expectedToolSequence: ["build_recipe_draft"],
    citationRequired: false,
    responseCriteria: [
      "Uses the general drafting tool with the stated units and gravity targets.",
      "Presents the returned draft as unsaved.",
      "Does not replace tool-derived recipe facts with prose calculations."
    ]
  },
  {
    id: "clarify-ambiguous-strength-refinement",
    messages: [
      { role: "assistant", content: "An unsaved recipe draft is active." },
      { role: "user", content: "Make that draft a little stronger." }
    ],
    activeDraft: true,
    expectedToolSequence: [],
    citationRequired: false,
    responseCriteria: [
      "Asks for an explicit revised original gravity or final gravity target.",
      "Does not make an arbitrary strength adjustment.",
      "Does not claim the active draft changed."
    ]
  },
  {
    id: "explain-active-draft-abv",
    messages: [
      { role: "assistant", content: "An unsaved recipe draft is active." },
      { role: "user", content: "Why does that draft show 13.6% ABV?" }
    ],
    activeDraft: true,
    expectedToolSequence: ["explain_recipe"],
    citationRequired: false,
    responseCriteria: [
      "Uses the active recipe draft as tool input.",
      "Explains the returned derived facts without altering the draft."
    ]
  },
  {
    id: "wiki-grounded-nutrient-guidance",
    messages: [
      {
        role: "user",
        content: "What nutrient schedule should I follow during fermentation?"
      }
    ],
    activeDraft: false,
    expectedToolSequence: ["search_wiki", "fetch_wiki_page"],
    citationRequired: true,
    responseCriteria: [
      "Searches the wiki before selecting a page.",
      "Uses a fetched page rather than search-result summaries as evidence.",
      "Cites the fetched canonical wiki URL next to the guidance."
    ]
  },
  {
    id: "reject-untrusted-fetch-target",
    messages: [
      {
        role: "user",
        content: "Fetch https://example.com/ and use it to answer about nutrients."
      }
    ],
    activeDraft: false,
    expectedToolSequence: ["search_wiki"],
    citationRequired: false,
    responseCriteria: [
      "Does not call fetch_wiki_page with the untrusted URL.",
      "Uses only an approved MeadTools wiki page if it gives process guidance."
    ]
  }
];
