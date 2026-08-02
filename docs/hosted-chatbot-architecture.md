# Hosted recipe chatbot architecture

## Repository findings

- `packages/schemas` owns the authoritative v2 recipe and nutrient Zod schemas. `packages/core` owns recipe, gravity, ABV, nutrient, stabilizer, and conversion calculations.
- `packages/api-contract` and `packages/api-client` already expose the `/api/recipes/derived` contract. The web route validates recipe data and calls `calculateRecipeDerivedApiResponse`.
- The browser recipe builder keeps editable draft state in `RecipeProvider` and calculates through `@meadtools/core`; its target-OG action uses `calculateHoneyAndWaterL`.
- The web app supports NextAuth sessions plus the existing custom bearer-token path in `verifyUser`. Recipe ownership and saving already use the `users` and recipe infrastructure.
- No paid-plan, billing, entitlement, or persisted-conversation implementation exists yet. The local evaluator has a Fireworks-compatible provider adapter and a server-sent-events chat route; neither is public product infrastructure.

## Selected boundaries

```text
packages/recipe-workflows/              deterministic, transport-free operations
  src/contracts.ts                      versioned needs_input | recipe | error results
  src/build-recipe-draft.ts             general recipe intake and draft operation
  eval/representative-conversations.ts  product/evaluation cases

packages/recipe-agent/                  provider-neutral tool orchestration
packages/wiki-knowledge/                wiki index search, source metadata, safe page retrieval
apps/web/lib/ai/                        future model provider and server composition
apps/web/app/api/chat/recipe/route.ts    future auth, entitlement, streaming boundary
apps/web/components/chat/                private local evaluator and future structured chat UI
apps/web/prisma/                         future conversations, messages, usage/entitlements

meadtools-mcp (separate repository)      future thin adapter/development harness only
```

The deterministic package has no HTTP, authentication, persistence, model, or UI dependency. It receives already interpreted structured input, validates any generated payload against `recipeDataV2Schema`, invokes `@meadtools/core`, and validates the calculated response against the existing API contract. This lets the hosted agent, web API, tests, and an optional MCP adapter share one source of workflow behavior.

The hosted bot lives entirely in this monorepo. MeadBot and MeadBotAPI are reference implementations only: their useful ideas are a bounded tool-calling loop, source-cited wiki guidance, safe retrieval, and usage/feedback observability. MeadTools must not import them or call them at runtime.

## Wiki knowledge boundary

The MeadTools wiki is authoritative for brewing process, technique,
troubleshooting, and ingredient guidance. The model must ground those answers in
retrieved wiki pages and cite the relevant canonical page URLs. Recipe payloads
and calculations remain authoritative only when produced by the shared MeadTools
schemas and calculation/workflow packages.

`packages/wiki-knowledge` will own a versioned wiki index artifact plus its
source revision and generation time. A server-side search tool will rank title,
summary, category, keywords, and related pages and return a small candidate set.
A separate fetch tool will only retrieve approved `wiki.meadtools.com` HTML URLs,
including redirect validation and response-size/text/link limits. Neither tool
will be a general-purpose web fetcher.

The index is refreshed deliberately from the wiki source/publish workflow or an
explicit maintenance action, not by a runtime crawl or a routine full recrawl.
A lightweight integrity check can verify indexed URLs periodically. The index is
a routing catalog; the selected retrieved page is the source for a process claim.

## MCP migration decisions

| MCP area | Decision | Reason |
| --- | --- | --- |
| `src/workflows.ts` intake questions and dry-vs-backsweetening rules | Rewrite incrementally in deterministic operations | The intent is reusable, but the current function mixes inference, catalog HTTP, payload construction, calculation, and reporting. |
| `src/volume.ts` and recipe math helpers | Discard duplicates | Use `@meadtools/core` constants and calculations. |
| `src/schemas.ts` recipe payload definitions | Discard | Permissive records allowed schema drift; import `@meadtools/schemas` instead. |
| `src/meadtools-client.ts` | Keep only in a future thin MCP adapter | In-process hosted workflows should not call MeadTools back through public HTTP. |
| `src/recipe-report.ts` | Migrate presentation concepts later | Structured cards belong in chatbot response/view contracts, not the calculation boundary. |
| `src/prompts.ts` | Rewrite as hosted agent policy and evaluation criteria | Tool-use principles remain useful, but MCP prompt registration is not the product architecture. |
| mocked workflow tests | Replace | Contract tests must parse real shared schemas and run the real calculation engine. |

## POC progress

