# Translation workflow

> **Status: rollout plan.** The Weblate service is running as a pilot with a
> provisional German glossary and style baseline. Generated translations stay
> unapproved until a human reviews them. Do not treat this document as
> authorization to remove i18nexus yet.

## Goals

- Keep the app releasable when German review happens after a feature ships.
- Generate initial German suggestions with the approved style rules and
  glossary, but leave them unapproved.
- Give the German translator a Git-first review flow, with Weblate as the
  accurate review queue and UI fallback.
- Avoid web, mobile, and Vercel work for German-only follow-up commits.

## Roles

| Role                          | Purpose                                                                 |
| ----------------------------- | ----------------------------------------------------------------------- |
| Project owner                 | Manages Weblate, glossary rules, service configuration, and cutover.    |
| `rizzek`                      | German translator and trusted GitHub/Weblate reviewer.                  |
| `github-translation-approver` | Weblate service account used only by GitHub Actions; not a human login. |
| Translation bot               | Creates unapproved German suggestions.                                  |

Use real name/email accounts for the owner and translator. Keep public
registration closed except for a short, supervised account-creation window;
verify the new owner login before disabling or removing any pilot account.

### Initial translator setup

The initial German reviewer account is `rizzek`. The account has the **Users**
and **Reviewers** roles and is registered to the translator's approved email
address.

After outbound SMTP is configured and tested, the translator can set or replace
their password at `https://translations.meadtools.com/accounts/reset/`. Do not
share a temporary password in chat, GitHub, or a repository file. Public
registration should remain closed; an owner provisions any additional accounts.

## Current source of truth

Until the explicit cutover, i18nexus remains the source of truth for English
strings and existing translations. Do not edit locale JSON files directly for
ordinary product copy changes. The Weblate pilot is isolated from the
production translation workflow during this period.

The same-PR translation bot writes German locale JSON. It therefore cannot be
enabled while i18nexus is still the source of truth. The cutover must occur
before enabling that bot; it will replace these instructions after one
successful feature cycle and translation-review cycle.

## Target feature flow

This is the intended **post-cutover** production workflow. The same-PR
translation bot and review-issue automation are not enabled until i18nexus is
formally retired and their implementation has been reviewed. The glossary can
evolve over time; a bot must never auto-approve its own output.

1. A feature PR adds, changes, or removes English strings.
2. The translation bot detects the English locale change and adds a separate,
   isolated German-only commit to **that same PR**. Its commit must be titled
   `chore(l10n): add German AI translations` and include the trailer
   `Translation-Batch: ai-generated`.
3. Bot-created German values are marked unapproved in Weblate after the PR is
   merged to `preview`.
4. The feature can merge to `preview` even when German review is pending.
5. A German-only follow-up commit does not trigger web, mobile, or Vercel
   deployment work.

### English source changes

| English change           | German handling                                                                |
| ------------------------ | ------------------------------------------------------------------------------ |
| New string               | Generate a German suggestion; leave it unapproved.                             |
| Meaningful source update | Clear German approval, regenerate using the glossary, and leave it unapproved. |
| Source deletion          | Remove the matching German key in the bot update.                              |

Approval is reset for a changed English source even when the German value
looks unchanged. This prevents a previously reviewed translation from being
silently treated as valid for new meaning.

## German review flow

After a feature PR containing a bot translation commit merges to `preview`,
automation creates or updates one GitHub issue assigned to `rizzek`. The issue
must link to:

- the originating feature PR;
- the exact bot translation commit;
- the German Weblate review filter; and
- brief instructions for Git and Weblate review.

The issue is pinned to a specific batch. Do not ask the translator to review
the latest `preview` commit, because unrelated work might have arrived since
the translation was generated.

`rizzek` must be an accepted GitHub collaborator before GitHub can assign the
queue issue to them. Until then, the workflow still creates the queue issue but
leaves it unassigned.

### Preferred Git-first review

1. The translator inspects the bot commit linked from the review issue.
2. They branch from current `preview` and edit only the German locale files
   that need changes.
3. They open a German-only PR targeting `preview`.
4. When that PR is merged, trusted-review automation verifies the changed
   values still match Weblate and marks those units approved.

`rizzek` is a trusted author; the `translations-approved` label is the
maintainer override for another approved reviewer.

### Approving an unchanged suggestion

An unchanged AI suggestion produces no JSON diff, so it cannot be approved by
a normal content-only Git commit. On the matching queue issue, `rizzek` can
post:

```text
/approve-translations <full bot commit SHA>
```

The workflow accepts the command only on the matching queue issue, confirms
that the referenced commit is the isolated AI batch from the linked feature PR
that merged to `preview`, verifies every value still matches Weblate, then
marks only that batch approved. It posts a confirmation comment when finished.

### Weblate fallback

The translator can always use Weblate's saved German review queue to inspect
source text, AI output, context, and approval state. During this workflow,
Weblate is review-only: Git is the only system allowed to change locale JSON.
Use a German-only PR for corrections or the trusted issue command for an
unchanged accepted AI suggestion.

## Glossary and style baseline

The initial glossary and informal-tone rules are a baseline, not a release
blocker. The translator can improve them after reviewing real output. When a
term changes:

1. Add the preferred term to the Weblate glossary and translation-bot prompt.
2. Regenerate only affected **unapproved** German suggestions when useful.
3. Preserve every approved translation unless an English source change resets
   that unit for review.

The prompt must preserve placeholders, markup, measurements, brands, product
names, yeast strains, and technical abbreviations. It must use informal German
and the glossary's preferred terminology.

## Deployment and CI behavior

`scripts/app-impact.mjs` classifies files under
`packages/i18n/locales/` as generated translation output. A commit that changes
only those files skips web and mobile Quality jobs and Vercel app deployment.
EAS preview builds have a separate workflow and pause check.

While this rollout is being tested,
`ops/translation-migration.skip-builds` deliberately pauses web, mobile,
desktop, Vercel, and EAS builds. Remove that marker only in the final
cutover-completion PR. Once removed, a change that combines translation output
with an app, package, or shared-script change runs normal checks and deployment.

## Before go-live

- [ ] Have the German translator review and refine the provisional glossary.
- [ ] Create real owner and translator accounts; retire pilot accounts only
      after login verification.
- [ ] Confirm `rizzek` has GitHub repository access for issue assignment and
      trusted PR review.
- [ ] Configure and test Weblate SMTP before relying on password-reset email.
- [ ] Make the explicit source-of-truth cutover from i18nexus to the
      repository/Weblate workflow.
- [ ] Add the OpenAI key to GitHub Actions only when the same-PR bot is ready.
- [ ] Implement and test same-PR translation generation.
- [ ] Merge and live-test the assigned review issue and trusted
      `/approve-translations` action.
- [ ] Test a German-only PR approval and a Weblate UI approval.
- [ ] Verify no translation-only commit starts a web, mobile, or Vercel job.
- [ ] Run one normal feature cycle end to end.
- [ ] Update source-of-truth instructions and remove i18nexus only after the
      explicit cutover decision.

## Recovery

The Weblate host has daily encrypted off-site backups with retained daily,
weekly, and monthly snapshots. Restore testing was completed during the pilot.
If a translation batch is wrong, stop automatic translation, restore or reset
only the affected unapproved units, and rerun after correcting the glossary or
prompt. Never reset approved units as part of a bulk retry.
