# Main release gate

Issue #413 tracks the monthly release process. The first Monday of each month
is the target. The GitHub workflow attempts to open the gate at **9:15 a.m.
America/Chicago**. GitHub schedules can run late; the workflow checks the local
date and time before opening anything. A missed or blocked attempt leaves the
gate closed and needs a reviewed manual retry on the same first Monday.

## Required checks and readiness

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

The main-targeting PR workflow sets the `monthly-release-gate` commit status to
pending when the PR opens or its commits, body, or labels change. On the first
Monday at or after 9:15 a.m. Chicago, the scheduled workflow checks the open
ready PR, exact SHAs, labels, Mobile decision, native auto-merge state, and all
other visible checks. Only then does it set the status to success for that head
commit. If CI is still running or any check fails, it leaves the gate closed.
Use a `monthly` manual dispatch later on the **same first Monday** after fixing
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
not qualify. Record the hotfix in the next monthly summary without duplicate
email or GitHub announcements.

The release skill is a coordinator. It does not bypass required status checks,
and it must confirm the ruleset and auto-merge settings before treating the
gate as enforced. Restrict who can add readiness labels, dispatch the workflow,
and bypass the main ruleset; inspect the ruleset's bypass actors before launch.
