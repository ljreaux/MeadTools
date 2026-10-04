---
name: meadtools-monthly-release
description: Prepare and coordinate MeadTools monthly releases, including product-specific notes, website and GitHub release drafts, opted-in email drafts, and no-change months. Use when asked to plan, draft, check, or publish a MeadTools release.
---

# MeadTools monthly release

Work in the existing MeadTools checkout. Read applicable current AGENTS.md files
and release documentation first; those instructions and the user's current
directions take precedence. Track rollout in
https://github.com/ljreaux/MeadTools/issues/413. Use the first Monday of each month
as the release target and the preceding Friday as preparation, both at 9:00 a.m.
America/Chicago unless the user changes the cadence. The earliest full cycle in
issue #413 is November 2, 2026, with preparation October 30, conditional on
readiness. A date never justifies releasing unready work.

## Current capabilities and planned gates

Inspect current workflows and main ruleset before every release. This skill is
guidance, not an enforced merge gate or a scheduler. Issue #413 tracks the dated
note convention, required note check, timed merge gate, release subscriptions,
email system, and Mobile build decision enforcement; do not assume they exist.

`apps/mobile/.eas/workflows/create-production-builds.yml` currently triggers on
qualifying pushes to main, independently of PR labels. The planned
`build-mobile-production` label means **run**, and its absence means **skip**,
but that skip is not operational until the EAS workflow is changed and tested.
`skip-mobile-check` skips a GitHub quality job, not an EAS production build.
Do not promise a skipped build or merge a release relying on that promise while
the push trigger remains active. Record the blocker instead.

Keep production deployment, EAS, email, payment, and model credentials in their
own services/workflows, outside the general cloud coding environment. Ordinary
checks use Node 22 and `npm ci --legacy-peer-deps`. Never run paid model
evaluations without explicit spend approval. Follow current repository rules for
API routes, schema, translations, and chatbot verification. For Next.js code,
follow applicable AGENTS.md instructions and consult the relevant `.next-docs/`
before coding; generate those docs as directed by the repository instructions
if they are missing.

## Establish the release scope

- Compare the candidate production commit with the last published production
  release/tag. Inspect merged PRs and deployed behavior, not commit titles alone.
  Record the exact comparison range, candidate SHA, and source PR links.
- Record **include / defer / no-change** separately for Web, Mobile, Chat
  assistant, and API/integrations. Any subset may release; Web is not the default.
  Omit empty public sections and the retired desktop product.
- Separate features, improvements, fixes, and known limitations. Verify actual
  production availability, including staged or disabled features. Friday drafts
  may describe candidates, but never publish them as already shipped.
- Respect preview-to-main, docs/translation-workflow.md, and mobile store timing.
  Track code merged, production build/deployment, and user availability separately.
  Review the entire promoted diff, including Mobile code when its build is skipped.
- Inspect .github/workflows/sync-release-branches.yml when planning PR/tag order:
  it fast-forwards only when main and preview have identical trees. Do not force
  branch synchronization or infer release availability from branch equality.

## Prepare consistent artifacts

- Prepare a dated, permanent website release entry and current/index update.
  Preserve apps/web/content/release-notes.mdx and prior legacy notes when evolving
  the format. Until the archive convention is implemented, report that gap and
  prepare reviewable drafts rather than implying an archive exists.
- Draft one GitHub Release from the production tag with matching product sections
  and links to full website notes. Do not invent a tag convention; inspect prior
  releases or obtain the missing decision. Mobile is shipped only after verified
  store rollout.
- Draft concise email per selected product audience, or one email with separated
  sections if subscriptions permit it. Use dedicated release-announcement opt-in,
  never recipe-activity or brew-alert flags. Verify provider/sender, consent,
  unsubscribe, segmentation, test-send behavior, and duplicate-send protection
  before any subscriber send. Missing infrastructure blocks sends, not drafts.
- Keep an internal dated checklist with product decisions, comparison range,
  approved SHA, PR/review/CI, Mobile build run/skip and label state, deployment,
  smoke checks, tag, website notes, GitHub release, email audience, and outcomes.
  Record pending, done, skipped, or failed with evidence and artifact links.

## Friday preparation

Inventory eligible changes and prepare drafts and the checklist. Ask the
maintainer to review scope and approve or skip readiness/arming when those
mechanisms exist. If no product has eligible user-facing work, record an internal
no-change decision and next target; create no armed release PR and fabricate no
announcement. Defer products independently.

Only after issue #413's gate is implemented, tested, and required on main:

1. Verify the single preview-to-main release PR, full diff, product readiness,
   notes, current CI and review, and exact approved head SHA.
2. Record and review **Mobile production build: run / skip** for that SHA.
   `build-mobile-production` means run; absence means skip. Verify actual workflow
   enforcement and recheck the label before merge.
3. Bind readiness to that SHA and arm native GitHub auto-merge only when the
   required release gate is enforced. New commits revoke readiness until reviewed.
4. The planned GitHub schedule opens the gate at **9:15 a.m. America/Chicago** on
   the first Monday after rechecking the same SHA and every prerequisite. The
   **9:00 a.m. reminder** is earlier and must not call a not-yet-due gate missed.
   Never set the final gate early or bypass a failed check. A skill or reminder
   alone does not enforce merge timing.

## Monday follow-up

Check whether the gate is implemented and whether its window has opened. Before
9:15 a.m., report pending; afterward verify whether the intended SHA merged. If
the gate is not implemented, report that limitation rather than implying it ran.
If the scheduled merge failed, report the blocker, leave main unchanged, and use
only the documented authorized retry inside the release window.

After a verified merge, verify the selected product builds/deployments and store
availability. Dispatch a production Mobile build only for the reviewed run
decision, with enforced run/skip behavior, and avoid duplicating an existing run.
A skipped build yields no new Mobile availability claim or release email.

Publish notes, GitHub Releases, or email only when the user's request authorizes
those actions and the included changes are actually available. Record sent,
published, skipped, and failed outcomes; retries must check existing artifacts
and send records. No shipped work anywhere means no GitHub Release or email.
Handle urgent fixes on a separately reviewed hotfix path, link them in the next
monthly summary, and avoid duplicate announcements.

## Pull request coverage

For PRs into main, check dated product notes for every user-facing feature. Once
implemented, a bug-only PR may use the reviewed bug-fix exemption with rationale.
Mixed feature/bug PRs need notes. Report missing notes before merge; never claim
the check blocks merge unless it is required in the main ruleset. Audit bypass
actors and keep the machine-enforced note and timed-release checks there.

For cross-device reminder migration and ready-to-paste prompts, read
../../../docs/monthly-release-reminders.md. Keep local reminders enabled until
cloud counterparts exist and have delivered verified test notifications.
