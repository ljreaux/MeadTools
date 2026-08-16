# Hosted chatbot architecture

> **Canonical current-state document.** This document describes the hosted
> chatbot implemented on `feat/chatbot-provider-pivot`. Code, Prisma schema,
> and committed migrations remain the source of truth when this document and
> implementation differ. Historical plans, reviews, and evaluator exports are
> evidence of decisions or test runs, not alternative architecture documents.

## Product and access model

MeadTools provides a private, authenticated recipe assistant for mead-focused
work. It can help draft and refine recipes, discuss mead-brewing process and
troubleshooting questions, retrieve MeadTools wiki guidance, route exact work
to MeadTools calculators, and work from one explicitly selected recipe or
brew. It is not a general-purpose assistant: clear non-mead requests are
rejected before a provider call.

The feature is a controlled beta. A user must be active, the server-side chat
switch and provider configuration must be present, and the user must either
have an explicit beta grant or be covered by the administrator-selected
`all_active_users` rollout mode. Payment-restricted accounts cannot start
chat. The default rollout mode is `beta_allowlist`; granting chat access does
not grant credits.

The account experience provides the assistant, prompt-credit wallet, private
thread history, per-thread search/archive/restore/rename/delete, transcript
export, a recipe/brew context picker, and explicit recipe-save and brew-entry
confirmation actions. The compact launcher and full account page are views of
the same web feature, not separate assistants.

## Architecture boundaries

The reusable domain layer is deliberately independent of MeadTools-web:

| Layer | Responsibility |
| --- | --- |
| `@meadtools/chat-domain` | Thread limits and expiry, conversation contracts, bounded credit preauthorization, and whole-turn quoting. |
| `@meadtools/credit-accounting` | Integer credit packs, effective-dated pricing selection, exact token-cost arithmetic, rounding, and ledger settlement math. |
| `@meadtools/recipe-agent` | Provider-neutral policy, tool definitions/execution, catalog adapters, wiki-tool boundary, recipe-draft workflow bridge, and brew-action proposals. |
| `@meadtools/recipe-workflows`, schemas, core, and brew domain | Validated draft construction, MeadTools calculations, recipe representation, and reviewable brew-entry proposals. |
| `@meadtools/wiki-knowledge` | Reviewed versioned wiki index plus bounded retrieval from the canonical MeadTools wiki host. |
| `@meadtools/api-contract` | Runtime request/response schemas and the generated OpenAPI/type surface for the web adapters. |

`apps/web` owns the product-specific boundary: Next route handlers, session and
admin authorization, Prisma persistence, the OpenAI and Stripe transports,
catalog/database lookups, streaming UI, and the existing recipe/brew mutation
adapters. A provider, database, or React component must not become the sole
home of mead domain behavior.

## Conversational behavior and evidence

The server receives only the new client message. It reloads the bounded,
owned transcript and latest structured draft from the selected thread, so a
browser cannot replace history or draft state. Deterministic fast paths handle
capability questions, off-topic refusal, the sparkling/stabilized/
backsweetened safety conflict, a simple ABV calculation, and exact calculator
routing without provider cost.

For provider-backed work, the shared agent can use validated tools to:

- build or explain a recipe draft and calculate a gravity target;
- search MeadTools ingredient, additive, and yeast catalog data;
- search the bundled wiki index and fetch a selected canonical wiki page; and
- prepare, but never itself commit, a brew-entry proposal for the selected
  owned brew.

Recipe results are produced and validated by the shared workflow, not by
model prose. User-supplied values take precedence over catalog defaults.
Catalog discovery is data for selection, not evidence or permission to replace
a supplied ingredient, amount, unit, stage, yeast, nutrient plan, or
stabilization choice. Drafts can contain labelled assumptions/defaults, but a
workflow returns focused missing-input or conflict information rather than
silently changing fixed constraints. The system preserves the distinction
between an explicit original-gravity target and an ABV-derived target.

