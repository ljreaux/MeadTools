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

| Role | Purpose |
| --- | --- |
| Project owner | Manages Weblate, glossary rules, service configuration, and cutover. |
| `rizzek` | German translator and trusted GitHub/Weblate reviewer. |
| `github-translation-approver` | Weblate service account used only by GitHub Actions; not a human login. |
| Translation bot | Creates unapproved German suggestions. |

Use real name/email accounts for the owner and translator. Keep public
registration closed except for a short, supervised account-creation window;
verify the new owner login before disabling or removing any pilot account.

### Initial translator setup

The initial German reviewer account is `rizzek`. The account has the **Users**
and **Reviewers** roles and is registered to the translator's approved email
address.

To set or replace its password, open
`https://translations.meadtools.com/accounts/reset/`, enter that email address,
and use the reset email to choose a password. Do not share a temporary password
in chat, GitHub, or a repository file. Public registration should remain
closed; an owner provisions any additional accounts.

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
2. The translation bot detects the English locale change and updates the
   German JSON in **that same PR**.
3. Bot-created German values are marked unapproved in Weblate after the PR is
   merged to `preview`.
4. The feature can merge to `preview` even when German review is pending.
5. A German-only follow-up commit does not trigger web, mobile, or Vercel
   deployment work.

### English source changes

| English change | German handling |
| --- | --- |
| New string | Generate a German suggestion; leave it unapproved. |
| Meaningful source update | Clear German approval, regenerate using the glossary, and leave it unapproved. |
| Source deletion | Remove the matching German key in the bot update. |

Approval is reset for a changed English source even when the German value
looks unchanged. This prevents a previously reviewed translation from being
silently treated as valid for new meaning.

## German review flow

After a bot translation batch reaches `preview`, automation should create or
update one GitHub issue assigned to `rizzek`. The issue must link to:

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

1. The translator checks out the commit linked from the review issue.
2. They edit only the German locale files that need changes.
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
/approve-translations <full Weblate commit SHA>
```

The workflow confirms that the referenced commit is an isolated Weblate German
translation commit already contained in `preview`, verifies every value still
matches Weblate, then marks only that batch approved. It posts a confirmation
comment when finished.

### Weblate fallback

The translator can always use Weblate's saved German review queue to inspect
source text, AI output, and context. Editing and clicking **Approve** there
records the reviewer in Weblate and lets Weblate batch the resulting Git
commit. This is the simplest option for a small correction or an unchanged
suggestion.

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
If a translation change is combined with an app, package, or shared-script
change, normal checks and deployment run.

## Before go-live

- [ ] Have the German translator review and refine the provisional glossary.
- [ ] Create real owner and translator accounts; retire pilot accounts only
      after login verification.
- [ ] Confirm `rizzek` has GitHub repository access for issue assignment and
      trusted PR review.
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
