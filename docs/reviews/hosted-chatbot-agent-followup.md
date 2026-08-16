# Hosted chatbot agent follow-up before manual review

> **Historical remediation brief.** This record describes findings from a
> pre-pivot review; several items may have been implemented subsequently. Do
> not treat its old evidence or provider references as current architecture.
> Verify against code/schema and
> [the canonical hosted-chatbot architecture](../hosted-chatbot-architecture.md).

This preserved remediation brief can help a reviewer identify areas to
re-check. It is not an open implementation plan; current code and the
canonical architecture determine whether an item is still applicable.

## Objective

Repair the hosted-chatbot implementation so its financial state, recipe semantics, packaging safety, persistence, access controls, and evaluator regressions are ready for manual review.

The original comparison used merge base `54319f485d4582b1973df62c04190fe1e8047dad` with local `preview`. Re-establish the current merge base before changing code because line numbers and branch state may have moved.

## Working constraints

- Read the applicable `AGENTS.md` completely before acting. If the repository-root file is absent, report that and follow the instructions supplied with the task.
- Treat the worktree as dirty. Preserve every existing user change and do not overwrite unrelated work.
- Use the global MeadTools MCP workflow before evaluating or changing recipe behavior, as required by the repository instructions. If it is unavailable, state that limitation and use the repository's shared schemas, core calculations, deterministic workflows, and tests without inventing brewing advice.
- Do not inspect `.env` files or credentials, call a real model provider, spend network/provider credits, use production Stripe, deploy, commit, or push unless explicitly authorized.
- Safe mocked/provider-free tests, a local isolated Postgres test database, and Stripe test mode are appropriate when available.
- Use forward Prisma migrations. Do not edit an already-applied migration to conceal a production schema defect.
- Keep recipe/domain behavior out of React UI components. Put reusable rules in the appropriate shared domain, workflow, policy, or accounting package.
- Update generated API-contract/OpenAPI artifacts whenever a public contract changes.
- Distinguish verified fixes from assumptions in the handoff.

## Priority 0 — release-blocking correctness

### 1. Make negative refund ledger entries valid and tested

Current evidence:

- `apps/web/prisma/migrations/20260808010000_add_credit_accounting_foundation/migration.sql:77-81` requires `refund` deltas to be nonnegative.
- `apps/web/lib/billing/credit-payment-recovery.ts:131-153` writes `-creditsToRevoke` with `entryType: "refund"`.
- `apps/web/lib/db/credit-accounting.ts:373-440` accepts and inserts that negative value.

Required work:

- Add a forward migration that changes the ledger direction constraint so purchase/grant/settlement/reversal remain nonnegative, reservation remains nonpositive, refund is negative in accordance with revocation semantics, and adjustment remains explicitly signed.
- Confirm the exact allowed behavior for a zero refund delta; avoid creating meaningless zero ledger entries.
- Add a Postgres integration test that applies migrations, fulfills a purchase, processes partial and full refunds, and verifies recovery, checkout status, restriction state, immutable ledger, and derived balance.
- Add a migration-upgrade test or documented verification for databases that already contain credit rows.

Acceptance criteria:

- A nonzero succeeded refund commits one negative refund ledger entry.
- Duplicate delivery is idempotent.
- The ledger mutation trigger still blocks updates/deletes.
- The wallet balance equals the ledger sum after partial and full refunds.

### 2. Persist and replay refunds that arrive before Checkout fulfillment

Current evidence:

- `apps/web/lib/billing/credit-payment-recovery.ts:56-68` records the webhook event before returning `ignored` for a missing/pending checkout.
- `apps/web/lib/billing/credit-checkout.ts:132-146` replays deferred disputes only.
- `apps/web/prisma/schema.prisma:341-356` has durable early-event storage for disputes but no equivalent refund path.

Required work:

- Implement durable deferred refund storage/replay, or redesign receipt processing so an event is not considered complete until its payment-intent mapping exists.
- Preserve only the minimal verified Stripe fields needed for replay; do not store raw webhook payloads.
- Reconcile both `refund.created` and succeeded `refund.updated` without double revocation.
- Ensure an early refund followed by fulfillment converges to the same result as fulfillment followed by refund.

Acceptance criteria:

- Both delivery orders pass integration tests.
- Repeated created/updated events and Stripe retries are idempotent.
- Partial-refund cumulative rounding remains proportional and bounded by the purchased pack.

### 3. Separate explicit target OG from ABV-derived gravity

Current evidence:

