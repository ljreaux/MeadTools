# Annual Premium — issue #538

## Policy and behavior

Premium is $5/month or $50/year paid upfront: the annual price saves $10
against twelve monthly payments. Both include the same bundle and 1,000
hosted-chat credits per subscription month. Annual invoices fund twelve
monthly grants, never a single upfront 12,000-credit grant. Credit expiry,
purchased packs, Ko-fi grandfathering and retained-data policies are unchanged.

Cancellation of renewal preserves paid access and remaining monthly grants.
Switching billing intervals takes effect at the next renewal without proration.
The account screen can withdraw a pending interval change. A canceled renewal
must be resumed through billing management before scheduling a different plan.
The dedicated billing-portal configuration disables immediate plan changes and
uses cancellation at period end; existing portal configurations are preserved.

Annual refunds use the invoice's actual delivered-credit count. A full refund
stops future grants and reverses only included credits delivered for that
invoice; purchased credits are not independently refunded. As with monthly
refunds, spent credits may leave a negative balance requiring review. Partial
annual refunds stop future delivery and require administrator review of access
and allowances rather than guessing a new paid term. Closing a partial-refund
case alone does not restart its allowance schedule. Payment disputes pause
delivery through the existing payment-restriction flow. Any adverse resolution
must also revoke the affected paid membership before releasing restrictions.

The suggested 14-day first-purchase refund window in #538 remains a policy
proposal; this implementation does not promise a new refund window or alter
purchase terms. Managed Payments and existing tax handling are preserved.

## Configuration and local use

Keep the existing monthly `STRIPE_PREMIUM_PRICE_ID`. Configure a distinct USD
$50 recurring yearly Price as `STRIPE_PREMIUM_ANNUAL_PRICE_ID`. New annual
sales additionally require `PREMIUM_ANNUAL_SUBSCRIPTIONS_ENABLED=true` and the
existing subscription sales prerequisites. Turning annual sales off does not
invalidate existing annual subscriptions or stop delivery of paid allowances.
No production settings are changed by this branch.

Use the Premium account page to buy or schedule billing changes. Checkout
requests without a body remain monthly for older clients. Server validation
checks configured price, currency, amount, quantity and recurrence. Choosing
a different interval expires an unpaid checkout before replacing its durable
reservation; completed or ambiguous payment attempts fail closed.

Local development does not execute Vercel cron jobs. Deliver allowances that
are currently due with:

```sh
npm run premium:allowances --workspace @meadtools/web
```

This local command refuses remote databases. It uses the same delivery path as
`GET /api/cron/premium-allowances`, which requires the existing cron bearer
secret. Production runs it every fifteen minutes, processing at most 100
invoices per call. Never move clocks or alter production dates to test delivery.
Deterministic clock advancement belongs only in the guarded test fixtures.

## Delivery and accounting

The verified invoice service start anchors each month's grant. UTC anniversaries
preserve the original day/time, clamping only short months, so January 31 is
followed by February 28/29 and then March 31. There is no thirteenth grant at
the annual renewal boundary. A delayed worker catches up missed paid grants,
including after normal expiry, unless a refund, early revocation or restriction
blocks delivery.

`premium_stripe_allowances` uniquely identifies each invoice/index. Delivery
locks the account's user row, re-reads payment/restriction state, records a
stable invoice/index key in the existing immutable credit ledger, marks the
grant and increments the invoice's delivered total in one transaction. The
same lock serializes invoice, refund, dispute and delivery processing. Retry
and concurrent workers cannot double-grant. Existing monthly invoice grant
keys and behavior remain intact.

The reviewed migration adds annual fields with monthly-compatible defaults,
allowance constraints/indexes, and private server-only table permissions. The
ERD and API contracts accompany the migration. The normal local database uses
schema push; migrations are verified separately on the guarded disposable
`meadtools_premium_foundation_test` database.

## Verification

The premium-domain tests cover pricing, calendar boundaries and catch-up.
The PostgreSQL premium foundation suite covers monthly compatibility, concurrent
annual delivery, duplicate invoices, cancellation, refunds and changes at
renewal, with mocked Stripe services and no model-provider calls. Separate
Stripe sandbox checks verify actual provider compatibility; they are not
replaced by offline mocks. See the task handoff for completed local checks.

## Local verification — November 10, 2026

- Completed the real sandbox browser flow from the annual purchase button through
  Stripe Managed Payments Checkout, signed local webhook delivery and the return
  to an active annual membership. Verified one 1,000-credit grant and twelve
  stored allowances, with no real payment.
- Scheduled monthly billing at the annual renewal through the account screen,
  then withdrew the change. Checked keyboard access to billing management and
  a 390-pixel phone layout without horizontal overflow.
- Repeatedly scheduled and withdrew monthly renewal changes in the real sandbox.
  Released schedules use a new creation key; retries recover the same operation.
- Advanced a separate sandbox test clock through an annual-to-monthly renewal.
  Verified twelve annual grants totaling 12,000 credits, the paid $5 monthly
  invoice and one additional 1,000-credit grant through the signed local webhook.
  Replaying the webhook and allowance worker added no duplicate credits.
- The offline PostgreSQL suite covers annual-sales shutdown while withdrawing
  changes, leading one-off invoice lines, and delayed historical invoices while
  a future billing switch remains pending.
