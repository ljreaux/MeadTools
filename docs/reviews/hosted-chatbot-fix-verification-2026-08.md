# Hosted-chatbot fix-pass verification — 2026-08

## Executive verdict: partial

The fix pass fully addresses the deterministic first-turn, conversation-cursor,
provider-error wording, retention-documentation, and API/OpenAPI parity items.
It substantially improves accounting by checkpointing successful completions and
by settling checkpointed abandoned turns with the reservation's historic pricing
versions. However, it still has a release-blocking failure mode: a provider
completion followed by a failed checkpoint _write_ is treated as readable zero
usage and reversed. That can grant already-spent provider work for free.

## Review-area status

1. **Accounting and reconciliation — partially addressed.** Successful
   completions are checkpointed in the normal path, failed turns use the
   reservation-time pricing/fee-policy snapshot, and the reconciler safely
   settles a durable nonzero checkpoint. The failed-checkpoint-write path below
   remains unsafe.
2. **Deterministic first turns — fully addressed.** The five requested
   capability, scope, safety, quick-ABV, and calculator-only paths execute
   before pricing, reservation, usage-event creation, client construction, and
   title generation, while still completing the transcript and returning the
   normal SSE stream.
3. **Pagination — fully addressed.** The cursor has validated timestamp and ID
   components and the query's predicate matches `(last_activity_at DESC, id