- `packages/recipe-workflows/src/build-recipe-draft.ts:103-119` stores only `targetOriginalGravity`.
- `apps/web/lib/ai/chat-service.ts:3438-3448` stores an ABV-derived OG in that same field.
- `packages/recipe-workflows/src/build-recipe-draft.ts:450-456` converts the field back to ABV and raises primary OG for secondary dilution.
- `packages/recipe-workflows/test/build-recipe-draft.test.ts:403-431` verifies finished-ABV behavior without preserving target provenance.

Required work:

- Introduce a structured target contract that distinguishes explicit original gravity from explicit finished ABV.
- Preserve compatibility for persisted partial drafts or provide a safe migration/normalization path.
- For explicit OG, solve the primary must to that OG and report finished dilution separately.
- For explicit ABV, compensate primary strength for fixed secondary/backsweetening volume when mathematically required.
- Update workflow results, agent tool schemas, persistence, API-contract/OpenAPI artifacts, renderer copy, and tests as needed.

Acceptance criteria:

- A 1 gallon recipe at explicit OG `1.090`, FG `0.996`, and 1 lb secondary blueberry keeps `derived.gravity.ogPrimary` at `1.090` within calculation tolerance.
- The equivalent explicit-ABV recipe may produce a stronger primary and still hits finished ABV.
- Fixed ingredients are never changed silently.
- UI/rendered assumptions accurately name the target kind.

### 4. Add a deterministic sparkling/stabilization/backsweetening safety gate

Current evidence:

- `packages/recipe-workflows/src/build-recipe-draft.ts:103-119` has no packaging or carbonation intent.
- `packages/recipe-agent/src/policy.ts:23-38` defaults stabilization for backsweetening but has no compatibility rule for sparkling packaging.
- `apps/web/lib/ai/chat-service.ts:1132-1157` routes calculator-style carbonation requests but does not guard recipe design.
- `docs/chatbot-eval-prompts.md:129-140` expects safe behavior only at evaluator level.

Required work:

- Add structured packaging/carbonation intent and method where recipe planning needs it.
- Add a deterministic compatibility check that returns `needs_input` or a hard warning when stabilized, fermentably backsweetened, sparkling packaging lacks a safe supported method.
- Ground process wording in the exact MeadTools workflow/wiki result. Numeric priming work must remain in the calculator.
- Do not encode invented packaging advice in policy prose.

Acceptance criteria:

- The safety behavior is unit-tested without a model.
- Evaluator scenario #12 cannot finalize an ambiguous unsafe plan.
- No path implies uncontrolled fermentable bottle conditioning is safe after stabilization.

### 5. Make provider completion, billing, usage, and visible persistence recoverable

Current evidence:

- `apps/web/app/api/chat/recipe/route.ts:265-268`, `335-392`, and `415-433` finalize provider, ledger, usage, and transcript in separate steps.
- `providerResultCompleted` is set before quote/settlement.
- `apps/web/lib/db/credit-accounting.ts:81-135` later reverses any reservation with no settlement/reversal.
- `apps/web/lib/db/chat-conversations.ts:351-474` persists answer/draft/generation in another transaction.

Required work:

- Design a durable, idempotent turn-finalization state machine.
- Persist measured provider usage and recoverable answer/draft state before or atomically with billing finalization.
- Make reconciliation distinguish: no chargeable provider work, provider work requiring settlement, settled work requiring message publication, and completed work.
- Preserve measured usage on failure instead of replacing it with zero usage.
- Ensure maintenance never reverses a completed chargeable provider result merely because a later persistence step failed.
- Ensure a charged answer can be republished/recovered idempotently after a transient persistence failure.

Acceptance criteria:

- Failure-injection tests pass before provider work, after provider completion, during quote/settlement, after settlement, during usage completion, and during message/draft persistence.
- Every retry/reconciliation converges to one ledger finalization and one visible assistant result.
- No completed usage becomes free accidentally; no user is charged for an irretrievably missing answer.

## Priority 1 — required before manual review

### 6. Normalize punctuation consistently for additive preservation

Current evidence:

- `apps/web/lib/ai/chat-service.ts:1662-1722` requires literal catalog punctuation for mention and amount recovery.
- `apps/web/lib/ai/chat-service.ts:2632-2652` uses punctuation-normalized equivalence only after a line exists.
- `docs/chatbot-eval-prompts.md:315-327` covers only exact `Opti-Red`.

Required work:

- Use one normalized token/pattern implementation for catalog equivalence, mention detection, and explicit amount extraction.
- Accept spaces, ASCII hyphens, Unicode dashes, punctuation omission, case, and supported singular/plural variants.
- Preserve the user's amount when the model omits the additive or omits its amount.

Acceptance criteria:

- Table-driven tests pass for `Opti-Red`, `Opti Red`, `Opti–Red`, and case variants.
- All variants produce one canonical line at the exact supplied amount and unit.

### 7. Replace the fixed named-yeast recognizer with catalog-complete behavior

Current evidence:

- `apps/web/lib/ai/chat-service.ts:899-915` makes mandatory lookup depend on `namedYeastQuery`.
- `apps/web/lib/ai/chat-service.ts:3595-3609` recognizes only a closed strain list.
- Unknown-yeast instructions differ between `apps/web/lib/ai/chat-service.ts:3707-3711` and `3740-3748`.

Required work:

- Require lookup whenever a brewer-supplied/proposed strain lacks verified catalog identity and nitrogen requirement.
- Use catalog matching or structured intake rather than a fixed regex allowlist.
- Retain exact brand, strain, ID, nitrogen requirement, schedule, number of additions, and Go-Ferm choice across turns.
- Define one consistent unknown-yeast flow, including the supported user-supplied nitrogen-requirement path.

Acceptance criteria:

- Tests cover historical strains, at least two other real catalog strains, and a truly unknown strain with/without a supplied nitrogen requirement.
- No unrelated recipe or nutrient choice is reopened after yeast resolution.

### 8. Enforce one in-flight turn per conversation

Current evidence:

- `apps/web/lib/db/chat-conversations.ts:221-285` inserts a pending message without checking for another pending turn.
- `apps/web/lib/db/chat-conversations.ts:287-320` includes only the caller's pending message in provider history.
- `apps/web/components/chat/RecipeChatTest.tsx:352-360` mitigates only the normal UI with `queue: "drop"`.

Required work:

- Add a database-backed per-conversation in-flight invariant in the same transaction that accepts a message.
- Return 409 before credit reservation/provider work for a competing turn.
- Clear or reconcile the in-flight state across success, failure, cancellation, timeout, and maintenance.

Acceptance criteria:

- A real concurrency test proves two requests cannot create divergent provider histories, double reservations, or out-of-order assistant responses.

### 9. Make cron authentication fail closed

Current evidence:

- `apps/web/app/api/cron/reconcile-chat-reservations/route.ts:10-20` and `apps/web/app/api/cron/daily-recipe-activity/route.ts:9-21` accept `Bearer undefined` when `CRON_SECRET` is absent.

Required work:

- Reject execution when the configured secret is absent or blank.
- Validate the bearer token consistently for both routes.
- Avoid logging secrets.

Acceptance criteria:

- Route tests cover absent, blank, `Bearer undefined`, wrong, and correct secrets. Only the correct configured secret performs work.

### 10. Track workflow questions structurally instead of comparing prose

Current evidence:

- `apps/web/lib/ai/chat-service.ts:3722-3726` detects repetition with exact trimmed-string equality.
- Targeted traditional fixes exist at `packages/recipe-workflows/src/build-recipe-draft.ts:289-308` and `apps/web/lib/ai/chat-service.test.ts:4651-4757`.

Required work:

- Track missing and answered workflow fields/question IDs across turns.
- Prevent a model paraphrase from reopening an answered question.
- Preserve and execute the two specific traditional single-adjustable-honey regressions.
- Ensure loop prevention does not suppress a genuinely unanswered narrower question.

Acceptance criteria:

- Exact and paraphrased traditional confirmation tests pass.
- Repeated questions do not trigger avoidable provider calls or credit charges.

### 11. Restore clean-checkout test execution

Current evidence from the prior review:

- `@meadtools/recipe-workflows`, core, schemas, credit accounting, wiki knowledge, and i18n passed.
- `@meadtools/recipe-agent`, `@meadtools/chat-domain`, chat-service tests, and one API-contract test could not import newly added workspace packages from the existing install.
- The web run also lacked `@tanstack/ai`.

Required work:

- Verify workspace declarations, package exports, dependency declarations, and lockfile state.
- Reproduce from a clean install in the repository's supported Node/package-manager environment.
- Do not paper over missing package declarations with local-only symlinks.

Acceptance criteria:

- All affected package tests and typechecks execute from a clean checkout.
- CI contains a clean-install gate that would catch the previous module-resolution failures.

