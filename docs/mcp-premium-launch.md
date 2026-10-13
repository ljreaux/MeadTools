# MCP and premium launch status (issue #438)

## Current state and exposure audit

The issue branch was rebased onto `origin/preview` on 2026-10-11. It now has
an account-authenticated `/mcp` Streamable HTTP route and OAuth authorization
server. The older local Codex MeadTools MCP integration is a separate process.
The Vercel `mead-tools` project has production domains including
`meadtools.com` and a preview deployment from `preview`. On 2026-10-11,
unauthenticated requests to `/api/mcp` on production and the current preview
deployment returned `text/html` from `x-matched-path: /[locale]/[...pathName]`.
That catchall is not an MCP protocol endpoint. This verifies the audited path;
it does not prove that no unrelated hostname or infrastructure runs an MCP
service.

## Product decision

Premium is one account-level subscription bundle: **$5 per month**, **1,000
hosted-chat prompt credits per paid month**, MCP access, and more benefits to be
added before sale. New subscriptions and checkout remain disabled while the
chatbot is in beta and the bundle is incomplete. Existing recurring Ko-fi
supporters are to be incorporated by a verified webhook and explicit account
link. Matching a Ko-fi payer email to a MeadTools account email never links
automatically: MeadTools account emails are not independently verified, so the
signed-in user must claim a one-time link sent to the payer inbox. An initial
Ko-fi Members CSV export is needed to seed payments predating
the webhook. Current Ko-fi monthly supporters are grandfathered regardless of
their existing payment amount. Once premium sales open, new subscriptions use
the $5 price while already linked grandfathered supporters keep their access.
Purchased credit packs and beta grants remain separate; neither
implies premium. Premium access unlocks hosted chat even outside the beta
allowlist. All prompt credits use the existing immutable credit ledger.

External clients pay their own model provider for model use. MeadTools does not
charge prompt credits for an MCP tool call. Tool execution is covered by the
premium subscription and bounded by account rate and concurrency limits. This
policy can be revised before paid launch if actual tool operating costs warrant
metering; a charge would require a distinct, auditable ledger operation.

## Initial MCP surface

Claude Desktop remote connectors and ChatGPT custom MCP apps are the first
targets. Both connect to a public HTTPS Streamable HTTP endpoint. ChatGPT
requires an MCP-compatible OAuth authorization-code flow with PKCE, discovery
metadata, resource-bound access tokens, and revocation. The remote endpoint
must verify the user, premium entitlement, payment restrictions, and rollout
status on every request. Client-side hiding is never an access control.

The implementation uses `/mcp` for stateless Streamable HTTP. Discovery lives
at `/.well-known/oauth-protected-resource` and
`/.well-known/oauth-authorization-server`; OAuth endpoints are under `/oauth`.
The authorization-code flow uses S256 PKCE, explicit account consent, a
single-use code, resource-bound one-hour access tokens, rotating 30-day refresh
tokens, and revocation. An account may also create up to five 90-day personal
bearer tokens on `/integrations/mcp`, where both token types can be revoked.
Only hashes of credentials are stored. A request checks active premium status,
payment restriction, and `PREMIUM_MCP_ENABLED` before tool execution.
On a Vercel PR Preview, MCP and Ko-fi account-link emails use the stable
`VERCEL_BRANCH_URL` as their public origin; they fall back to `VERCEL_URL` only
when no branch URL is available. OAuth issuer, MCP resource, authorization
links, and the setup guide must all advertise that same origin. The Ko-fi
webhook can use the branch URL with `/api/webhooks/kofi`, so new deployments
do not require changing its destination. Set `PREVIEW_PUBLIC_ORIGIN` to an HTTPS
origin on the permanent `preview` branch when ready to use
`https://preview.meadtools.com`; production and local development continue to
use `NEXT_PUBLIC_BASE_URL`. Connections bound to a previous deployment URL
must be reconnected after changing the OAuth origin.