DESC)`; tied timestamps do not skip later UUIDs. The client, contract, and
   OpenAPI response use the same opaque string shape.
4. **User-facing behavior and documentation — fully addressed for the listed
   requirements.** The provider message no longer promises unused credits, the
   three release documents distinguish transcript retention from unimplemented
   operational-record retention, and API/OpenAPI parity passes. A separate,
   lower-severity checklist wording issue remains below.

## Findings

### Blocker

- **B1 — A failed durable usage-checkpoint write after a successful provider
  completion still reverses completed provider spend as zero usage.**
  `apps/web/lib/ai/chat-service.ts:497-517` receives a provider completion,
  aggregates its usage, then awaits `onUsage`. The route wires that callback to
  `recordChatbotUsageProgress` at
  `apps/web/app/api/chat/recipe/route.ts:433-435`; the write can throw when the
  pending event cannot be updated (`apps/web/lib/db/chatbot-usage.ts:31-41`).
  The outer catch then reads the unchanged reserved usage row
  (`apps/web/app/api/chat/recipe/route.ts:573-592`). A successful read of that
  unchanged row supplies empty request IDs/tokens
  (`apps/web/lib/db/chatbot-usage.ts:45-72`), so
  `finalizeFailedReservation` takes its reversal branch
  (`apps/web/app/api/chat/recipe/route.ts:704-736`) and `recordFailedUsage`
  records the zero checkpoint (`apps/web/app/api/chat/recipe/route.ts:657-682`).
  If the process instead dies, the reconciler repeats the same unsafe inference:
  it reverses a checkpoint with no request IDs
  (`apps/web/lib/db/credit-accounting.ts:129-130,196-202`).

  **Impact:** a transient database failure immediately after a completed OpenAI
  response can produce a full credit reversal and a failed zero-usage audit
  event despite provider cost already being incurred. This also contradicts the
  claim in `docs/hosted-chatbot-architecture.md:218-225` that known provider
  work is never converted to a free reversal.

  **Recommended remedy:** durably record a conservative provider-attempt state
  before each provider dispatch, and make both the request catch path and cron
  reverse only an explicitly confirmed no-attempt state—not merely a zero-token
  checkpoint. If the post-completion checkpoint write fails, retain the hold for
  repair/reconciliation (or settle from a durably recorded provider receipt);
  do not reverse it. The recovery path must use the pricing/fee-policy versions
  linked to the original reservation and be idempotent across retries.

### High

No high-severity findings beyond the blocker above.

### Medium

- **M1 — A post-settlement failure to terminalize the usage event is swallowed
  and has no reconciliation repair path.** The route settles the reservation
  before calling `recordCompletedUsage`
  (`apps/web/app/api/chat/recipe/route.ts:477-513`). That helper catches a
  `completeChatbotUsage` failure and returns `undefined`
  (`apps/web/app/api/chat/recipe/route.ts:634-654`), after which the transcript
  can still be completed. The reconciler selects only ledger reservations with
  no settlement/reversal (`apps/web/lib/db/credit-accounting.ts:101-122`), so a
  settled operation whose usage event remains `reserved` is never repaired.

  **Impact:** this does not make provider work free—the ledger is settled and
  the earlier checkpoint remains—but it can permanently leave the usage event
  pending and omit its completed/failed window aggregation, degrading dashboard
  and audit accuracy after a database fault.

  **Recommended remedy:** make terminal usage persistence retriable and expose
  a bounded reconciliation scan for reserved usage events that already have a
  final ledger operation. Do not silently accept a permanent nonterminal audit
  state.

### Low

- **L1 — The release checklist still describes reconciliation as reversal-only.**
  `docs/chatbot-release-checklist.md:54-55` says the cron “reverses stale
  credit reservations,” but the implementation now settles stale reservations
  with checkpointed provider usage
  (`apps/web/lib/db/credit-accounting.ts:129-193`).

  **Impact:** operators could misunderstand the expected recovery result while
  interpreting cron logs or validating beta behavior.

  **Recommended remedy:** say that the cron settles checkpointed provider usage
  using the original reservation versions and reverses only confirmed zero-work
  reservations.

## Confirmed implementation details

- `runDeterministicChatTurn` covers capability, off-topic, sparkling-safety,
  quick-ABV, and calculator-only answers
  (`apps/web/lib/ai/chat-service.ts:88-135`). The route executes it before
  `getActiveCreditPricing`, `reserveCreditBalance`, `recordChatbotUsageStart`,
  `OpenAIChatClient`, and title generation
  (`apps/web/app/api/chat/recipe/route.ts:190-354`). It persists the assistant
  message and returns `streamRecipeChatTurn` SSE output
  (`apps/web/app/api/chat/recipe/route.ts:198-247`).
- For a durable nonzero checkpoint, the normal failure path prices with the
  original in-memory snapshot chosen immediately before its reservation
  (`apps/web/app/api/chat/recipe/route.ts:250-279,704-725`), and the cron reads
  the versions linked to the original reservation rather than current pricing
  (`apps/web/lib/db/credit-accounting.ts:131-185`). Its final ledger operations
  are idempotency-keyed; concurrent finalization is handled as a skip
  (`apps/web/lib/db/credit-accounting.ts:176-210`). A checkpoint _read_ error
  fails closed in the request path (`apps/web/app/api/chat/recipe/route.ts:573-603`),
  but B1 shows that checkpoint-write uncertainty does not.
- Conversation pagination uses the lexicographic predicate
  `last_activity_at < at OR (last_activity_at = at AND id < id)` and matching
  dual sort keys (`apps/web/lib/db/chat-conversations.ts:155-171`). The cursor
  encoder/decoder is opaque and validates a finite ISO timestamp and UUID
  (`apps/web/lib/db/chat-conversations.ts:208-246`); invalid cursors return 400
  (`apps/web/app/api/chat/conversations/route.ts:34-64`). The client passes the
  opaque cursor (`apps/web/components/chat/RecipeChat.tsx:520-551,642-649`),
  and the API schema/OpenAPI response declare `string | null`
  (`packages/api-contract/src/zod/chat.ts:14-18,80-83`,
  `apps/web/public/openapi.json:2232-2249`).
- The streamed provider error now says the balance reflects only processing
  that completed, rather than promising that credits were unused
  (`apps/web/lib/ai/tanstack-chat-stream.ts:104-108`). Retention wording is
  consistent: transcripts are cleaned up at 90 days while no automatic policy
  exists yet for usage, ledger, checkout, or recovery records
  (`docs/chatbot-release-checklist.md:75-78`,
  `docs/hosted-chatbot-architecture.md:299-301,340-341`, and
  `docs/reviews/hosted-chatbot-manual-review.md:47-51,143-146`).

## Missing tests and remaining risks

These are not additional confirmed defects.

- The new unit test proves a successful in-memory checkpoint is available when
  a later provider call fails (`apps/web/lib/ai/chat-service.test.ts:134-198`),
  but there is no test where `onUsage` rejects after the first successful
  completion. Add a route/database-adapter test proving that this case leaves a
  conservative hold and that cron cannot reverse it.
- Add a reconciliation test for a durable checkpoint with historic pricing and
  fee-policy versions after newer versions become active, including a repeated
  cron run and a concurrent finalizer.
- Add a data-store or integration test with several identical
  `last_activity_at` values across a page boundary; current code is correct by
  inspection, but the new tie-breaking behavior has no direct regression test.
- Add route-level tests for each of the five deterministic first-turn classes
  to assert no credit reservation, usage event, provider client/title call, or
  provider invocation while confirming persisted transcript plus SSE output.
- Fault-inject failure after credit settlement, after usage terminalization,
  and during message completion. The manual checklist already calls for these
  scenarios (`docs/reviews/hosted-chatbot-manual-review.md:132-136`), but the
  automated suite does not exercise the persistence adapters.

## Commands run

- `git diff --check` — passed.
- `npm run test:api-contract` — passed: 33 tests. This includes the generated
  OpenAPI canonical SHA-256 parity assertion (baseline
  `5ce70bfa1f79f52877f3c284b2f2f168029045e238df137c08ca4ecb38e85730`) and the
  existing-path parity assertion.
- `npm test --workspace @meadtools/web` — passed: 212 tests. These use mocked
  provider transports; no real model-provider request was made.
- `npm run typecheck` — passed for every workspace. Its normal Prisma-client
  generation produced no tracked workspace drift.

I did not start a development server, call a provider or Stripe, inspect
environment files or credentials, reset a database, run the mutating contract/
OpenAPI generators, or modify implementation files. The existing contract and
OpenAPI artifacts were validated by the passing parity tests and typecheck.
