# Chatbot Beta and Paid-Credit Launch Checklist

This is the delta from the already-running MeadTools deployment. It does not
repeat existing website authentication, email, Google OAuth, or unrelated
application configuration. Secrets belong only in Vercel environment variables
and never in source control, exports, screenshots, or chat logs.

## Private beta: required configuration

### Vercel Production or the dedicated beta Preview branch

- [ ] Set `CHATBOT_LOCAL_TEST_ENABLED=true`. Despite its historical name, this
  is the server-side fail-closed switch used to enable the hosted chatbot.
- [ ] Set `FIREWORKS_API_KEY` to the dedicated beta/production service-account
  key. Keep local, preview, and production keys separate for auditability.
- [ ] Set `CHATBOT_USAGE_ENVIRONMENT` to a clear audit label such as `beta`.
- [ ] Confirm the existing `DATABASE_URL` targets the database intended for
  this deployment and Vercel can apply the committed Prisma migrations.
- [ ] Confirm the existing `CRON_SECRET` is present in Production. The new
  five-minute reservation reconciler uses it.
- [ ] Keep `CHAT_CREDIT_PURCHASES_ENABLED` unset or `false`. Beta users receive
  grants; Checkout must remain unavailable.
- [ ] Do **not** set Stripe credentials merely for beta access.

These chatbot-limit variables are already active through safe code defaults;
they are optional overrides, not a setup requirement:

- `CHATBOT_FIREWORKS_MODEL`
- `CHATBOT_MAX_OUTPUT_TOKENS`
- `CHATBOT_MAX_TOOL_CALLS`
- `CHATBOT_MAX_PROVIDER_CALLS`
- `CHATBOT_MAX_TOTAL_OUTPUT_TOKENS`
- `CHATBOT_MAX_PROVIDER_INPUT_CHARACTERS`
- `CHATBOT_MAX_TOTAL_PROVIDER_TOKENS`

Only add an override when we have a deliberate policy change to make. Record
the chosen value and reason in the release note/operations log.

## Safeguards already in the request path

No extra environment variables are needed to turn these on:

- [x] **Per-user usage audit:** database-backed hourly and daily aggregates
  retain non-sensitive request and provider-usage totals without imposing an
  ordinary paid-user quota.
- [x] **Per-turn bounds:** request-size, provider-context, tool-call,
  provider-call, response-output, total-output, and total-provider-token caps.
- [x] **Pre-provider balance reservation:** a prompt is blocked before any
  model call if the user cannot cover its bounded credit reservation.
- [x] **Abandoned-turn recovery:** the production cron reverses stale credit
  reservations and fails stale pending messages every five minutes.

The limit overrides above are clamped in code, so an accidental environment
value cannot raise them beyond the reviewed maximum.

## Beta launch steps

- [ ] Deploy this branch to the intended beta environment and verify the build
  applies the credit/chat migrations successfully.
- [ ] Verify the five-minute reconciliation cron in Production logs. Vercel
  cron jobs do not run for Preview deployments.
- [ ] In admin, keep global access set to **beta allowlist**.
- [ ] Grant chat access to each selected user, then grant their planned 1,000
  evaluation credits with the separate admin credit action.
- [ ] Verify a non-allowlisted user cannot see the chat launcher, chat route,
  or credit UI.
- [ ] Verify an allowlisted user can create a thread, send a prompt, see the
  balance change, return to the thread, and save a completed recipe.
- [ ] Confirm one insufficient-credit request returns a client-visible block
  before Fireworks receives a call.
- [ ] Confirm the 90-day chat-retention language and cleanup behavior match the
  agreed policy.
- [ ] Check Fireworks usage by the dedicated key/model after the first beta
  sessions. Keep auto-reload disabled until normal usage is established.

## Chat quality gate

- [ ] Run the recipe, process/wiki, calculator, off-topic, metric, and German
  test prompts against the deployed beta model configuration.
- [ ] Review exported chats outside Git and add a deterministic regression test
  for every behavior fix.
- [ ] Verify completed drafts save and render correctly in the recipe builder.
- [ ] Check the popup chat, recipe full-screen table, external-link dialog,
  thread history, and mobile-width layout.

High-risk regressions to validate before inviting beta users:

- [ ] A traditional draft must not repeatedly reconfirm the already-selected
  honey/adjustable fermentable.
- [ ] Recipe-builder chat must resolve optional stages, including no secondary
  fruit, without repeatedly demanding a zero-value confirmation.

## Paid credits: later, after beta

Leave this entire section unchecked until beta access and output quality are
ready. It is intentionally separate from beta launch.

- [ ] Create a restricted live Stripe key and set `STRIPE_SECRET_KEY` in
  Production only.
- [ ] Create the live webhook endpoint
  `https://<production-domain>/api/webhooks/stripe`, set its signing secret as
  `STRIPE_WEBHOOK_SECRET`, and subscribe to:
  `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`, `refund.created`,
  `refund.updated`, `charge.dispute.created`, and
  `charge.dispute.funds_withdrawn`.
- [ ] Confirm Stripe Managed Payments/tax eligibility and the planned
  tax-exclusive USD display policy.
- [ ] Set `CHAT_CREDIT_PURCHASES_ENABLED=true` only after the live webhook
  test succeeds. Keys alone do not enable Checkout.
- [ ] Complete one small live purchase and verify webhook-only fulfillment,
  wallet activity, and the admin recovery flow.

## Fast rollback

1. Revoke a user’s beta grant or keep global access on **beta allowlist**.
2. Set `CHATBOT_LOCAL_TEST_ENABLED=false` and redeploy to stop model calls.
3. Keep `CHAT_CREDIT_PURCHASES_ENABLED=false` to stop new purchases while
   retaining the existing credit ledger.
4. Roll back application code only after checking whether later database
   migrations make that rollback unsafe.
