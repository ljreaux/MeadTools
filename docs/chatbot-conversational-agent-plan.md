# Conversational MeadTools assistant plan

## Purpose

Shift the recipe chatbot from a workflow-first intake form to a helpful,
free-flowing MeadTools brewing assistant without weakening the sources of truth:

- **MeadTools schemas and calculations** remain authoritative for recipe
  quantities, gravities, ABV, nutrients, stabilizers, units, and saved drafts.
- **The reviewed MeadTools wiki** remains authoritative for process,
  troubleshooting, and brewing guidance. Process claims remain tied to
  retrieved canonical wiki pages.
- **The model** gains agency to understand intent, recommend reasonable
  defaults, decide the next useful question, and keep a natural conversation.
  Its suggestions never bypass schema validation, calculation, ownership,
  billing, or mutation confirmation.

This is a behavior and architecture change, not a new model-provider project.
DeepSeek V4 Flash remains the beta default while this is evaluated.

## Why change

The August 10 evaluator session demonstrates that the current deterministic
recovery layer is trying to turn every brewing conversation into a complete
recipe payload too early:

1. An ambiguous but ordinary opener ("What do I need to get started?") was
   rejected by the scope gate instead of being clarified helpfully.
2. After a user said they wanted fruit, the assistant invoked
   `build_recipe_draft` before there was a recipe to calculate.
3. Each partial answer replayed the same complete requirements checklist.
4. A request for yeast recommendations was treated as an unresolved named
   yeast, which triggered an inappropriate catalog-miss response.
5. The assistant made its internal prerequisites—nitrogen requirement,
   Go-Ferm type, addition count, stabilizers, ABV, and FG—the user's problem
   before it could provide useful guidance.

The correction is **not** to let the model invent recipe math or unsourced
process advice. It is to separate conversation planning from deterministic
draft construction.

## Target interaction model

```text
User message
     |
     v
Intent and conversation planner (model, constrained output)
     |-------------------> conversational answer / one or two useful questions
     |-------------------> selective wiki retrieval for process claims
     |-------------------> catalog discovery for recommendations or named items
     |-------------------> validated draft attempt when the model judges it ready
     v
Deterministic validation and MeadTools calculation
     |-------------------> validated draft card
     |-------------------> narrow, factual constraint / missing-data result
     v
Model or deterministic renderer presents the result plainly
```

The planner should be able to say:

> "For a first one-gallon fruit mead, I would usually suggest a modest-strength
> recipe, a clean yeast, nutrients, and stabilizing before backsweetening. Do
> you have a fruit in mind, or would you like a few options?"

It must not need to know the eventual ABV, exact FG, nitrogen requirement, or
stabilizer dose before saying that. When the brewer asks for a draft, or the
conversation has enough choices for one, the assistant then calls the
deterministic draft workflow and presents only its validated results.

## Stable boundaries to retain

These are product and safety boundaries, not conversation rules. Keep them
deterministic and testable.

| Boundary | Required behavior |
| --- | --- |
| Authentication and ownership | Load only the signed-in user's explicitly selected recipe/brew context. Never let the model enumerate other account records or mutate state directly. |
| Credits, reservations, settlement, and payment holds | Charge and reconcile independently of model prose. An insufficient or restricted balance blocks provider work. |
| Scope safety | Directly decline clear non-mead requests. Treat ambiguous openers as clarification opportunities, not scope failures. |
| Tool safety | Restrict wiki retrieval to approved MeadTools URLs, validate redirects/content limits, and never give the model a general web tool. |
| Calculators and derived recipe values | Use shared MeadTools schemas/core/workflows. Never hand-calculate an exact dose, ABV, gravity, nutrient plan, or recipe payload in prose. |
| Draft validation | Parse model tool arguments through the shared contracts; never save or render an authoritative recipe from prose. |
| Mutations | Recipe save and any future brew action remain explicit, visible, ownership-checked confirmations outside the model loop. |
| Source claims | Brewing process guidance uses a retrieved wiki page and a canonical citation. Distinguish that from a model's clearly labeled recommendation. |