The model may recommend a practical next step or ask a focused question, but
it does not have a general web tool and cannot invoke arbitrary calculations.
Exact calculator requests are directed to the existing MeadTools calculator.
Process and troubleshooting guidance uses the wiki index only to find likely
pages; a MeadTools-specific process claim must use a fetched canonical page
and the response includes its canonical citation. The retrieval layer permits
only HTTPS on `wiki.meadtools.com`, checks every redirect, requires HTML,
enforces response/text/link limits, and treats retrieved text and account
notes as untrusted reference data rather than instructions.

Known constraints are intentional: the assistant cannot guarantee that a
generative answer is exhaustive; it may ask for necessary data rather than
invent it; and exact calculations and packaging-safety decisions remain in the
deterministic workflows/calculators. The hard sparkling + stabilization +
fermentable-backsweetening conflict is answered before the provider. There is
no public-recipe search or arbitrary public-record access tool. Prompts that
say a draft is “inspired by” a public recipe are evaluator/product inputs, not
authorization to fetch that recipe or expose its private data.

## MeadTools data, recipe, and brew integration

Ingredient lookup exposes catalog name/category/Brix, additives expose their
canonical unit and dosage per gallon, and yeast lookup exposes the catalog
brand, strain, nitrogen requirement, tolerance, and temperature range. The
server filters invalid catalog data before it becomes a tool result. The
recipe agent validates tool arguments and returns shared workflow results;
the web route derives a validated `RecipeDataV2` snapshot from a completed
draft.

A completed draft remains unsaved until the brewer supplies a name and uses
the existing recipe-creation flow, including the chosen privacy setting. The
UI does not claim that drafting itself saved a recipe. The chat draft and the
created recipe are separate at present; `chat_drafts.saved_recipe_id` is not
written by the current save flow.

For an attached recipe or brew, the picker first returns only safe ownership-
scoped summaries. On a turn, the server re-authorizes the selected identifier
and loads its full current state. A recipe supplies validated recipe data. A
brew can supply stage, dates, volume, gravity, related recipe snapshot, and a
bounded set of recent entries; free-form entry notes are marked untrusted.
The selection applies to that user turn only and is recorded as a lightweight
message-context reference, never silently reattached to later turns. A brew
action is a reviewable proposal; the browser displays its payload and sends an
existing ownership-checked brew-entry mutation only after the brewer confirms.

## Private conversation persistence

`chat_conversations` is the owner-scoped thread root. It records title,
active/archived state, sequence/capacity counters, activity timestamps, and
expiry. `chat_messages` stores only user-visible user/assistant text, status,
citations, and client-message id; it does not store raw provider prompts,
hidden reasoning, or raw tool payloads. `chat_drafts` stores versioned
validated draft snapshots, and `chat_generations` connects a visible assistant
message to non-content usage metadata. `chat_message_contexts` retains the
selected record id/label for that turn.

Threads are strictly owner-scoped in every read, write, update, and delete.
Client message IDs make repeated submissions idempotent. The transaction lock
and a partial unique index permit only one pending user turn per conversation,
so a concurrent tab is rejected before reservation/provider work. Active
threads accept at most 500 messages and 1 MiB of content; accepting a user
turn reserves room for an assistant answer. Thread/history pages contain at
most 100 results (50 by default), and provider context uses at most the most
recent 16 persisted visible messages.

Titles begin with a deterministic first-message fallback. On a first turn,
the service can make one compact tool-free title-generation request; invalid
or failed title generation leaves the deterministic title in place. Users can
rename titles, search them case-insensitively, archive/restore threads, and
delete a thread. Delete cascades the thread’s messages, drafts, generations,
and message-context rows. It does not erase separate usage, ledger, checkout,
or payment-recovery evidence.

Conversation expiry is 90 days after the most recent completed turn. The
daily authenticated maintenance route purges expired conversations. Pending
messages and unmatched reservations have a separate one-hour grace period and
are reconciled by the authenticated five-minute maintenance route. There is
currently **no implemented automatic deletion policy for usage events/windows,
credit ledger entries, checkout receipts, or payment-recovery records**; that
is future data-retention work, not a configured retention period.

## Provider architecture and cost telemetry

