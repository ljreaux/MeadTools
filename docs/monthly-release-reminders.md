# Monthly release cloud jobs

The two existing ChatGPT cloud jobs execute the
[repository release skill](../.agents/skills/meadtools-monthly-release/SKILL.md)
through connected GitHub tools. Reuse them; do not create replacement reminders.
They prepare reviewable work and inspect outcomes. Larry's explicit approval of
the exact head/base, notes, product scope, and Mobile decision is required before
the agent adds `release-ready` and enables native auto-merge. GitHub, not the
agent's clock, opens the merge gate. See [the gate procedure](monthly-release-gate.md).

| Job                                   | Cloud task ID                      | Schedule (America/Chicago)                            |
| ------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| MeadTools monthly release preparation | `6ac276d923ac8191afc89eb77fbd0407` | 9:00 a.m., Friday immediately before the first Monday |
| MeadTools monthly release follow-up   | `6ac2771c39448191990c3ac75cd60ff5` | 10:00 a.m., first Monday                              |

Preparation dates are October 30, December 4, and January 1; corresponding
release follow-ups are November 2, December 7, and January 4. Keep the named
time zone across DST. The Friday can be in the previous month. Do not substitute
first-Friday or weekly schedules. Inspect the actual saved custom recurrence;
the list's generic frequency label alone is not proof of the recurrence.

## Preparation instructions

Read current `preview`'s AGENTS.md and release skill through the connected
repository. Inspect the main/preview diff, linked PRs, required controls, and
verified product availability. Prepare the internal product-note JSON at
`docs/releases/YYYY-MM.json` using the shape in
[the authoring guide](monthly-release-notes.md), and a release record from
[the template](releases/monthly-record-template.md). Merge the note draft into
`preview` through a reviewed PR; do not mix that step with approving the later
release head. Create/update one draft `preview` → `main` PR with the exact
head/base SHAs, `Release-note draft:` path, and Mobile run/skip decision.

Present concrete notes, scope, SHAs, CI, and the PR for Larry's approval. After
approval, recheck everything, mark it ready, label and arm auto-merge. Any head
or base change requires fresh review and approval, including Weblate commits.
No eligible work means an internal no-change record and no armed release PR.
Default Mobile to skip and retain chatbot beta status unless Larry separately
approves changing them. Public dated notes, GitHub publication, and email are
not authorized by preparation or by approving the code promotion alone.

## Follow-up instructions

At 10:00 inspect the actual scheduled gate, approved SHA, merge, deployment,
smoke checks, and selected product availability. Record evidence or the exact
blocker; a delayed GitHub workflow or deployment is pending, not a successful
release. Never silently retry a blocked merge or bypass the noon closure.
Prepare public notes and release artifacts after verified deployment, request
publication approval, and follow the release procedure. Verify published
artifacts and aggregate email outcomes without duplicating announcements or
exposing account data. Preserve a no-change month without public announcements.

## Execution and access evidence

On October 17, a `Run now` read-only diagnostic in the actual preparation job
successfully used connected GitHub tools to read `preview` and the release skill.
It confirmed repository admin/push metadata, repository auto-merge enabled, and
available schemas for draft PR creation, file/commit writes, PR labels, and
auto-merge. No repository write was exercised. Evidence is in the
[cloud task conversation](https://chatgpt.com/c/6ac276b5-5b2c-83e9-aa6e-a95b28aa3c66).
The original preparation prompt was restored after the test. This is capability
evidence, not proof that every future mutating endpoint will succeed.

If a run lacks a needed tool, app permission, or current repository context,
report that concrete blocker. Never substitute a reminder and claim execution.
Do not inspect credentials or run paid-model evaluations. Job updates and
manual tests must preserve existing schedules and active states; use a temporary
read-only prompt for access diagnostics, restore it afterward, and verify the
persisted prompt. Notification receipt and the first live monthly cycle remain
separate verification steps; do not claim those passed from a saved task card.
