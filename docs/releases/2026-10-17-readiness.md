# Preflight for October 30 preparation

Checked October 17, 2026, America/Chicago. This records setup evidence, not a
release, approval to promote code, or a public announcement.

## Verified controls and cloud jobs

- GitHub default branch is `preview`; repository native auto-merge is enabled.
- `Main monthly release gate` is active on `main`, requires the release-note
  check and `monthly-release-gate`, and has no bypass actors.
- The broader branch ruleset has deploy-key/integration bypass actors; the
  separate monthly ruleset still applies. GitHub review requirements remain
  enforced alongside Larry's explicit exact-SHA release authorization.
- Both existing cloud jobs remain enabled. Preparation: October 30, December 4,
  January 1 at 9:00 a.m. Chicago. Follow-up: November 2, December 7, January 4
  at 10:00 a.m. Chicago. The follow-up moved from 9:00 to after the gate attempt.
- The saved prompts require action, reviewed internal product notes,
  exact-SHA approval before auto-merge, no early publication/email, Mobile
  build skip by default, and retained chatbot beta status.
- A read-only `Run now` diagnostic in the preparation job successfully read
  preview and the repository skill using connected GitHub tools; repository
  admin/push metadata and all needed write-tool schemas were available.
  Write mutations were deliberately not tested. See the
  [task conversation](https://chatgpt.com/c/6ac276b5-5b2c-83e9-aa6e-a95b28aa3c66).

## Implementation prepared for review

The accompanying change adds the noon gate close-only schedule, single-candidate
selection, GitHub required-review checks, idempotent status writes, stale-base
invalidation, and mocked regression coverage. The note check accepts a changed,
valid, reviewed internal monthly JSON draft for same-repository preview-to-main
promotions. This avoids publishing a future release or starting email just to
satisfy Friday's PR check. The release skill, ownership/rollback procedure,
cloud-job instructions, and per-month record template agree on the flow.

These repository changes take effect after their reviewed PR merges to preview.
No production gate was opened or release PR armed during preflight.

The first PR CI run exposed SDK 57 patch drift in the existing Mobile
compatibility check. The three requested Expo/UI/Router patch versions and
corresponding root versions/lockfile were aligned. Local dependency validation,
Mobile typecheck, 12 Mobile runtime tests, and Android preview export pass;
no EAS or production Mobile build was dispatched.

## Evidence to collect during the first monthly cycle

- October 30: create/update notes and record; review the final head/base after
  all preparation/Weblate commits; obtain Larry's promotion approval; arm once.
- November 2: actual scheduled opening result, intended merge/deployment SHA,
  smoke checks, selected product availability, and close-run result if a
  monthly gate remains open. GitHub schedule timing is not a real-time guarantee.
- Obtain publication approval before dated website notes trigger subscriber
  email; record the GitHub tag/release and aggregate send outcome without
  duplicating October 5 or the October 17 hotfix.
- Confirm notification receipt separately. No-change products stay out of public
  announcements. Unreleased Mobile does not block #413; its first launch is #439.

Keep #413 open for that live-cycle evidence. Do not close it based only on
mocked tests, saved schedules, or the connected-tool diagnostic.
