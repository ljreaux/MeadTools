# Cross-device monthly release reminders

Related: [issue #413](https://github.com/ljreaux/MeadTools/issues/413).
The repository skill is
[meadtools-monthly-release](../.agents/skills/meadtools-monthly-release/SKILL.md).
After its PR merges into preview, pull preview on each computer and start a fresh
Codex session in that checkout; cloud tasks must also use a checkout containing
the skill. Invoke `$meadtools-monthly-release`. If an older machine-local copy
has the same name, compare it and retire or rename that copy after confirming the
repository version is discovered. Do not pause reminders as part of skill cleanup.

## Capability and duplicate check

ChatGPT Scheduled tasks are separate from a Codex Cloud coding task. This cloud
chat has no Scheduled task listing, creation, or notification-testing tools, so
it cannot verify duplicates or create the two reminders. Do not treat this
document as proof that a scheduled task exists. A ChatGPT reminder also does not
automatically execute a repository skill or a Codex Cloud job.

On ChatGPT web, select the same account and Work workspace you intend to use on
both devices. Open **Scheduled**, or go to
**Settings → Notifications → Manage tasks**. From a task conversation, the
**••• → See scheduled tasks** menu opens the same list.
Inspect existing tasks, including paused ones, for MeadTools, monthly release,
Friday preparation, and Monday follow-up. Reuse/edit matching tasks rather than
creating duplicates. If Tasks is unavailable in that workspace, check the
[current Tasks help](https://help.openai.com/en/articles/10291617-scheduled-tasks-in-chatgpt)
and workspace availability; do not assume a Work workspace supports it merely
because another workspace does. These entry points were verified against the
current official Tasks help on October 4, 2026; actual account/workspace
availability and existing task duplicates still require checking in Larry's UI.

## Create or update the two tasks

Open **Scheduled** to create a task in the chosen workspace, or ask ChatGPT in a
normal conversation by pasting each prompt below separately. Confirm ChatGPT
creates a task card, then inspect its title, stored
instructions, timezone, recurrence, and next run in task management. Do not accept
a textual promise without a saved task. Enable the desired push and email
notifications, browser/device notification permission, and confirm both devices
use the same account/workspace. For mobile push, the official help instructs
creating a task in a supported ChatGPT mobile app and granting notification
permission when prompted; check duplicates before doing this and remove a
temporary test task after testing. No production credentials are required.

### Preparation prompt

```text
Create a Scheduled task titled "MeadTools monthly release preparation".
Run at 9:00 a.m. America/Chicago on the Friday immediately preceding the first
Monday of each month, starting October 30, 2026. Use the named timezone so daylight
saving changes preserve 9:00 a.m. local time. This is not always the first Friday
of the month; preparation can fall in the preceding month.

Remind me to open ljreaux/MeadTools in Codex from current preview and invoke
$meadtools-monthly-release for Friday preparation, following issue #413:
https://github.com/ljreaux/MeadTools/issues/413
Ask me to review the exact candidate diff and linked PRs, record include/defer/
no-change for Web, Mobile, Chat assistant, and API/integrations, prepare product
notes and reviewable website/GitHub/email drafts, and record Mobile production
build run/skip for the exact head SHA. Verify the EAS production workflow remains
dispatch-only before relying on a skipped build; the PR label does not yet
dispatch a selected production build automatically. Timed auto-merge and
required gates are planned; do not assume they are active. No-change products
skip public announcements. For the initial full preview-to-main promotion,
include reviewed Mobile code but require the EAS production-build skip to be
implemented and verified before merge. Initial notes may separately include
"Mobile preview progress — no production Mobile release", never shipped Mobile
features or a Mobile release email. An early initial promotion uses the actual
verified deployment date for notes; a later no-change cycle may skip publication.
Do not merge, deploy, publish, send email, call paid
models, or request production credentials. Do not claim you inspected GitHub or
ran the Codex skill unless you actually have access and evidence.

Show me the stored schedule and next three occurrences. If this exact recurrence
is unsupported, say so rather than substituting first-Friday or weekly reminders.
```

### Release-day prompt

```text
Create a Scheduled task titled "MeadTools monthly release follow-up".
Run at 9:00 a.m. America/Chicago on the first Monday of every month, starting
November 2, 2026. Keep 9:00 a.m. local time across daylight saving changes.

Remind me to open ljreaux/MeadTools in Codex from current preview and invoke
$meadtools-monthly-release for release-day follow-up, following issue #413:
https://github.com/ljreaux/MeadTools/issues/413
Check whether release automation exists before assuming it ran. The planned
GitHub gate is at 9:15 a.m. America/Chicago, so at 9:00 report it as pending and
remind me to check after 9:15; do not call it missed early. Verify the reviewed
SHA, gate/merge result when due, per-product deployment/store availability, and
notes/GitHub/email outcomes. A blocked gate leaves main unchanged. Honor the
reviewed Mobile build run/skip decision only when EAS enforcement exists; a
skipped build is no Mobile release announcement. No-change products skip notes
and opt-in email. Initial notes may include clearly labeled
"Mobile preview progress — no production Mobile release" without treating it as
shipped or sending a Mobile release email. If the initial full promotion already
published notes at its actual verified deployment time and nothing further
shipped, record a no-change cycle rather than repeating the announcement.
Avoid duplicate builds, publications, or sends. This is a
reminder, not authorization to merge, deploy, publish, email, or run paid models.
Do not claim live GitHub or production verification without access and evidence.

Show me the stored schedule and next three occurrences. If this exact recurrence
is unsupported, tell me rather than silently changing the cadence.
```

## Verify the calendar and delivery before migration

These first occurrences should match the saved schedules:

| Preparation, 9 a.m. Chicago | Release follow-up, 9 a.m. Chicago |
| --- | --- |
| October 30, 2026 | November 2, 2026 |
| December 4, 2026 | December 7, 2026 |
| January 1, 2027 | January 4, 2027 |

If the scheduler cannot express the Friday rule, use explicitly dated one-time
tasks for these cycles, each with its corresponding prompt and named timezone,
and set a renewal reminder before the last scheduled cycle. Check duplicates
first and respect the account's task limit. Weekly Fridays produce extra
notifications and are not the requested schedule. Do not label a finite set of
one-time tasks a completed indefinite migration.

Test each cloud task using a **Run now** action only if offered; otherwise
temporarily set its next run a few minutes ahead. Confirm completion and receipt
of each selected push/email notification, then restore the exact recurrence and
check its next occurrences again. A task card alone is not a delivery test.
Record task titles/IDs, workspace, timezone, schedule, next run, and test outcomes.
Only after both tasks are saved, tested, and restored should Larry pause the two
original machine-local reminders. Until then leave both local reminders active.

These reminders coordinate review. They neither implement issue #413's GitHub
release gate nor provide the subscription/email infrastructure.

## Skill discovery reference

The official Codex [skills documentation](https://developers.openai.com/codex/skills)
was blocked by HTTP 403 in this cloud session. The current official Codex
[repository skill loader](https://github.com/openai/codex/blob/afb436df8b70bb5bc57b86d9a3e829968988cd21/codex-rs/ext/skills/src/host_roots.rs#L135)
does confirm `.agents/skills` discovery between the working directory and project
root, so the repository-root skill location is supported. The skill passed the
official Codex skill metadata validator. Confirm discovery in a fresh session
after pulling the merged PR; this existing cloud session does not prove discovery
on either computer.