The active transport is direct OpenAI Chat Completions using the pinned model
`gpt-5.4-mini-2026-03-17`. The pin is intentional: a model change requires a
reviewed configuration/pricing change and evaluator qualification, rather than
an alias changing behavior at deployment time. The server requires the chat
enable switch and an OpenAI API key; the model may be overridden only through
the documented, bounded configuration path. It sends `store: false`, sets a
60-second timeout, disables parallel tool calls, and maps provider errors to
redacted customer-safe failures. It does not automatically retry a completion,
so a transport failure cannot conceal a duplicate model charge.

The provider-neutral `ChatModelClient` interface is what the agent and title
generator receive. It normalizes messages, tool calls, structured-output title
responses, usage, provider request IDs, and errors. `OpenAIChatClient` is the
current adapter. `FireworksChatClient` and its historical pricing snapshot are
retained only for compatibility/rollback history; Fireworks is **not** the
active hosted production architecture and must not be configured as the normal
chat provider.

Each turn is bounded by validated request size, provider input characters,
tool calls, provider calls, per-completion output, combined output, and
combined provider tokens. Defaults are 4,000 output tokens, seven tool calls,
ten provider calls, 8,000 combined output tokens, 60,000 provider-input
characters, and 60,000 combined provider tokens; overrides are clamped. A
first-thread title call is included in the turn’s measured provider usage.

`chatbot_usage_events` records request id, user id, environment label, model,
status, provider-call count, token totals, provider request IDs, and timing.
Hourly/daily windows aggregate those values for audit; they are not an
ordinary per-user rate quota. A completed visible response also has a
generation record with provider/model/status/latency. Server operational logs
record request/user identifiers and token totals, not prompts, transcripts,
keys, or raw tool data.

## Prompt credits and ledger

Credits are whole integers; 1,000 credits represent one US dollar of face
value. The immutable `credit_ledger_entries` table is the balance source of
truth, protected from update/delete by a database trigger. Purchases, grants,
reservations, settlements, reversals, refunds, and signed adjustments are
separate entries with operation/idempotency keys. Balance is the ledger sum.

Before any provider request, the route chooses effective-dated OpenAI model
pricing and fee-policy rows at request start, writes a negative reservation,
and writes a reserved usage event. The maximum hold is a 67-credit bounded
preauthorization (including the first-thread title allowance); the UI warns
below 100 credits and blocks new sends below 67. This is a hold, not the final
price. The route fails before provider work if the account cannot cover it or
is payment restricted.

After the turn, the server aggregates uncached input, cached input, and output
tokens across every provider call, including title generation. It prices the
aggregate once with the selected immutable pricing version and the then-active
fee policy, settles the unused portion of the hold, and records provider cost
in picodollars. The current fee policy is versioned, has a 75% markup, no
fixed fee, and a one-credit minimum for every provider-backed turn. A fully
deterministic turn reverses its reservation and has no net charge. Because
the hold is intentionally capped, a costly bounded turn can settle to a
negative balance; the next provider turn remains blocked until recovery.

Failures before completed provider work reverse the reservation and complete
usage as failed. If a request disconnects or a process dies, the five-minute
reconciler reverses unmatched reservations and marks stale pending messages
failed after the grace period. Settlement/reversal operations are idempotent;
the maintenance route tolerates a concurrently finishing request.

## Stripe credit-purchase architecture

Stripe is wired for one-time fixed prompt-credit packs, but paid purchase is
separately gated. Checkout is available only when the explicit purchase flag
is true **and** server-only Stripe secret/webhook configuration is present.
Provider credentials alone do not expose purchase controls. The initial packs
are 5,000/$5, 10,000/$10, and 25,000/$25 (USD); the browser submits only a
pack id and the server derives price, credits, currency, URLs, metadata, and
idempotency key.

The success redirect is not fulfillment. The webhook route verifies Stripe’s
raw request-body signature, validates a paid payment-mode Checkout Session
against its local pending checkout, deduplicates the event identity, and then
appends one purchase ledger entry transactionally. It also handles terminal
Checkout failure/expiry. Raw webhook payloads are deliberately not stored;
only event identity/type and the minimal verified fields needed for recovery
are retained.