The important rule is: **determinism validates and enforces; it should not
micromanage the conversation.**

## Proposed architecture

### 1. Introduce an explicit conversation-planning contract

Create a shared, transport-free `chat-domain` contract for the planner's
*intent*, not for a recipe calculation. It should validate a small structured
response from the model such as:

```ts
type ConversationPlan = {
  mode: "general_help" | "recipe_exploration" | "recipe_draft" | "process" |
    "troubleshooting" | "calculator" | "contextual_recipe" | "contextual_brew";
  nextAction: "answer" | "ask" | "recommend" | "search_wiki" |
    "search_catalog" | "build_draft" | "route_calculator" | "decline";
  capturedFacts: Array<{ key: string; value: unknown; source: "user" }>;
  proposedAssumptions: Array<{ key: string; value: unknown; reason: string }>;
  openQuestions: Array<{ key: string; question: string; priority: "now" | "later" }>;
  needsUserConfirmationBeforeDraft: boolean;
};
```

This is intentionally not a second recipe schema. The model may express what
it believes and what it wants to do next, but the existing recipe input and
workflow schema remain the sole way to create a draft.

Validate the plan, bound its enum/string lengths, and reject unsupported modes
or actions. A malformed plan falls back to a short, safe clarification rather
than forcing a recipe-workflow call.

### 2. Maintain a concise, durable conversation summary

Persist a server-owned `conversation_summary` (or equivalent related record)
for each chat thread. It should contain only validated/attributed state:

- current mode and selected context;
- facts explicitly supplied by the brewer;
- accepted assumptions/recommendations;
- unresolved choices;
- last assistant question keys;
- a compact list of retrieved wiki URLs and catalog selections;
- the latest validated recipe draft snapshot, if any.

Do not use a regex reconstruction of the entire transcript as the canonical
state. The model may propose updates, but server code merges them only when the
update is attributable to the latest user message or a trusted tool result.

This reduces prompt size, prevents repeated questions, and enables the model
to naturally reference the brewer's choices without trying to synthesize a
draft on every turn. Add this only with a reviewed production migration and
the existing thread-retention/purge rules.

### 3. Split catalog discovery from catalog resolution

Keep the existing data tools but make their intent clear:

- `search_ingredients`: supports either a named lookup or a recommendation
  query such as "fruit options for a sweet beginner melomel." It returns
  compact, user-safe candidate facts.
- `search_yeasts`: supports two distinct paths:
  - **resolve** an explicitly named strain; or
  - **recommend** candidates from desired profile, ABV, fruit, and sweetness.
- `search_additives`: obtains a canonical unit/dosage only when a known
  additive needs it. A user-supplied compatible amount always wins.

Remove the assumption that any mention of "yeast" requires a named-yeast
resolution. "What yeast do you recommend?" should remain a recommendation
request until the assistant has enough preference data to suggest one or asks
one short follow-up.

### 4. Make draft creation an intentional transition

`build_recipe_draft` should run only when one of these is true:

1. The brewer explicitly asks for a draft/calculation; or
2. The planner has sufficient information, proposes defaults, and the brewer
   accepts the proposed direction; or
3. The planner has enough to produce a *clearly labeled preliminary draft* and
   the product decides this is an allowed beta behavior.

Before calling it, the server creates a complete, validated input from:

- user-provided facts;
- accepted defaults;
- trusted ingredient/yeast/additive tool results; and
- selected recipe/brew context when applicable.

If the workflow returns `needs_input`, convert it into the **single highest
impact** follow-up, not the workflow's entire technical checklist. Keep any
remaining questions in the conversation summary for later.

If it returns a volume/gravity/safety conflict, render its factual explanation
without changing stated amounts. The model may explain the brewer's options,
but may not silently select one.