The first tool allowlist is `search_ingredients`, `search_additives`,
`search_yeasts`, `search_wiki`, `fetch_wiki_page`,
`calculate_gravity_target`, and `build_recipe_draft`. These call the same
validated `@meadtools/recipe-agent` / `@meadtools/recipe-workflows` operations
as hosted chat. No owned recipe or brew context, save, or write tool is in the
first release. Draft output is unsaved. Recipe builder and brew tracker remain
free.

Bound request bytes, tool arguments, wiki retrieval, output bytes, account
concurrency, and call rate. Record only user ID, tool name, result class,
duration, and time for operations; never log bearer credentials or recipe
inputs. A separate server-side kill switch must disable MCP without disabling
hosted chat.

The current limits are 16 KiB per MCP request, 64 KiB per tool result, two
concurrent calls and 60 calls per minute per account, and a 25-second tool
response timeout. Usage rows contain account ID, tool name, result class,
duration, and time; they do not contain tool arguments or results. Timed-out
calls retain their short concurrency lease until it expires because work may
still be settling after the response timeout.

## Ko-fi reconciliation

[Ko-fi webhooks report payments, but not membership endings](https://help.ko-fi.com/hc/en-us/articles/360004162298-Does-Ko-fi-have-an-API-or-webhook).
Each verified and deduplicated recurring payment extends an account's paid
through date. If no renewal arrives, access expires after a short documented
grace period. Cancellation or refund exceptions need a manual reconciliation
path and, for existing supporters, a Members CSV import. A Ko-fi email must be
verified through a one-time link sent to that address before payments can be
attached to a MeadTools account; the current MeadTools signup does not verify
email ownership. Store only the minimal payment identity and email match hash
needed for deduplication and reconciliation. Grant the included 1,000 credits
idempotently for each eligible paid period after account linking.

## Launch gates

The [MCP client compatibility plan](mcp-client-testing-plan.md) tracks the
confirmed clients and the next Preview tests, including Grok, Gemini, and
Perplexity. Provider-specific setup instructions should follow observed
connect, tool-call, revoke, and reconnect results.

1. Import and reconcile older Ko-fi membership payments after the Members CSV
   is available. Local webhook, linking, expiry, and idempotent grants have
   been exercised, but the historical import remains a launch dependency.
2. Keep the confirmed Claude and ChatGPT connection, invocation, revocation,
   and reauthorization results as the baseline. Repeat these checks after any
   OAuth origin change or when switching to `preview.meadtools.com`.
3. Review account UI, connection and revocation, tool examples, usage limits,
   and troubleshooting with a premium test account.
4. Finish full denial, retry, concurrency, hosted/MCP parity, purchase, renewal,
   and rollback verification. Keep the production MCP switch off meanwhile.
5. Finish and review Stripe subscription Checkout, lifecycle webhooks, and
   billing management before opening sales. Keep the production purchase
   switch off until the wider premium bundle is ready.

## Local verification

The schema can be applied to an existing local development database with
`npm run db:push --workspace @meadtools/web`. Do not use a local migration
deploy or reset for this check. The fixture script below creates a disposable
local account, verifies a delayed Ko-fi webhook, duplicate and same-month
credit idempotency, hosted-chat entitlement, payment restriction, and the
authenticated local premium and chat-access routes, then removes its rows. It
uses a generated test HMAC secret and sends no email. The shared local web
server must already be running on port 3000.

```sh
TSX_TSCONFIG_PATH=apps/web/tsconfig.json node --conditions=react-server \
  -r dotenv/config --import tsx apps/web/scripts/verify-premium-local.ts \
  dotenv_config_path=.env.local
```

For hands-on local testing, `apps/web/.env.local` needs Ko-fi's verification
token and a stable email-digest secret, SMTP settings (`EMAIL_USER` and
`EMAIL_PASS`), a Stripe sandbox key and CLI listener signing secret, the
sandbox monthly premium Price ID, `PREMIUM_SUBSCRIPTIONS_ENABLED=true`, and
`PREMIUM_ACCESS_ENABLED=true`. Leave both switches unset in Vercel Production.
Run `npm run stripe:listen` while
testing Stripe Checkout so signed `invoice.paid` and subscription events reach
the local app. The local premium page is `/account/premium`; it offers Stripe
Checkout, Stripe billing management after subscribing, a Ko-fi monthly-support
link when `PREMIUM_KOFI_JOIN_URL` is set, and the payer-email link flow.

### Hands-on local checks

Use separate local MeadTools accounts for the Ko-fi and Stripe paths so each
starts with zero premium entitlement. On the Ko-fi account, open
`http://localhost:3000/account/premium`, enter an inbox you control, and follow
the one-time email link. Then run `npm run premium:kofi:test --workspace
@meadtools/web` and enter that same address at the prompt. This creates a
**simulated local $5 Ko-fi payment**, with no Ko-fi charge. Refresh the premium
page and credit wallet; expect Ko-fi access and one 1,000-credit grant. Ko-fi's
Dashboard first-monthly test separately verifies its HTTPS webhook tunnel.

On the Stripe account, choose the $5 monthly Stripe button and complete the
**sandbox** Checkout with a Stripe test payment method. Keep `npm run
stripe:listen` running, then refresh the premium page and wallet; expect Stripe
access and one 1,000-credit grant. Use Manage Stripe subscription to inspect
the sandbox Billing Portal and cancellation path. Replaying a paid invoice must
not add a second allowance. The listener and temporary Ko-fi tunnel must be
running for these webhook checks; neither is production infrastructure.

Ko-fi currently uses simple monthly tips, with no premium tier. A new Ko-fi
supporter must pay at least $5 monthly and then link the same payer email to
MeadTools. Existing linked monthly supporters are grandfathered below $5. The
Ko-fi Dashboard can send its first-monthly test to the local tunnel; test
webhooks do not create a real Ko-fi subscription. Do not advertise a Ko-fi
premium tier or enable production Stripe Checkout before the bundle is ready.

The premium fixture does not validate email delivery, the Ko-fi live webhook,
or historical CSV backfill. A real external MCP client connected on the
earlier PR deployment URL; repeat that test on the stable branch URL. If real
Ko-fi payments are received by the separate Preview database, reconcile them
from a fresh private export before switching the webhook to production. The
premium account endpoint reports MCP available only while the account is
eligible and `PREMIUM_MCP_ENABLED=true`.

### Local MCP verification

Use the shared local web server and the existing local database. Set
`PREMIUM_MCP_ENABLED=true` and a randomly generated
`MCP_OAUTH_SIGNING_SECRET` (at least 32 characters) in the ignored
`apps/web/.env.local` for local testing. Do not set the MCP switch in Vercel
Production. Apply the current schema to an existing local database with
`npm run db:push --workspace @meadtools/web`; a reset is unnecessary.

From `apps/web`, run these disposable fixtures. Each creates an isolated local
account and deletes its rows after the check. Neither calls a model provider:

```sh
node --conditions=react-server --env-file=.env.local --import tsx scripts/verify-mcp-local.ts
node --conditions=react-server --env-file=.env.local --import tsx scripts/verify-mcp-oauth-local.ts
```

The first verifies protocol initialization, seven-tool discovery, a gravity
calculation, anonymous denial, premium entitlement, token revocation,
concurrency, and the minute limit. The second verifies metadata, dynamic client
registration, browser consent, PKCE, single-use consent and code, refresh
rotation, and revocation. A signed-in premium account can also open
`http://localhost:3000/integrations/mcp` to create, copy once, and revoke a
personal connection token. The endpoint shown locally is
`http://localhost:3000/mcp`.

For Claude Desktop and ChatGPT, add a custom remote MCP connector using the
PR branch URL shown on `/integrations/mcp` and approve the MeadTools OAuth
consent screen in the browser. Password and Google MeadTools sign-in both pass
through `/{locale}/oauth/connect` before the client callback. Test that each
client discovers the seven allowlisted tools, runs a read-only calculation,
and loses access when its connection is revoked or premium expires. Localhost
fixtures cannot prove these client-specific flows. The Ko-fi tunnel used
during payment setup is no longer running and is unrelated to MCP.

The client requirements above were checked against the
[MCP authorization specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization),
[Claude remote connector instructions](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp),
and [ChatGPT MCP authentication guidance](https://developers.openai.com/plugins/build/auth).

### Durable Stripe checkout recovery

Apply migration `20261012000000_premium_checkout_reservation` before deploying the
checkout reservation code. It adds one durable attempt per account. Requests
reuse its frozen parameters and Stripe idempotency key; sessions expire after
one hour. Only a Stripe-confirmed expired session, or a completed session whose
subscription is now canceled/incomplete-expired, permits an atomic replacement.
A completed checkout awaiting its webhook must not produce another checkout.

A missing session ID with an ambiguous request older than 23 hours fails closed,
before Stripe's guaranteed idempotency retention ends. A frozen expiry rejected
by Stripe also requires reconciliation. Billing support must inspect the attempt
ID/idempotency key (`premium-checkout:<attempt_id>`) and account in Stripe, persist
the matching session ID if found, and resolve its payment/subscription state.
Do not delete/rotate the reservation merely because the customer reports a
failure: establish that no payable or paid session remains first. The same check
is needed for accounts with untracked sessions created before this migration.
This release does not automatically reconcile old ambiguous attempts.

Webhook membership and identity updates serialize on the account row. They
re-read current Stripe subscription state under that lock, with a 30-second
transaction timeout; provider failures/timeouts roll back and Stripe can retry.
A paid invoice grants only the matching recurring line's service period, never
the current subscription's potentially unpaid later period.

### Connection safety and registration limits

Consent and authentication pages deny framing with CSP `frame-ancestors 'none'`
and `X-Frame-Options: DENY`. Refresh rotation retains consumed hashes until the
connection is removed. Reusing a consumed refresh token atomically revokes that
connection, including its replacement tokens. Clients must serialize refreshes;
a simultaneous second refresh is treated as reuse and requires reconnecting.
Signed-in users can list and revoke connections after entitlement expires or a
rollout switch is disabled. Creating personal tokens serializes on the account
so concurrent requests cannot exceed five active tokens.

Anonymous client registration has a database-backed global budget of 60 per
hour and a maximum of 1,000 stored clients. It returns HTTP 429 with a
`Retry-After` header when either limit is reached. Registration removes clients
older than 30 days that have no live refresh grant or outstanding authorization
code; live connections survive cleanup. These conservative limits can be
revisited after observing Preview use.

### Subscription payment recovery

Migration `20261013010000_complete_premium_mcp_lifecycle` adds consumed refresh
hashes, the registration budget, invoice/payment-intent mappings, and premium
invoice sources in the existing payment recovery queue. Stripe invoice payments
are mapped when an invoice is processed; a later refund or dispute can also
repair a mapping for an older stored invoice. Receipts arriving before the
invoice are retained and replayed after fulfillment. Failed mapping lookups
remain retryable, including redelivery of the same event ID.

Succeeded subscription refunds reverse the proportional share of the invoice's
1,000 included credits using immutable ledger entries. A fully refunded invoice
removes its paid period, preserving any later unrefunded Stripe period and
other entitlement sources. Partial refunds retain the paid period. Ambiguous
refunds and refunds exceeding the available credit balance restrict access and
enter administrator review. Disputes restrict chat and MCP pending an operator
decision; they do not automatically erase an entitlement that a favorable
outcome could restore. The existing payment recovery administration lists these
cases with `premium:<invoice_id>` as their source. Resolving a case can append a
credit correction; access stays restricted while any credit-pack or premium
case remains open or the available balance is negative. For an adverse dispute
outcome, retain the restriction until the affected paid period has expired or
been manually revoked and the credit correction has been recorded.

`npm run test:premium-foundation --workspace @meadtools/web` exercises real
PostgreSQL transaction interleavings and payment recovery with synthetic users
and mocked Stripe responses. It only accepts a localhost database named
`meadtools_premium_foundation_test` and clears its fixture rows. CI provisions
that disposable database, applies all reviewed migrations, and runs the checks.
It does not load application environment files, send email, or call a model or
payment provider. Real provider compatibility is verified separately on Preview.