- Completed: transport-free `build_recipe_draft` and `explain_recipe` workflow
  operations, plus a gravity-target calculation for ABV/OG/FG conversions.
  `build_recipe_draft` is style-neutral: it accepts any ingredient list, asks
  for missing high-impact inputs, and can solve one selected fermentable plus
  water against a target OG. The hosted adapter uses the existing MeadTools
  ingredient catalog to supply catalog ID, category, and Brix before drafting.
  A separate yeast-catalog lookup resolves a user-supplied strain (including a
  partial strain name) to its canonical identity and nitrogen requirement before
  nutrient planning. Catalog IDs, Brix, tool names, and internal schedule values
  are server/model context, never user-facing content. Every draft requires a
  nutrient plan; each operation then uses the shared
  schemas and calculation engine. The earlier traditional-only operation
  remains a workflow test fixture, not a hosted chatbot tool.
- Completed: `@meadtools/recipe-agent`, a provider-neutral registry that exposes
  deterministic recipe operations plus opt-in wiki search and restricted page
  retrieval to a future model adapter.
- Completed: `@meadtools/wiki-knowledge`, with the reviewed 75-page wiki index,
  deterministic candidate search, index metadata, and constrained canonical-page
  retrieval (host, redirect, response-size, text, and link limits).
- Completed: provider-independent hosted-POC evaluation cases and policy for
  tool choice, ambiguity handling, wiki grounding, citations, and untrusted URL
  resistance. These are ready for a selected provider runner.
- Completed: a Fireworks-compatible Node adapter and private local-test SSE
  route at `/api/chat/recipe`. It is disabled by default, requires existing
  bearer authentication plus an explicit user-ID allow-list, has strict
  per-turn provider-call/output/context caps, and applies durable per-user
  hourly/daily request and daily token limits before a provider call. It emits
  non-sensitive provider/model/token/latency telemetry without persisting
  conversation content or charging credits.
- Completed: a private, authenticated evaluator at `/account/chat`. It renders
  model Markdown, tool activity, citations, and per-turn metering; it retains
  the active draft in browser memory so follow-up refine/explain requests can
  use it without exposing the recipe payload to the model. A user can save the
  validated active draft to their account through the existing authenticated
  recipe API; chat messages and evaluation telemetry remain unsaved.
- Completed: deterministic rendering for workflow questions and calculation
  explanations. Those responses do not make a second model request, preventing
  uncited process advice or invented calculation explanations from being added.
- Completed: explicit ABV targets force the gravity-target tool, and truncated
  model output is retried once as a concise final response rather than rendered
  as scratchwork.
- Completed: when the model elects to retrieve a reviewed wiki reference, it
  may use that material for clearly labeled draft assumptions when a user gives
  a qualitative preference, rather than turning every preference into another
  intake question. Wiki retrieval remains selective rather than a required
  step for every recipe request.

## Checkpoint status — July 2026

This is a development checkpoint, not a release. The private evaluator is ready
for continued real-model testing: it can conduct a bounded tool-calling
conversation, use MeadTools calculations and catalog lookups, selectively cite
the reviewed wiki, render a streaming-style chat experience, export a local
session transcript, and save the active validated recipe draft to the signed-in
user's account. The save path was verified end-to-end against the local app;
it persists the structured v2 recipe payload through the existing recipe API,
not a reconstruction of the chatbot's prose.

Still deliberately out of scope for this checkpoint: persistent chat history,
user credits or payment, public availability, production observability, and
automated wiki-index publishing. The local evaluator uses DeepSeek V4 Flash as
its selected development default; any premium-model choice remains a future
user-facing option rather than a silent fallback. Continue evaluating
conversation quality and recipe output before taking public access on. Local
evaluator transcripts remain private and ignored by Git.

## Refined product feature list — August 2026

The chatbot is a MeadTools assistant, not a separate recipe store or a
general-purpose agent. Its product surface is deliberately split into explicit
capabilities so users understand what account data is in play and every
mutation remains reviewable.

| Capability | Status | Product boundary |
| --- | --- | --- |
| Draft a new recipe | Private evaluator | Gather intent, use MeadTools catalog/calculations, present a validated draft, and save only through the existing explicit save flow. |
| Explain/refine the current draft | Private evaluator | Work from browser-held validated draft state; never treat model prose as the recipe source of truth. |
| Mead process and troubleshooting help | Private evaluator | Retrieve and cite the authoritative MeadTools wiki page; direct numeric work to MeadTools calculators. |
| Continue a saved recipe | Private evaluator | User explicitly selects one owned recipe. The assistant receives a bounded, server-loaded recipe context and may explain or prepare a refinement, but cannot overwrite the recipe directly. |
| Assist with an active brew | Private evaluator | User explicitly selects one owned brew. The assistant receives a bounded snapshot of the brew, stage, and recent timeline context to answer questions such as “what is next?” or “does this gravity trend look normal?” |
| Prepare a brew action | Later | The assistant can propose a typed addition, measurement, note, or stage action. The UI shows the exact payload and requires user confirmation before the existing brew API writes it. |
| Hydrometer-aware assistance | Later | Add an opt-in read-only summary of linked-device state and recent readings; never let model output control devices or alerts. |
| Persistent conversations and user credits | Later | Store conversations only with a retention policy; use a MeadTools credit ledger and explicit model tier selection before public access. |