### 5. Replace broad deterministic intake mutation with reconciliation

The current `applyExplicitRecipeIntakeHints`, historical transcript recovery,
and required-followup forcing solve real problems but now overreach. Replace
them incrementally with a narrow reconciler:

- Preserve **explicit numeric facts** from the current/accepted conversation:
  amounts, units, stages, target type, named yeast, nutrient choice, explicit
  negatives, and stabilizer choices.
- Normalize presentation variants only (for example `Opti-Red` versus
  `Opti Red`) before comparison.
- Detect a conflict or omission; do not freely inject inferred fields into a
  model's attempted recipe input.
- On an omission, either retry the model with a concise structured correction
  or ask the brewer a focused question. Do not force unrelated tool calls.
- Catalog defaults apply only when there is no compatible brewer-supplied
  amount/unit.
- Keep deterministic special cases only where they protect an invariant:
  secondary ingredients are unfermented, target-OG versus target-ABV remains
  distinct, and a fixed liquid/fermentable cannot be silently resized.

### 6. Use retrieval as evidence, not a mandatory preflight

For process, troubleshooting, and "how do I get started?" responses:

1. The planner selects one or two relevant wiki pages.
2. The server fetches those canonical pages through the existing restricted
   retrieval boundary.
3. The model writes a concise answer whose factual process claims are grounded
   in that material and links the source.

For high-level conversational recommendations, the assistant can say "I would
recommend" and explain its reasoning. It should not present that recommendation
as a wiki requirement or as a computed MeadTools result.

Numerical guidance is allowed when it is retrieved from the cited page and is
expressed in the page's applicable context. The assistant must not replace
wiki-backed specifics such as stabilization's reading interval or step-feeding
criteria with generic, invented thresholds.

### 7. Reframe scope handling into hard and soft decisions

| Input type | Handling |
| --- | --- |
| Clearly unrelated request: finance, resumes, poems, general coding | Deterministic decline before provider use. |
| Clearly mead-related request | Continue normally. |
| Ambiguous opener: "What do I need to get started?" | Ask whether the brewer means getting started with making mead or using MeadTools; do not decline. |
| Mead-adjacent but unsafe/unsupported request | Explain the supported brewing boundary and offer a nearby MeadTools capability. |

This retains cost and safety control while stopping the scope guard from
punishing ordinary human conversational shorthand.

## Conversation policy

The provider policy should be rewritten around these rules:

1. Be a knowledgeable brewing collaborator, not an intake form.
2. Acknowledge and carry forward what the brewer has already said.
3. Ask at most one or two questions per turn, chosen for their decision value.
4. Offer a reasonable default or a small set of options when the brewer asks
   for a recommendation. Label it as a recommendation or assumption.
5. Do not ask for implementation details a beginner cannot know unless they
   are truly necessary for a requested calculation.
6. Separate **exploring** a recipe from **calculating** a recipe.
7. Use a wiki citation for process facts; use the shared workflow output for
   calculated facts; clearly label all other guidance as advice.
8. State constraints plainly and offer alternatives. Do not silently repair
   a brewer's fixed amounts, volumes, targets, or stages.
9. Do not re-ask an answered question. Do not loop on a generic checklist.
10. Do not expose catalog IDs, Brix, workflow/tool names, internal nutrient
    identifiers, or implementation details.

### Beginner defaults

Create an explicit, reviewable defaults policy rather than hiding defaults in
the prompt. Initial candidates:

- one-gallon beginner batch when the brewer says "small" or has no size;
- a moderate-strength, dry-fermentation plan with later stabilization and
  backsweetening for someone who wants reliably sweet mead;
- a fruit-appropriate yeast recommendation obtained from the catalog;
- a required nutrient plan with a novice-friendly recommendation;
- assumed pH only when a stabilizer calculation is actually requested.

