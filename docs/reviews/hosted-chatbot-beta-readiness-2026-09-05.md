# Hosted chatbot beta readiness — 2026-09-05

PR: [#385 — feat(chatbot): OpenAI assistant beta foundation](https://github.com/ljreaux/MeadTools/pull/385)

## Verdict

**Hold the merge for now.** The reviewed local worktree is technically healthy,
but it is not the commit currently checked by GitHub, the PR is still a draft,
and the provider-backed regression suite needs to be rerun against the fixes
made after the latest three-pass evaluation.

No unresolved deterministic correctness defect was found in the final local
pass. The remaining release decision depends on current CI, model-output
quality, and the operational/manual gates below.

## Findings addressed in this pass

- Conversation-title generation is best effort and can no longer discard a
  successful main answer when its separate provider request fails.
- Explicit `no backsweetening` intent removes model-supplied backsweetening.
- Explicit nutrient schedules override a conflicting model payload.
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

| Gate | Result |
| --- | --- |
| Full deterministic test suite | Pass |
| Typecheck, all workspaces | Pass |
| Shared package boundaries | Pass |
| ESLint | Pass with 122 existing React compiler warnings and no errors |
| Production Next.js build | Pass with the 8 GB heap; known Scalar `web-worker` warning only |
| API contract generation and 33 contract tests | Pass; no generated drift |
| OpenAPI generation/parity | Pass; no generated drift |
| `git diff --check` | Pass for committed PR diff and local changes |
| Prisma migrations on a fresh disposable PostgreSQL database | Pass, 21/21 |
| Prisma upgrade from the `preview` migration baseline | Pass, 14 PR migrations applied |
| Tutorial desktop flow | Pass, all 30 visible steps reach the final screen |
| Tutorial 390×844 flow | Pass, all 30 visible steps reach the final screen |
| Tutorial browser console | No new errors after the fix |
| GitHub checks | Green for the last pushed commit, but stale relative to local changes |
| Production dependency audit | 25 web findings: 17 high, 7 moderate, 1 low, 0 critical |
| Knip | Existing debt remains: 22 files, 19 dependencies, 7 dev dependencies, 14 unlisted dependencies, 10 binaries, 90 exports, 97 exported types, and 1 duplicate export |

The remaining direct high-severity audit findings are in the current
NextAuth/Nodemailer, Prisma, and `remark-mdx-frontmatter` dependency chains.
The installed NextAuth v4 peer range requires Nodemailer v7, while the fixed
Nodemailer release is outside that range, so there is no compatible in-place
upgrade. This needs explicit risk acceptance or a separately scoped auth/mail
migration; it should not be hidden by a forced peer override.

## Merge blockers

- [ ] Commit and push the reviewed local changes.
- [ ] Mark PR #385 ready for review and rerun GitHub/Vercel checks on that exact
      commit.
- [ ] Rerun provider-backed evaluations on OpenAI
      `gpt-5.4-mini-2026-03-17`; specifically recheck the post-evaluation
      backsweetening, nutrient-schedule, holiday-additive, and title-failure
      fixes.
- [ ] Review every model-output failure or borderline result and add a
      deterministic regression test before changing behavior.
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

### Before enabling paid credits

- [ ] Create restricted live Stripe credentials and the production webhook;
      subscribe to the same event set used by `npm run stripe:listen`.
- [ ] Test signed delivery, duplicate events, asynchronous success/failure,
      expired Checkout, partial/full refunds, disputes, out-of-order delivery,
      negative-balance restriction, and admin recovery in Stripe test mode.
- [ ] Confirm tax/Managed Payments eligibility and the displayed pricing policy.
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
