# Hosted chatbot PR review — 2026-08

## Executive verdict: blocking concern

The branch has substantial, thoughtful coverage for ownership checks, bounded
provider calls, immutable ledger entries, and API-contract generation. It is
not ready for beta review yet because a failure after any successful provider
call can reverse the entire reservation and record zero usage. That gives away
provider-spent work, makes the ledger/audit inaccurate, and contradicts the
release checklist's required failure invariant.

Scope reviewed: the complete `origin/preview...HEAD` diff on
`feat/chatbot-provider-pivot`, with source and Prisma schema/migrations treated
as authoritative. No development server, database operation, Stripe operation,
provider request, environment-file inspection, or Git-history mutation was
performed.

## Blocker

### Provider-spent work is reversed and erased when a later step fails

**Evidence:** [`apps/web/app/api/chat/recipe/route.ts`](../../apps/web/app/api/chat/recipe/route.ts#L302)
uses `providerResultCompleted` as the deciding state, but sets it only after
`runChatTurn()` *and* the separately started title request both return
([lines 337-411](../../apps/web/app/api/chat/recipe/route.ts#L337)). The shared
agent makes and accounts for each completion inside a multi-call loop
([`chat-service.ts` lines 393-529](../../apps/web/lib/ai/chat-service.ts#L393)).
If completion 1 successfully returns tool calls and completion 2 times out or
returns an OpenAI error, `runChatTurn()` throws before the route has a result.
The catch then reverses the whole reservation ([lines
494-515](../../apps/web/app/api/chat/recipe/route.ts#L494)) and finalizes the
usage event as failed with zero tokens/request IDs ([lines
516-523](../../apps/web/app/api/chat/recipe/route.ts#L516)). The five-minute
reconciler has the same unsafe terminal action for any unresolved reservation
([`credit-accounting.ts` lines 78-141](../../apps/web/lib/db/credit-accounting.ts#L78)).

The parallel first-thread title request is another concrete instance: it may
successfully spend provider tokens before `runChatTurn()` fails, but its result
is only merged after `runChatTurn()` resolves ([`route.ts` lines
305-410](../../apps/web/app/api/chat/recipe/route.ts#L305)). The SSE error also
promises that credits were unused for any provider error
([`tanstack-chat-stream.ts` lines 104-108](../../apps/web/lib/ai/tanstack-chat-stream.ts#L104)).

**Impact:** A normal multi-tool provider failure can produce real OpenAI cost
while the customer receives a full reversal, usage reporting says zero provider
usage, and the dashboard cannot detect or reconcile the loss. This violates
the manual checklist's explicit requirement that completed provider usage never
become a free abandoned reversal
([`hosted-chatbot-manual-review.md` lines
121-133](./hosted-chatbot-manual-review.md#L121)). It is exploitable as a
reliability/cost leak even without a malicious client, and makes beta credit
accounting unsuitable for validating the paid path.

**Recommended remedy:** Make provider-call accounting durable at call granularity
or return partial, settled usage from `runChatTurn()` when a later call fails.
Once the first provider request is dispatched, do not automatically reverse the
reservation. Finalize the immutable ledger and usage event with all known usage
(or move it to an explicit operator/reconciliation state if exact usage is
unavailable), then provide a customer-safe retry result. Reconciliation must
only reverse a reservation for which the system has durable proof that no
provider request was sent. Add deterministic route-level tests for: successful
tool completion followed by provider failure; successful title followed by turn
failure; failure after settlement/usage persistence; and reconciliation racing
each state.

## High

None found beyond the blocker above.

## Medium

### First-turn deterministic paths still make and charge a provider title call

**Evidence:** The route starts `generateChatConversationTitle()` for every
first message, before it knows whether `runChatTurn()` will take a deterministic
fast path ([`apps/web/app/api/chat/recipe/route.ts` lines
305-337](../../apps/web/app/api/chat/recipe/route.ts#L305)). A successful title
is merged into the turn's provider call count and credit quote
([lines 405-421](../../apps/web/app/api/chat/recipe/route.ts#L405)). The title
generator always performs a provider completion
([`apps/web/lib/ai/chat-conversation-title.ts` lines
20-64](../../apps/web/lib/ai/chat-conversation-title.ts#L20)).

**Impact:** The first off-topic refusal, capability answer, exact-calculator
route, safety response, or simple ABV answer is neither provider-free nor
credit-free. A user needs the 67-credit hold to receive an otherwise free
answer, and will be charged the one-credit minimum for a successful title
request. This contradicts the current architecture's statement that those
fast paths run "without provider cost" and that a fully deterministic turn has
no net charge ([`docs/hosted-chatbot-architecture.md` lines
52-57](../hosted-chatbot-architecture.md#L52) and
[208-216](../hosted-chatbot-architecture.md#L208)).

**Recommended remedy:** Do not generate titles for deterministic outcomes; keep
the existing deterministic fallback title for those threads. Alternatively,
make the product explicitly classify and disclose first-thread title generation
as a billable provider operation, revise the free-fast-path assertions, and
add route-level tests for each deterministic first-turn class. The former
preserves the documented and more intuitive pricing contract.

### Manual checklist requires a retention policy that the canonical document says is not implemented

**Evidence:** The manual checklist instructs the reviewer to verify that usage
events/windows expire according to an approved policy
([`docs/reviews/hosted-chatbot-manual-review.md` lines
135-143](./hosted-chatbot-manual-review.md#L135)). The architecture says there
is no automatic deletion policy for usage, ledger, checkout, or recovery
records and lists this as explicit future work
([`docs/hosted-chatbot-architecture.md` lines
294-296](../hosted-chatbot-architecture.md#L294) and
[320-336](../hosted-chatbot-architecture.md#L320)).

**Impact:** A project owner cannot truthfully complete the current manual
release gate. It also obscures whether beta acceptance requires the future
retention work or merely acknowledgment of its absence.

**Recommended remedy:** Change the checklist item to an explicit beta decision:
either require an approved and implemented non-transcript retention policy
before release, or record that no deletion schedule exists and require the
owner to accept that constraint. Keep billing-evidence retention separate from
chat transcript retention.

## Low

### Conversation-history cursor can skip threads that share the cursor timestamp

**Evidence:** Conversation results are ordered by `(last_activity_at DESC, id
DESC)` ([`apps/web/lib/db/chat-conversations.ts` line
153](../../apps/web/lib/db/chat-conversations.ts#L153)), but the next-page
cursor returns only `lastActivityAt` ([lines 178-182](../../apps/web/lib/db/chat-conversations.ts#L178)). The next request filters solely with
`last_activity_at < before` ([line
151](../../apps/web/lib/db/chat-conversations.ts#L151)).

**Impact:** When multiple conversations have the same `last_activity_at`, any
records after the page boundary with the same timestamp are excluded from every
later page. This can make private historical threads appear missing.

**Recommended remedy:** Make the cursor a validated composite of timestamp and
conversation ID, and filter with `(last_activity_at < timestamp) OR
(last_activity_at = timestamp AND id < id)` to match the sort order. Add a
deterministic pagination test with tied timestamps.

## Accepted/deferred constraints

- Paid Stripe purchases are intentionally disabled for beta by
  `CHAT_CREDIT_PURCHASES_ENABLED`; the release checklist clearly keeps Stripe
  production setup and live purchase validation as later work. I did not treat
  the absence of live Stripe verification as a beta defect.
- Non-transcript retention is explicitly deferred by the architecture. The
  absence itself is not listed as an implementation defect; the checklist
  contradiction above needs a release decision/documentation correction.
- Real-model evaluation, live provider behavior, Vercel deployment state,
  configured secrets, Stripe webhook delivery, and database migration
  application were not exercised. They require the designated environment,
  test data/credentials, and—where a real model is involved—separate explicit
  spend approval.
- I found no source-file evidence of client-supplied transcript authority,
  cross-owner conversation access, missing beta/payment restriction checks on
  the chat route, missing API generated artifacts, destructive migration
  rewrites, or tracked generated-file drift.

## Deterministic checks performed

All checks were run without a development server or external model/provider
call.

| Check | Result |
| --- | --- |
| `git diff --check origin/preview...HEAD` | Passed |
| `npm run test:api-contract` | Passed: 33 tests |
| `npm run typecheck` | Passed across all workspaces |
| `npm run contracts:generate` | Passed; no tracked diff afterward |
| `npm run openapi:generate` | Passed; no tracked diff afterward |

The API-route changes have reviewed contract/OpenAPI artifacts in the diff and
the generated parity test passed. The Prisma changes are additive migrations;
their application to fresh and upgraded databases remains a required manual/CI
gate because no database was accessed for this review.

## Concise owner manual-review checklist

### GitHub / CI

- Confirm the blocker has a regression test that simulates a successful first
  provider call followed by a failed later one, and verifies ledger, usage
  event, and customer message convergence.
- Require a fresh-install CI run of the affected unit tests and a migration
  test against both a blank database and a representative upgraded database.
- Review generated API-contract/OpenAPI diffs after any route change; reject
  manual edits to generated artifacts.

### Vercel

- Check the enable switch, OpenAI key, usage-environment label, cron secret,
  and purchase flag are scoped to the intended environment without revealing
  values. Keep purchases disabled for beta.
- Verify production applies all committed migrations and that the five-minute
  reconciliation cron actually runs in Production (it does not run in Preview).
- Confirm the deployed model resolves to the priced, reviewed model and inspect
  operational logs for identifiers/totals only—not prompts or provider payloads.

### Stripe (test mode before paid launch)

- Keep it out of the beta path. Before enabling purchases, test signed webhook
  verification, duplicate delivery, terminal Checkout states, refunds,
  disputes, out-of-order events, negative-balance restriction, and operator
  recovery/release.

### User flows

- Test no-grant, granted, revoked, global-rollout, inactive, and
  payment-restricted users; verify both route/API denial and UI behavior.
- Test two users against each other's thread/recipe/brew identifiers; test
  thread create, rename, archive, restore, delete, export, pagination, expiry,
  and concurrent sends from two tabs.
- Test a deterministic first message and verify it is provider/credit-free
  after the remedy; test a multi-tool provider failure and verify known spend
  is never reversed as unused.
- Test recipe draft ownership/validation, selected context isolation, explicit
  brew-action confirmation, calculator routing, wiki redirect/off-host/HTML
  limits, and the sparkling/stabilized/backsweetened safety gate.