Succeeded refunds reconcile proportionally against the original pack and
append negative refund entries where safe. A refund or dispute received before
Checkout fulfillment is durably deferred and replayed once the payment-intent
mapping exists. Unreconcilable, overspent, or disputed payment cases create a
review record and restrict new chat spend/Checkout. Administrators resolve a
case with a required note and optional signed adjustment; chat can be released
only when all review-required cases are resolved and the balance is
non-negative. Refund processing is automatic when safely reconcilable;
disputes are intentionally operator-reviewed.

Subscriptions, premium tiers, recurring billing, discounts, tax policy,
customer self-service refunds, and non-Stripe payment methods are not live
features. Treat Stripe test-mode validation and the launch checklist as a
precondition before enabling paid purchases in any live environment.

## Administration and reporting

Admin-only operations are divided between **Chat access and credits** and
**Chat operations**:

- set rollout mode; grant/revoke an active user’s beta access;
- issue an arbitrary positive evaluation-credit grant without changing access;
- inspect recent refund/dispute recovery records and resolve a review case with
  a documented note, signed adjustment, and deliberate release request; and
- view operational usage/cost reporting.

The usage dashboard defaults to a 30-day, half-open UTC range and supports
date range, environment substring, model substring, status, user identity
search, and paginated user rows. It reports request/completed/failed/pending
counts, unpriced completions, provider calls/tokens, charged credits, provider
cost, credit-equivalent value, estimated spread, daily totals, model/provider
totals, eligible/active-user counts, current wallet balance, current access
state, payment restrictions, and pending recovery count. Time filtering is by
usage-event creation time; charge/cost totals are joined from the final ledger
operation. It intentionally does not return transcripts, provider prompt
payloads, hidden reasoning, or raw payment webhook bodies.

## Security and operations

- API handlers verify authenticated user ownership or administrator privilege
  at the web boundary; selected recipe/brew IDs are rechecked server-side.
- The provider key, Stripe secret, Stripe webhook secret, and cron secret are
  server-only configuration. Documentation names required variables but never
  contains values. Missing chat/provider, payment, or cron configuration
  fails closed.
- The cron authorization check rejects missing/blank secrets and values such
  as `Bearer undefined`. The five-minute reconciler and daily expiry cleanup
  must be configured in the deployed web project.
- The request path uses message/content/context/provider/tool/token bounds,
  one-in-flight-turn enforcement, credit preauthorization, payment
  restrictions, idempotency keys, immutable accounting, and provider-error
  redaction to contain spend, retries, and data exposure.
- Chat transcript retention is separate from billing/accounting evidence. The
  exact non-transcript operational-retention policy still needs an approved
  implementation before claiming a deletion schedule.

For deployment details, use
[the chatbot beta and paid-credit launch checklist](chatbot-release-checklist.md).
For API shape/change process, use
[the shared API contract document](domain/api-contract.md).

## Testing and evaluation

Deterministic tests cover chat-domain/credit arithmetic, recipe workflows and
agent policy, wiki retrieval restrictions, API schemas, web route/service
behavior, concurrency, persistence, and billing/Stripe ordering. A behavior
found in an evaluator session must receive a deterministic regression test
before a fix is treated as complete. Safe unit/type/lint/API-contract checks
are not paid provider evaluations.

`docs/chatbot-eval-prompts.md` is the current scenario suite. A real-model
evaluation or batch requires explicit approval first, including the model and
expected number of turns/spend; do not infer that approval from permission to
run local tests. Evaluator transcripts and dated reports document observed
historical runs. They may name Fireworks, browser-only persistence, or a model
that is no longer active, so they cannot override this document or current
code.

## Explicit future work

The following are not implemented and must not be presented as current
behavior:

- subscriptions, premium plans, recurring allowances, discounts, and broader
  commerce/tax decisions;
- user image analysis, attachment storage, vision prompts, or image-derived
  recipe data;
- public/free anonymous chat, public recipe browsing through the assistant,
  and broad external integrations;
- end-user or administrator multi-model selection and automatic model
  failover;
- a dedicated mobile-native chat experience beyond the current responsive web
  UI; and
- an approved cleanup/retention policy and job for non-transcript usage,
  ledger, checkout, and payment-recovery data.

Future work must preserve the reusable domain boundary, server-side ownership
checks, explicit mutation confirmation, provider-cost attribution, and
versioned financial records described above.
