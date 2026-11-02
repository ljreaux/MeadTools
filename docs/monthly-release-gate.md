# Main release gate

Issue #413 tracks the monthly release process. The first Monday of each month
is the target. The GitHub workflow attempts to open the gate at **9:15 a.m.
America/Chicago**. GitHub schedules can run late; the workflow checks the local
date and time before opening anything. The opening window is **9:15 a.m. to
noon Chicago**; a noon close-only run revokes any unmerged monthly success.
GitHub can delay schedules, so verify the close run; it is not a hard real-time
merge deadline. A reviewed manual `close` dispatch can only close, never open. A missed or blocked attempt leaves the
gate closed and needs a reviewed manual retry on the same first Monday.

## Required checks and readiness

Draft main PRs skip the release-note check while their release scope is still
being reviewed. Marking a PR ready for review reruns the check; it must then
have dated notes, a reviewed changed internal monthly draft, or the applicable
reviewed exemption. See [internal draft authoring](monthly-release-notes.md). The monthly release
gate remains pending until the release window is explicitly opened.

After `.github/workflows/main-release-notes.yml` and
`.github/workflows/monthly-release-window.yml` are merged to `preview` and
tested against a main-targeting PR, add **both** `Release notes or reviewed bug
fix` and `monthly-release-gate` as required checks in the `main` ruleset. Enable
native GitHub auto-merge for the repository. Until those repository settings are
confirmed, the workflows report state but do not enforce the process.

For a monthly `preview` → `main` release PR, review the entire diff and CI. In
the PR body, record the exact reviewed commits and Mobile build decision:

```text
Release-ready head: <full 40-character preview head SHA>
Release-ready base: <full 40-character main base SHA>
Mobile production build: skip
Release-note draft: docs/releases/YYYY-MM.json
```

Use `run` in the last line only when a production Mobile build is intended and
the `build-mobile-production` label is present. For `skip`, that label must be
absent. The `skip-mobile-check` label concerns quality CI, not production EAS
builds, and cannot be on an armed release PR. The `skip-web-check` label also
cannot be on one. The run label records the decision; EAS dispatch remains a
separate verified release step and the label does not start a build by itself.
After review and authorization, add `release-ready` and arm
native GitHub auto-merge. A new head commit or a changed main base requires a
fresh diff review, updated SHA lines, and fresh approval.

The gate requires the release-note check and applicable GitHub and Vercel
checks. It does not wait for the separate Expo **preview** build workflow,
whose Free Tier queue can be long even when the production Mobile build
decision is `skip`. GitHub Quality still checks Mobile code. A production
Mobile build is dispatched separately only for a reviewed `run` decision.

The main-targeting PR workflow sets the `monthly-release-gate` commit status to
pending when the PR opens or its commits, body, or labels change. On the first
Monday at or after 9:15 a.m. Chicago, the scheduled workflow checks the open
ready PR, exact SHAs, labels, Mobile decision, native auto-merge state, and all
other visible checks. Only then does it set the status to success for that head
commit. If CI is still running or any check fails, it leaves the gate closed.
The gate separately checks GitHub’s required review decision. Where GitHub
requires no review, Larry’s explicit exact-SHA approval, recorded in the release
record and represented by `release-ready`, remains the authorization. Unknown,
required, or changes-requested review states cannot open it. More than one
armed monthly candidate closes all prior monthly successes. Repeated successful
runs do not duplicate status writes. Review events invalidate readiness status;
a main push closes unmerged monthly successes so an old base cannot remain armed.
Close-only runs preserve independent
hotfix/initial approvals. Runs are serialized.

Use a `monthly` manual dispatch later on the **same first Monday before noon** after fixing
the blocker. No-change months have no armed PR and open no gate.

## Initial promotion and urgent fixes

For the first full `preview` promotion before the monthly cadence, add
`initial-release-ready` as well as `release-ready` after reviewing its exact
head/base, internal product-note draft, and Mobile build decision. The initial
main PR note check accepts the changed internal draft under that label so a
public date is not guessed before deployment. Manually dispatch
`Monthly release window` with `mode=initial`, the PR number, and the exact
reviewed head SHA. It checks CI and the same readiness fields before opening
the gate. This exception does not imply an automatic scheduled merge; merge
the PR only after the verified gate and explicit release approval. Publish the
dated website entry and GitHub Release after verifying production, using the
actual date. Keep the timed gate optional until that follow-up publication is
complete and the end-to-end gate has been tested; then make it required.

An urgent bug-only PR into `main` may use the reviewed `bug-fix-only` exemption
and `hotfix-ready` plus `release-ready`. Its PR body needs `Bug-fix rationale:`
with a concrete explanation, exact head/base lines, and a Mobile build decision.
Dispatch with `mode=hotfix`, PR number, and exact head SHA. Feature changes do
not qualify. The `bug-fix-only` and `hotfix-ready` combination skips the Mobile
quality job for an urgent fix that does not release Mobile; Web/API quality and
Vercel checks remain required. Do not add `skip-web-check` or `skip-mobile-check`
to an armed hotfix. Record the hotfix in the next monthly summary without duplicate
email or GitHub announcements.

The release skill is a coordinator. It does not bypass required status checks,
and it must confirm the ruleset and auto-merge settings before treating the
gate as enforced. Restrict who can add readiness labels, dispatch the workflow,
and bypass the main ruleset; inspect the ruleset's bypass actors before launch.

## Ownership, records, and recovery

Larry Reaux approves the exact release scope, head/base, notes, and Mobile build
decision; the cloud agent prepares and records evidence in
`docs/releases/YYYY-MM.md` from [the template](releases/monthly-record-template.md).
The production tag is `release-YYYY-MM-DD` for the actual verified date and SHA.
Keep promotion, deployment, public availability, publication, and email states
separate. A skipped product receives no availability claim.

Before arming, inspect the live required checks and review rules, auto-merge,
and bypass actors. On October 17 the monthly ruleset was enforced with no bypass
actors; the broader branch ruleset had deploy-key/integration bypasses but those
did not bypass the separate monthly ruleset. Do not add bypasses to make a
release pass. Record Larry's explicit approval even when no GitHub review is
required or the PR author cannot approve their own PR.

For a failed deployment, stop publication, record the deployed/previous SHA and
migration compatibility, and obtain approval for the concrete rollback or fix.
Use a reviewed bug-only hotfix for an urgent correction; never force-push main,
rewrite a published tag, delete a migration, or roll code back across an
incompatible schema. If rollback is unsafe, prepare a forward fix. Preserve
published history and add a visible correction with its PR/date. An ambiguous
SMTP result requires manual review without resetting recipient claims or
resending a release. A publication-only promotion must still satisfy the notes,
readiness, exact-SHA approval, CI/review, and monthly-window checks; do not misuse
a bug-only hotfix exemption to publish an announcement.

The gate tests use mocked GitHub operations and clocks: early/expired windows,
DST, stale SHA, failed/pending CI, required review, multiple candidates, changes
during evaluation, no work, repeated runs, closure, and preserved hotfix approval.
Run `npm run test:workflows`. The first real monthly schedule/deployment and
notification receipt still need live evidence; deterministic tests are not a
claim that a production release occurred.
