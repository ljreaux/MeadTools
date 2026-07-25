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
  bearer authentication plus an explicit user-ID allow-list, caps output and
  tool calls, and emits provider/model/token/latency/tool telemetry without
  persisting conversations or charging credits.
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
user credits or payment, public availability, production observability,
automated wiki-index publishing, and a final model/default-provider decision.
Continue evaluating conversation quality and recipe output before taking those
on. Local evaluator transcripts remain private and ignored by Git.

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
metering, but it is still local-only and does not create persisted chat data.
Place exports worth reviewing in `docs/chatbot-evals/exports/` with the date,
scenario, and model in the filename.

The same endpoint can be used by a scripted evaluation harness. It accepts a
JSON POST at `/api/chat/recipe` with `Authorization: Bearer <accessToken>` and
returns server-sent events: `ready`, `tool_call`, `tool_result`, then either
`final` (answer, tool results, and telemetry) or `error`.

## Remaining delivery sequence

1. Run the provider-independent evaluation set against the local evaluator for
   tool choice, follow-up behavior, wiki grounding, citations, and untrusted URL
   resistance; compare at least two candidate models before choosing the default.
2. Refine the evaluator from observed turns, then add structured recipe cards,
   warnings, citations, and an explicit apply-to-`RecipeProvider` action.
3. Add conversation/message persistence tied to existing users, with
   idempotency, usage limits, retention, and observability.
4. Define paid access separately from the model provider: an append-only
   MeadTools credit ledger with grants, reservations, settlements, reversals,
   and Stripe payment-webhook reconciliation. Before public access, reserve a
   user's maximum allowed turn cost and settle against actual token usage.
   Provider account caps remain a global backstop only.
5. Reduce the separate MCP server to an optional adapter that imports or calls
   the shared operations, then add parity tests between MCP and hosted tools.