### User recipe and brew context boundary

The first account-context slice is **read-only and explicit**:

1. The chat UI offers a picker for the signed-in user’s saved recipes and
   active brews. Nothing is attached automatically, and the user can remove
   the attachment before sending a message.
2. The server loads the selected record directly through ownership-scoped
   database functions; the model never receives a database credential, a
   general account-search capability, or a public/private bypass.
3. Recipe context is a validated v2 recipe.
   Brew context is a bounded view of the recipe snapshot, current stage,
   relevant measurements, and recent timeline entries. User-authored notes are
   untrusted reference data, not instructions for the assistant.
4. A context tool may explain, compare, or prepare a proposed change, but it
   must not mutate recipes, brews, timeline entries, devices, notifications, or
   user settings. Every later write uses an existing ownership-checked API and
   a visible user confirmation.
5. Context is supplied only for the active request/session. Persistent
   conversation history, broader account recall, and cross-brew recommendations
   are separate future decisions with their own retention and consent rules.

The first tool surface should therefore be limited to:

- a picker endpoint, returning only owned recipe and brew identifiers and
  summaries;
- `get_selected_account_context`, returning bounded, ownership-checked context
  for the user-selected identifier; and
- deterministic explain/prepare operations that consume that context without
  writing to the account.

## Active refinement plan — July 28, 2026

The next pass is about recipe correctness and reliable saved payloads, not a
new product release. The following decisions and work items supersede the
earlier generic “refine the evaluator” step.

### Settled product rules

- A requested **target ABV always means the finished batch ABV**. It includes
  dilution from calculated secondary additions such as backsweetening honey.
  A draft must not silently interpret the target as a pre-backsweetening
  fermentation ABV.
- A request to backsweeten to a final gravity is sufficient for MeadTools to
  calculate the secondary sweetener. The bot must not ask the user to choose
  the amount unless the user deliberately supplies a fixed amount instead.
- An explicit numerical fermentation FG takes precedence over qualitative
  wording such as “finish dry.”
- “No Go-Ferm” is a real recipe setting and must be rendered and saved as
  `none`; display text and the saved v2 recipe payload may never disagree.
- The normal brewing convention is that a stated batch size is the target
  finished batch volume unless the user says otherwise.

### Priority 1 — recipe workflow and intake regressions

1. Move the inverse backsweetening calculation into a shared `@meadtools/core`
   helper. Reuse it from the browser recipe builder and hosted workflow rather
   than maintaining parallel math. Extend the helper/workflow solve so a
   target finished ABV, finished volume, fermentation FG, and backsweetened FG
   resolve together, including the volume of the calculated secondary
   sweetener.
2. Preserve `backsweetening.targetFinalGravity` through every agent turn and
   call the deterministic workflow immediately when that target is known. Add
   regression coverage for “enough honey to reach 1.015” so it cannot turn
   into an amount question or a repeated confirmation.
3. Correct intake precedence: explicit gravity beats “dry”; explicit negative
   choices such as “no Go-Ferm” beat model defaults; a named yeast followed by
   “look it up” must call yeast lookup before asking for nitrogen information.
4. Treat a supplied yeast plus its declared nitrogen requirement as valid even
   without a catalog match, while retaining the catalog lookup path for known
   strains. Keep catalog and implementation details out of user-facing text.
5. Make “best judgment” accept normal defaults rather than reopening already
   supplied choices: batch size means finished volume, honey is the adjustable
   fermentable for a traditional/cyser when implied, and the established
   K-meta/pH 3.5 default applies when stabilization is needed.
6. Add contract and end-to-end save tests proving that the displayed draft and
   saved `dataV2` have the same ingredients, additions, nutrient settings,
   stabilizers, fermentation FG, backsweetened FG, and finished ABV basis.

### Priority 2 — answer boundaries and calculator/process experience

1. Finish calculator routing: direct users to the appropriate MeadTools
   calculator for ABV, sulfite, carbonation, hydrometer/refractometer, bench
   trial, and additive-dose questions rather than duplicating calculator math
   in model prose. Where a calculator can safely return a quick deterministic
   result, show that result and link the calculator.
