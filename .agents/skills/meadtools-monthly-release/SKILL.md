---
name: meadtools-monthly-release
description: Prepare and coordinate MeadTools monthly releases, including product-specific notes, reviewed main promotion, GitHub Release drafts, opted-in email batches, and no-change months. Use for a MeadTools release checkpoint or release-day follow-up.
---

# MeadTools monthly release

Work from a current MeadTools checkout and follow its AGENTS.md. The release
target is the first Monday of each month; preparation is the preceding Friday.
Both reminders are for 9:00 a.m. America/Chicago, and the GitHub release gate
opens no earlier than 9:15 a.m. on that Monday. A date never justifies
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
Weblate review process. `npm run release:drafts -- YYYY-MM-DD` prepares local
GitHub Release and product email drafts from a dated entry. Drafts are not
publication or sending. Read [the authoring guide](../../../docs/monthly-release-notes.md)
when editing notes.

Signed-in accounts have default-off Web, Mobile, Chat, and API release email
choices, a one-time prompt, account controls, and a product-specific
unsubscribe page. [The admin email procedure](../../../docs/monthly-release-emails.md)
prepares recipient rows and sends explicit small batches from production only.
It requires a valid configured mailing address; no-change months have no
eligible batch. Never infer consent from brew, recipe, or chat settings.

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

Prepare the dated website entry, GitHub Release draft, separate email drafts
for shipped products, and an internal checklist. Note features, improvements,
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

At 9:00 a.m. Chicago the 9:15 gate is still pending. After its window, verify
the intended SHA merged. If blocked, leave `main` unchanged and report the
specific blocker. Verify each selected deployment or store rollout before
publishing notes or a GitHub Release. Dispatch a production Mobile build only
for the reviewed `run` decision and exact merged SHA, and check for an existing
run before dispatching. A skipped Mobile build makes no new Mobile
availability claim.

Before subscriber email, review the exact product content, production sender
configuration, opt-in audience counts, and any existing delivery rows with the
maintainer. Prepare recipients in `/admin/release-emails`; send only when the
user has authorized that release's message. The sender rechecks consent, but
`FAILED` or stranded `SENDING` rows can have uncertain SMTP outcomes and must
be reconciled manually before any retry. Record links and outcomes for website
notes, GitHub Release, Mobile build, and each email product. If nothing shipped,
record the no-change decision and send no announcement.

Cross-device reminders are coordination only; they do not execute this skill
or authorize merge, publication, or email. See
[reminder setup](../../../docs/monthly-release-reminders.md) when adjusting
their schedule or delivery.
