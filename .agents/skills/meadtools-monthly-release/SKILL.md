---
name: meadtools-monthly-release
description: Prepare and coordinate MeadTools monthly releases, including product-specific notes, reviewed main promotion, GitHub Release drafts, automatic opted-in product updates, and no-change months. Use for a MeadTools release checkpoint or release-day follow-up.
---

# MeadTools monthly release

Work from a current MeadTools checkout and follow its AGENTS.md. The release
target is the first Monday of each month; preparation is the preceding Friday.
Preparation runs at 9:00 a.m. America/Chicago; Monday follow-up runs at 10:00 a.m.
The GitHub monthly gate opens from 9:15 a.m. until noon on that Monday. A date never justifies
publishing unready work. Track rollout in
[issue #413](https://github.com/ljreaux/MeadTools/issues/413).

## Check the live controls

Inspect the current `main` ruleset, repository auto-merge setting, and
workflows before treating any gate as enforced. The repository contains a
release-note/bug-only PR check and a timed `monthly-release-gate`, but they
protect `main` only after both are made required and native auto-merge is
enabled. Follow [the gate procedure](../../../docs/monthly-release-gate.md).
Do not arm a PR or imply an automatic merge while those settings are absent.

The public archive is `/release-notes`; new dated entries are English source
strings in `packages/i18n/locales/en/default.json` under
`releaseNotes.entries`, with shipped products separated. Run
`npm run release-notes:check`. German translations follow the repository's
Weblate review process. `npm run release:drafts -- YYYY-MM-DD` prepares a local
GitHub Release draft from a dated entry. The production cron composes one
product-update email from the published entry after its date, with separate
sections for shipped products. Read [the authoring guide](../../../docs/monthly-release-notes.md)
when editing notes.

Signed-in accounts have one default-off product-update choice, a one-time
prompt, account control, and a signed unsubscribe link. An authenticated Vercel
cron runs on production every five minutes, sending small batches from the
published dated website entry. It needs a verified postal address in
`apps/web/lib/product-update-email.ts` before sending. The cron skips a
no-change month, future entries, and Mobile preview-only progress. It records
only the last release date claimed on each user; do not infer consent from
brew, recipe, or chat settings. See [the email procedure](../../../docs/monthly-release-emails.md).

The production Mobile EAS workflow is dispatch-only. A push to `main` does
not start it. `build-mobile-production` records a reviewed **run** decision;
absence records **skip**. The label alone does not dispatch a build.
`skip-mobile-check` is a separate quality CI override and cannot be on an
armed release PR.

## Friday preparation

Compare the candidate head with the last production release or verified
baseline. Record the exact `main...preview` range, both SHAs, relevant PRs,
and include/defer/no-change decisions for Web, Mobile, Chat, and API. Check
deployed behavior, feature availability, migration readiness, and store status
before describing a change as shipped. Web is not the default product.

Prepare internal product notes in `docs/releases/YYYY-MM.json`, GitHub Release
draft text, and a record copied from [the monthly template](../../../docs/releases/monthly-record-template.md).
Use the product-note JSON shape in the authoring guide; do not put unverified
dated entries in public locale files. Merge the internal notes into `preview`
through a reviewed preparation PR before final release-SHA approval. Note features, improvements,
fixes, and limitations with links to source PRs. Never publish a future or
unverified claim. If there is no eligible shipped work, record a no-change
month internally and create no public note, GitHub Release, email batch, or
armed release PR.

For a monthly `preview` → `main` PR, review the whole diff, current CI, and
the exact head/base SHAs. Record these lines in the PR body:

```text
Release-ready head: <full 40-character preview head SHA>
Release-ready base: <full 40-character main base SHA>
Mobile production build: run|skip
Release-note draft: docs/releases/YYYY-MM.json
```

Use the `build-mobile-production` label exactly when the decision is `run`.
After review and release authorization, add `release-ready` and arm native
auto-merge only when the gate is required. A changed head or base requires a
fresh diff review, updated SHA lines, and fresh approval. At 9:15 a.m. Chicago
on the first Monday, the scheduled workflow checks readiness, exact SHAs,
labels, CI, and auto-merge before opening the gate. A late or failed schedule
needs the documented reviewed same-day retry; never set the status by hand.

## Initial promotion and urgent fixes

For the first full promotion, review all `preview` changes, including Mobile
code. The first Mobile production build may be skipped. Label Mobile progress
as **preview — no production Mobile release**, with no Mobile release email.
The initial main PR can use the changed internal product-note draft with
`initial-release-ready`, as described in the gate procedure. Confirm the
production EAS workflow remains dispatch-only. After the reviewed initial
gate and merge, verify production, then publish a dated public note using the
actual deployment date. Do not repeat it at the next monthly checkpoint.

An urgent bug-only PR may use `bug-fix-only` with a concrete
`Bug-fix rationale:` and `hotfix-ready`. Mixed feature/bug PRs need dated
product notes. Keep urgent fixes in the next monthly summary without a
duplicate announcement. Verify required checks and bypass actors on `main`.

## Monday follow-up

At 10:00 a.m. Chicago, inspect the actual gate run and verify
the intended SHA merged. If blocked, leave `main` unchanged and report the
specific blocker. Verify each selected deployment or store rollout before
requesting publication approval for notes or a GitHub Release. Code-promotion
approval alone does not authorize publication, which triggers email. Dispatch a production Mobile build only
for the reviewed `run` decision and exact merged SHA, and check for an existing
run before dispatching. A skipped Mobile build makes no new Mobile
availability claim.

Publishing a dated entry to production automatically starts the opted-in email
batch when the postal address and existing sender configuration are present.
Verify the entry and its product scope before it reaches production. The cron
claims each user before SMTP so a failure is not retried automatically; inspect
aggregate failures in logs and avoid resending to uncertain recipients. Record
links and outcomes for website notes, GitHub Release, Mobile build, and the
combined email. If nothing shipped,
record the no-change decision and send no announcement.

The existing cloud jobs execute this procedure with connected GitHub tools;
see [job setup and access evidence](../../../docs/monthly-release-reminders.md).
Read the current skill from `preview`; a cloud run does not inherit a local
checkout. Report missing capabilities explicitly. Preparation requires Larry
Reaux’s exact-SHA approval before arming auto-merge. Publication requires
separate approval. Keep a blocked or delayed run visible without bypassing
checks; the first live monthly cycle remains to be verified.