Defaults are proposed, not silently baked into a saved draft. The chat UI
should visibly render them as "I suggest" or "Assuming" and let the brewer
change them in natural language. The initial agreed beginner profile is:

- medium-sweet finished mead;
- medium alcohol strength;
- TOSNA with three or four additions; and
- ingredients and yeast chosen only from MeadTools data or explicit
  brewer-supplied information.

## UI changes

The current free-text chat remains primary. Do not turn it back into a long
form. Add lightweight assistance only where it reduces friction:

- an optional compact "Current plan" summary: fruit/style, batch size,
  sweetness strategy, yeast recommendation, and unanswered choice;
- clickable suggested replies for the active one or two questions (for
  example, `1 gallon`, `5 gallons`, `Recommend a fruit`, `I have blueberries`);
- a clearly separated `Assumptions I would use` disclosure before a draft is
  calculated;
- a visible distinction between a conversational recommendation, a wiki-backed
  answer, a validated recipe draft, and a calculator route;
- a "Make a draft with these assumptions" action that supplies explicit user
  confirmation when an exploratory conversation is ready.

Do not add interactive controls until the text-only flow proves that their
underlying conversation state is correct. The popup and mobile surfaces need
the same compact design, not a desktop-only sidebar/form.

## Implementation phases

### Phase 0 — Establish a behavioral baseline

- Preserve the August 10 export and current evaluator report as pre-change
  evidence.
- Add deterministic tests for the failures in that export before changing
  behavior: ambiguous opener, beginner guidance, recommendation request,
  incremental fruit recipe, and no repeated checklist.
- Keep existing calculation, scope-bypass, secondary-fruit, fixed-volume,
  additive/stabilizer, and credit-accounting regressions in the suite.
- Record current quality/cost metrics: provider calls per successful draft,
  repeated-question rate, time to first useful answer, and credits per session.

### Phase 1 — Planner and conversation summary foundation

- Add the validated planning contract in `packages/chat-domain`.
- Extract conversation-state assembly from `apps/web/lib/ai/chat-service.ts`
  into reusable domain/application adapters.
- Add a production Prisma migration for the durable compact summary, then use
  `db:reset`/`db:push` locally as documented.
- Store source attribution and accepted assumptions separately from raw model
  prose.
- Keep the current workflow as the final draft/calculation boundary.

### Phase 2 — Relax forced workflow routing

- Remove the unconditional `build_recipe_draft` and required-followup routes
  for exploratory conversation.
- Split named yeast resolution from yeast recommendation.
- Change the scope gate to allow an ambiguity/clarification state.
- Allow the model to answer, recommend, or ask a focused question without a
  recipe-workflow call when no calculation is requested.
- Retain deterministic direct routing for exact calculator requests and clear
  out-of-scope requests.

### Phase 3 — Reconciliation and source grounding

- Replace broad historical regex injection with the narrow fact reconciler.
- Normalize catalog aliases/punctuation before testing explicit inputs.
- Ensure all process claims include retrieved canonical wiki URLs.
- Preserve wiki-specific numeric guidance and reject only unsupported numeric
  additions.
- Add structured reason codes for: user fact, accepted assumption, catalog
  resolution, wiki evidence, and calculated result.

### Phase 4 — Draft-transition and UI support

- Add the concise plan/assumption presentation and suggested replies.
- Require explicit confirmation before an exploratory plan becomes a draft if
  enough defaults were proposed rather than provided.
- Keep the existing validated recipe card and explicit save behavior.
- Verify popup and mobile layouts first; avoid duplicating chat logic in the
  web UI.

### Phase 5 — Evaluation and tuning

- Replace the current evaluator policy directly once the new planner is ready.
  This is the new direction, not a side-by-side product experiment. Do not add
  a feature flag or persistent policy-version machinery for it.
- Re-run the existing evaluator prompts plus the new beginner and
  recommendation flows as the before/after comparison baseline.