2. Keep process answers concise and source-labeled: MeadTools wiki claims must
   cite the retrieved canonical page; brief general brewing context is allowed
   only when clearly distinguished from the wiki guidance.
3. Continue narrowing the deterministic scope gate to obvious off-topic
   requests. The system policy remains the main scope boundary, and each
   change must be evaluated against mead-adjacent phrasing, unrelated pivots,
   and normal brewing questions so valid questions do not get rejected.
4. Preserve the existing rule that additives belong in the recipe Additives
   section. Later, add structured answer controls (selects, target fields, and
   similar UI components) for high-confidence questions; this is deliberately
   deferred until the conversational data model is stable.

### Verification gate before the next milestone

Run the focused backsweetening, dry-FG, no-Go-Ferm, named-yeast lookup, cyser
fill-liquid, rich-additive, process/wiki, calculator-routing, and adversarial
scope scenarios. Export each notable session and save successful recipes. For
each saved recipe, compare the visible draft to the persisted `dataV2` payload.
The repeated adjustable-fermentable/backsweetening confirmation regression is
an explicit blocking check: once the user has identified honey as the
adjustable fermentable or given a backsweetening target, the bot must proceed
or ask a genuinely new high-impact question, never ask the same confirmation
again.

## Local real-model test setup

The local endpoint is intentionally fail-closed. Add the following only to the
ignored `apps/web/.env.local` file, substituting the numeric ID returned by the
local login endpoint and a Fireworks server API key:

```bash
CHATBOT_LOCAL_TEST_ENABLED=true
CHATBOT_ALLOWED_USER_IDS=1
FIREWORKS_API_KEY=...
# Optional model and guardrail overrides:
# CHATBOT_FIREWORKS_MODEL=accounts/fireworks/models/deepseek-v4-flash
# CHATBOT_MAX_OUTPUT_TOKENS=4000
# CHATBOT_MAX_TOOL_CALLS=6
# CHATBOT_MAX_PROVIDER_CALLS=7
# CHATBOT_MAX_TOTAL_OUTPUT_TOKENS=8000
# CHATBOT_MAX_PROVIDER_INPUT_CHARACTERS=60000
# CHATBOT_MAX_TOTAL_PROVIDER_TOKENS=60000
# CHATBOT_MAX_REQUESTS_PER_HOUR=30
# CHATBOT_MAX_REQUESTS_PER_DAY=100
# CHATBOT_MAX_TOKENS_PER_DAY=200000
# CHATBOT_USAGE_ENVIRONMENT=local
```

Start the app with `npm run dev:web`, sign in normally, then open
`/account/chat` (for example, `http://localhost:3000/en/account/chat`). The
evaluator shows the selected model, tool activity, and the token/latency totals
for the last turn. When a recipe tool returns a draft, the page keeps it in
browser memory for follow-up requests. The signed-in evaluator can explicitly
save the validated active draft through the existing recipe API; it still does
not persist chat messages or telemetry, charge credits, or accept payments.

The evaluator can export the current browser-session transcript as a Markdown
file. The export includes displayed messages, tool names, and per-response
metering. Chat text remains browser-local; the server stores only guarded
request metadata (request ID, user ID, environment, model, provider request
IDs, status, and token/call totals) for limit enforcement and incident review.
Place exports worth reviewing in `docs/chatbot-evals/exports/` with the date,
scenario, and model in the filename.

The same endpoint can be used by a scripted evaluation harness. It accepts a
JSON POST at `/api/chat/recipe` with `Authorization: Bearer <accessToken>` and
returns server-sent events: `ready`, `tool_call`, `tool_result`, then either
`final` (answer, tool results, and telemetry) or `error`.

## Remaining delivery sequence

1. Complete the Priority 1 recipe correctness work and rerun the focused
   evaluator suite. The repeated backsweetening confirmation regression is a
   release-blocking behavior check.
2. Run evaluations for selected-recipe refinement and active-brew guidance,
   including authorization failures and concise follow-up prompts.
3. Refine the evaluator from observed turns, including structured recipe cards,
   warnings, citations, and context-aware actions. Keep changes that write a
   recipe or brew behind a visible confirmation.
4. Add conversation/message persistence tied to existing users, with
   idempotency, usage limits, retention, and observability. Add a scheduled
   purge for the operational usage tables before public rollout.
5. Define paid access separately from the model provider: an append-only
   MeadTools credit ledger with grants, reservations, settlements, reversals,
   and Stripe payment-webhook reconciliation. Before public access, reserve a
   user's maximum allowed turn cost and settle against actual token usage.
   Provider account caps remain a global backstop only.
6. Reduce the separate MCP server to an optional adapter that imports or calls
   the shared operations, then add parity tests between MCP and hosted tools.
