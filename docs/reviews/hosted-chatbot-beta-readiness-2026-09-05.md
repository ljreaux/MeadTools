# Hosted chatbot beta readiness — 2026-09-05

PR: [#385 — feat(chatbot): OpenAI assistant beta foundation](https://github.com/ljreaux/MeadTools/pull/385)

## Verdict

**Hold the merge for now.** The reviewed local worktree is technically healthy
and the approved provider-backed evaluation is complete, but these response
fixes are not yet the commit checked by GitHub, the PR is still a draft, and
the release-blocking manual checks remain open.

No unresolved deterministic correctness defect was found in the final local
pass. One model-output quality gap remains in the bochet flow: the assistant
attributed an ABV target to the brewer that the brewer did not provide, and it
did not directly address the requested caramelization risks. The owner should
either accept that limitation for the private beta or address it before merge.

## Findings addressed in this pass

- Conversation-title generation is best effort and can no longer discard a
  successful main answer when its separate provider request fails.
- Explicit `no backsweetening` intent removes model-supplied backsweetening.
- Explicit nutrient schedules override a conflicting model payload.
- Accepted beginner fruit defaults place the only fruit addition in primary
  unless the brewer explicitly requests another stage.
- Phrases such as `dry finish` are treated as an explicit dry-finish request,
  avoiding a redundant final-gravity question.
- Sulfur troubleshooting no longer claims that more nitrogen will usually
  clear the problem; it asks for fermentation stage, gravity, yeast, and
  nutrient history before recommending a correction.
- Accepted beginner defaults cannot inject cinnamon, clove, or orange into a
  recipe unless the brewer requested those flavors.
- Unknown provider attempts no longer hold customer credits indefinitely: the
  24-hour recovery rule settles known checkpoints or reverses a zero-checkpoint
  hold.
- React Joyride remains on v3.2.0. The tutorial now supplies a safe placement
  default, uses v3 option/style names, preserves custom final content, and
  advances cards through an explicit sentinel even when a conditional target
  is absent.
- Local and Vercel builds now allocate an 8 GB Node heap after the default 4 GB
  build exhausted its heap.
- The local Stripe listener is available as `npm run stripe:listen`, with the
  complete Checkout, refund, and dispute event set.

## Verification evidence

| Gate                                                        | Result                                                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full deterministic test suite                               | Pass                                                                                                                                                               |
| Typecheck, all workspaces                                   | Pass                                                                                                                                                               |
| Shared package boundaries                                   | Pass                                                                                                                                                               |
| ESLint                                                      | Pass with 122 existing React compiler warnings and no errors                                                                                                       |
| Production Next.js build                                    | Pass with the 8 GB heap; known Scalar `web-worker` warning only                                                                                                    |
| API contract generation and 33 contract tests               | Pass; no generated drift                                                                                                                                           |
| OpenAPI generation/parity                                   | Pass; no generated drift                                                                                                                                           |
| `git diff --check`                                          | Pass for committed PR diff and local changes                                                                                                                       |
| Prisma migrations on a fresh disposable PostgreSQL database | Pass, 21/21                                                                                                                                                        |
| Prisma upgrade from the `preview` migration baseline        | Pass, 14 PR migrations applied                                                                                                                                     |
| Tutorial desktop flow                                       | Pass, all 30 visible steps reach the final screen                                                                                                                  |
| Tutorial 390×844 flow                                       | Pass, all 30 visible steps reach the final screen                                                                                                                  |
| Tutorial browser console                                    | No new errors after the fix                                                                                                                                        |
| GitHub checks                                               | Green for the last pushed commit, but stale relative to local changes                                                                                              |
| Targeted provider evaluation                                | Complete: 15 scenarios, 24/24 turns returned, 321 credits used (400-credit cap), `gpt-5.4-mini-2026-03-17`                                                         |
| Production dependency audit                                 | 25 web findings: 17 high, 7 moderate, 1 low, 0 critical                                                                                                            |
| Knip                                                        | Existing debt remains: 22 files, 19 dependencies, 7 dev dependencies, 14 unlisted dependencies, 10 binaries, 90 exports, 97 exported types, and 1 duplicate export |

The remaining direct high-severity audit findings are in the current
NextAuth/Nodemailer, Prisma, and `remark-mdx-frontmatter` dependency chains.
The installed NextAuth v4 peer range requires Nodemailer v7, while the fixed
Nodemailer release is outside that range, so there is no compatible in-place
upgrade. This needs explicit risk acceptance or a separately scoped auth/mail
migration; it should not be hidden by a forced peer override.

### Targeted provider evaluation — 2026-09-06

The approved run covered 15 scenarios and 24 user turns. All turns completed
without a provider error or timeout. It used 321 prompt credits, below the
approved 400-credit ceiling.

- Eleven scenarios were clean, including named-honey retention, exact fruit
  splits, progressive additions, medium-sweet handling, user corrections,
  risky sweet-bottling warnings, and wiki-grounded final-gravity guidance.
- The blackberry beginner default incorrectly put the only fruit addition in
  secondary. A failing deterministic regression was added first, then the
  workflow was fixed while preserving explicit secondary-stage requests.
- `dry finish` incorrectly triggered a duplicate final-gravity question. A
  failing deterministic regression was added first, then intent parsing was
  fixed.
- Sulfur troubleshooting used an overconfident nitrogen claim. A failing
  deterministic regression was added first, then the response sanitizer was
  tightened.
- The bochet scenario remains a quality concern: the response invented a user
  ABV target and did not answer the requested caramelization-risk question.

The three corrected behaviors have deterministic coverage and pass locally.
They were not sent through additional paid model turns because the exact
24-turn authorization had been consumed.

## Merge blockers

- [ ] Commit and push the reviewed local changes.
- [ ] Mark PR #385 ready for review and rerun GitHub/Vercel checks on that exact
      commit.
- [ ] Decide whether the bochet attribution/process-answer gap is acceptable
      for the private beta or should be fixed before merge.
- [ ] If desired, authorize a small provider-backed smoke check of the three
      behaviors corrected after the completed run: beginner fruit staging,
      `dry finish` intent, and sulfur troubleshooting.
- [ ] Complete the release-blocking authorization, cross-owner, concurrent
      turn, recipe-save, selected-context, and packaging-safety manual checks
      in `hosted-chatbot-manual-review.md`.
- [ ] Decide whether to accept the remaining dependency advisories and Knip/
      React warning debt for a private beta.

## Post-merge checklist for the owner

### After merging into `preview`

- [ ] Confirm the deployment built the exact merge commit and applied all 21
      migrations.
- [ ] Review the Weblate-generated German commit. Make human German corrections
      only in a German-only PR back to `preview`.
- [ ] Confirm the beta environment has `CHATBOT_ENABLED=true`, a dedicated
      `OPENAI_API_KEY`, a clear `CHATBOT_USAGE_ENVIRONMENT`, the intended
      `DATABASE_URL`, and `CRON_SECRET`.
- [ ] Keep `CHAT_CREDIT_PURCHASES_ENABLED=false` for the private beta.
- [ ] Keep global chat access in `beta_allowlist`; grant access and credits as
      separate admin actions.
- [ ] Verify one denied user, one allowlisted user, one revoked user, and one
      insufficient-credit request.
- [ ] Verify thread create/send/reload/rename/archive/delete, recipe save, popup
      chat, full-screen table, external-link dialog, and mobile layout.
- [ ] Confirm an exact calculator request is provider-free and a normal model
      turn changes the wallet by the expected whole-turn charge.
- [ ] Confirm the five-minute reservation reconciler runs in Production and
      exercise the documented 24-hour uncertain-attempt recovery path.
- [ ] Inspect OpenAI usage and application logs after the first beta sessions;
      keep auto-reload disabled until normal usage is established.
- [ ] Audit early beta chats for invented user requirements and incomplete
      answers to process-risk questions, especially bochet requests.
- [ ] Monitor yeast-tolerance warnings and confirm they remain advisory rather
      than blocking recipe generation.

### Before enabling paid credits

- [x] Confirm the application implements signed webhook verification,
      webhook-only fulfillment, event deduplication, terminal Checkout states,
      proportional refund reconciliation, deferred out-of-order refund/dispute
      handling, payment restriction, and administrator recovery. The focused
      deterministic billing suite passes 12/12 tests.
- [x] Confirm Checkout is built with Stripe Managed Payments, dynamic payment
      methods, an AI-as-a-service tax code, and tax-exclusive pricing.
- [x] Confirm the local Stripe CLI is authenticated to the MeadTools sandbox on
      API version `2026-07-29.dahlia`.
- [ ] Create restricted live Stripe credentials and the production webhook;
      subscribe to the same event set used by `npm run stripe:listen`.
- [ ] Record one end-to-end sandbox run through the real webhook transport,
      covering signed delivery, duplicate delivery, asynchronous
      success/failure, expiration, refunds, disputes, and out-of-order delivery.
      This is transport-level validation of implemented behavior, not missing
      application functionality.
- [ ] Confirm the live Stripe account is eligible for Managed Payments and
      confirm the business's tax registrations/policy. These are account and
      business launch decisions, not private-beta software blockers.
- [ ] Enable `CHAT_CREDIT_PURCHASES_ENABLED` only after webhook-only fulfillment
      and wallet/recovery behavior pass.
- [ ] Complete one small live purchase before broader paid availability.

### Rollback controls

- [ ] Revoke beta grants or keep `beta_allowlist` active to stop individual
      access.
- [ ] Set `CHATBOT_ENABLED=false` and redeploy to stop model calls globally.
- [ ] Keep `CHAT_CREDIT_PURCHASES_ENABLED=false` to stop new purchases without
      altering the ledger.
- [ ] Check migration compatibility before rolling application code backward.