- Review transcripts for naturalness, factual sourcing, source links,
  calculation validity, duplicate questions, and credit cost.
- Make small prompt/policy changes only after a failure has a deterministic
  regression test. Avoid new one-off text parsers unless they enforce a clear
  data invariant.

## Required evaluation cases

Add these as durable scenarios before enabling the new policy broadly.

1. **Ambiguous start:** "What do I need to get started?" asks a short
   clarification instead of declining.
2. **Beginner setup:** "What do I need to get started making mead?" returns
   concise, wiki-cited equipment and ingredient guidance, then offers a recipe
   conversation.
3. **Exploratory fruit conversation:** starting with "Let's make a fruit
   mead" and then giving one detail at a time should produce a coherent plan,
   not a repeated requirement list.
4. **Yeast recommendation:** "I want a sweet one-gallon fruit mead; what
   yeast do you recommend?" searches/recommends appropriate catalog strains;
   it never invokes the unknown-named-yeast fallback.
5. **Defaults with confirmation:** a beginner can accept proposed defaults and
   receive a valid draft; each proposed assumption remains visible.
6. **Explicit override:** user-provided yeast, batch, additive amounts,
   pH, target OG/ABV, negative choices, and secondary ingredients override
   recommendations without re-asking.
7. **Process citation:** stabilization, gravity stability, step feeding,
   bench trials, and troubleshooting retain relevant wiki-specific details and
   canonical links.
8. **Draft boundary:** no conversational prose is saved as recipe data; every
   rendered draft parses and calculates through the shared workflow.
9. **Scope and cost boundary:** unrelated requests remain provider-free;
   ambiguous but plausible mead openers do not.
10. **Regression continuity:** preserve the known traditional-mead
    adjustable-fermentable confirmation regression test.

## Success criteria

The conversational policy is ready for beta expansion only when:

- beginner and exploratory conversations receive a useful first response in
  one turn, without a technical checklist;
- recommendation requests return recommendations or one focused preference
  question rather than catalog-miss errors;
- no answer repeats already-captured information or more than two unrelated
  questions;
- every displayed recipe draft is still workflow-validated and calculation
  backed;
- every process claim is traceable to a retrieved MeadTools wiki source;
- every exact calculation routes to the relevant MeadTools calculator or
  shared calculation result;
- scope, ownership, credit, and mutation safeguards remain fully enforced;
- the new path has comparable or lower provider calls and credits per
  successful draft than the current path, or any higher cost is demonstrably
  offset by materially better completion and correction rates.

## Decisions to make before implementation

1. **Settled:** an accepted recommendation can create a preliminary draft as
   long as its ingredients and yeast are backed by MeadTools data or explicitly
   supplied by the brewer.
2. **Settled:** the initial beginner defaults are medium-sweet, medium alcohol,
   and TOSNA with three or four additions. Specific ingredients and yeast must
   be MeadTools-backed or brewer-supplied.
3. **Settled:** show a compact Sources section at the end of wiki-grounded
   answers. The assistant must not present factual brewing information outside
   the cited wiki-backed portion of the answer.
4. **Settled:** retain accepted assumptions until a validated draft is created,
   unless the brewer explicitly changes one.
5. **Settled:** do not add policy versioning to persistent chat threads yet.
   This has not been released, so Git history, the deterministic test suite,
   and evaluator exports are sufficient to compare behavior. The existing chat
   UI and product flow remain in place; only optional lightweight assistance
   such as suggested replies or a compact current-plan display may be added
   after the conversational behavior itself is proven.

## Manual review focus

Before merge, manually review the transition with the current evaluator export
and confirm that the system is becoming *less coercive conversationally* while
remaining *more explicit at deterministic boundaries*. A reviewer should be
skeptical of any change that adds more historical regex recovery, silently
changes a stated recipe input, turns an assumption into a fact, or lets prose
stand in for a MeadTools calculation or wiki source.