## Priority 2 — complete or explicitly resolve before beta

### 12. Align abuse safeguards and documentation

- `docs/hosted-chatbot-architecture.md:89-95` claims pre-provider hourly/daily limits.
- `apps/web/lib/db/chatbot-usage.ts:5-8`, `26-86` implements post-turn audit aggregation only.
- `docs/chatbot-release-checklist.md:39-49` correctly says ordinary paid-user quota is not imposed.

Choose one policy:

- If rate limits are required, implement atomic pre-provider request/token reservations with concurrency tests.
- If credits plus per-turn caps are the intended ceiling, remove the false architecture claim and document abuse monitoring/response.

### 13. Define and implement usage-data retention

- `apps/web/prisma/schema.prisma:378-399` retains user IDs and provider request IDs without expiry.
- `apps/web/lib/db/chat-conversations.ts:553-557` purges transcripts only.
- `docs/hosted-chatbot-architecture.md:365-370` refers to a configured retention period.

Define an operational retention period, add bounded/idempotent cleanup for usage events/windows, preserve required immutable billing evidence, and add tests/documentation.

### 14. Disclose whole-turn credit rounding

- `packages/credit-accounting/src/index.ts:90-135` rounds marked-up cost to whole credits and enforces a one-credit minimum.
- `apps/web/app/api/chat/recipe/route.ts:335-348` correctly aggregates all provider calls before one quote.
- `packages/i18n/locales/en/default.json:124-144` and `apps/web/components/chat/RecipeChatTest.tsx:1474-1503` do not explain the minimum/rounding rule.

Keep once-per-turn aggregation. Add clear purchase/chat disclosure that provider-backed turns have a one-credit minimum and are rounded once per complete turn. Add tests proving deterministic zero-provider turns are free and internal calls are not rounded separately.

### 15. Handle Checkout failure and expiry events

- `apps/web/lib/billing/credit-checkout-events.ts:1-17` omits `checkout.session.async_payment_failed` and `checkout.session.expired`.
- `apps/web/prisma/schema.prisma:730-735` already has `failed` and `expired` states.

Handle both events idempotently or add an explicit expiration reconciler. Update Stripe event documentation and test the user-visible terminal state.

### 16. Complete supported-locale coverage

- New keys exist in `packages/i18n/locales/en/default.json:124-210`, `287-306` but not the supported German locale.
- `apps/web/lib/i18n.ts:36-45` falls back to English.

Add German translations and a supported-locale key-parity test, or explicitly constrain/document the beta as English-only.

### 17. Correct operator and architecture documentation

- `.env.example:54-64` still references unused `CHATBOT_ALLOWED_USER_IDS` and six tools.
- `apps/web/lib/ai/chat-config.ts:31-58` uses database access and defaults to seven tools.
- `docs/hosted-chatbot-architecture.md:96-101`, `125-134` contains stale browser-only/unsaved transcript language.

Update setup, architecture, release checklist, retention, Stripe event subscriptions, and rollback guidance to match final behavior.

## Required automated verification

Run only safe local checks that do not call a real provider or production service.

- Apply Prisma migrations to a fresh isolated Postgres database and an upgraded representative schema.
- Run full tests for core, schemas, recipe workflows, recipe agent, chat domain, credit accounting, wiki knowledge, API contract, i18n, and web.
- Run typechecks for every affected workspace.
- Run generated OpenAPI parity and regenerate artifacts when contracts change.
- Run `git diff --check`.
- Add database integration tests for refund signs/order, disputes, settlement failure injection, retention, cron auth, and same-thread concurrency.
- Add deterministic recipe tests for target provenance, sparkling safety, secondary ingredients, additive punctuation, arbitrary named yeast, nutrient retention, and traditional repeat-question regressions.
- Confirm tests use mocks/fakes and cannot reach a real model provider.

## Handoff required before manual review

Provide the manual reviewer with:

- A concise summary of every fixed item and any deliberately deferred Priority 2 item.
- Exact changed file/migration references.
- Test commands and pass counts from a clean checkout.
- Migration results for fresh and upgraded test databases.
- Stripe test-mode scenarios that are now ready for the reviewer.
- Any remaining inference or behavior that only the model evaluator can verify.
- Confirmation that purchases remain disabled unless the payment checklist is complete.
- Confirmation that no commits, pushes, deployments, production credentials, or real provider calls were made unless separately authorized.

Do not declare the branch ready for manual review while any Priority 0 or Priority 1 acceptance criterion is unmet.
