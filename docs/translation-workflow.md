# Translation workflow

> **Status: Weblate is the translation service and Git is the source of
> truth.** Normal builds are enabled.

## Goals

- Ship an English feature without waiting for a German reviewer.
- Use Weblate's native OpenAI integration, glossary, informal-German style,
  and review states instead of a custom translation bot.
- Keep Git as the preferred place for German corrections while preserving the
  Weblate UI as the review queue and quick-approval path.
- Produce exactly one preview build for an English-changing feature: after the
  Weblate translation commit is present.

## Roles

| Role | Purpose |
| --- | --- |
| Project owner | Manages Weblate, glossary rules, service configuration, and cutover. |
| `rizzek` | German translator and trusted GitHub/Weblate reviewer. |
| `github-translation-approver` | Weblate service account used only by GitHub Actions; not a human login. |
| Weblate | Generates German suggestions and commits its own `preview` updates. |

Use real name/email accounts for the owner and translator. Public registration
remains closed; an owner provisions accounts and the translator sets a password
through `https://translations.meadtools.com/accounts/reset/`.

## Weblate configuration

Both production components (`default` and `yeast-table`) use the `preview`
branch and Weblate's write-enabled deploy key. GitHub has a `push` webhook to
Weblate, so an update to `preview` is fetched promptly. **Push on commit** is
enabled.

The Automatic Translation add-on is configured per component as follows:

- engine: OpenAI, configured only in Weblate;
- source: English component source;
- mode: **Needs editing** (`fuzzy`), never auto-approved;
- filter: unfinished German strings that are not already marked as automatic;
- threshold: 90; and
- a German-only native Weblate follow-up directly after an English source
  update is recognized as the release batch (the legacy
  `Translation-Batch: weblate-auto` trailer remains supported).

The OpenAI key stays in Weblate's untracked server configuration. It is not a
GitHub Actions secret. The provider uses the project glossary, informal German
style, and German-specific instructions.

Weblate clears its automatic-translation flag when a source string changes, so
the filter selects that changed unit again without reprocessing the existing
automatic-review queue. The temporary `migration-backlog` label excludes the
20 legacy empty German units that need separate human cleanup.

## Feature flow

1. A feature PR adds, changes, or removes English strings under
   `packages/i18n/locales/en/`.
2. Normal PR validation still runs. The feature merges to `preview` even if
   German is pending.
3. The preview deployment/build gate detects the English locale change and
   defers the deploy rather than starting a partial build.
4. The GitHub webhook causes Weblate to update. Its Automatic Translation
   add-on writes German results in the **Needs editing** state and Weblate
   commits and pushes a German-only follow-up to `preview`.
5. The marked Weblate commit releases the single build/deployment containing
   both the feature and the generated German files.
6. GitHub automation creates or updates the shared German review issue, pinned
   to the exact Weblate commit and, when GitHub can resolve it, the source PR.

If Weblate cannot produce or push its update, the preview deployment is held.
That is intentional: investigate Weblate's component/add-on activity before
retrying or bypassing the gate.

## German review flow

The queue issue links to a saved Weblate filter for all German strings below
the approved state. It is assigned to `rizzek` once they accept repository
access; until then it is assigned to `ljreaux`.

### Preferred Git-first corrections

1. Open the exact Weblate commit linked from the queue issue.
2. Branch from current `preview` and edit only the matching German locale file.
3. Open a German-only PR targeting `preview`.
4. When a trusted German-only PR merges, GitHub verifies the changed values are
   current in Weblate and marks only those units approved.

`rizzek` is trusted automatically. The `translations-approved` label is the
maintainer override for another reviewer.

### No-op approval from the review issue

For a batch that needs no changes, `rizzek` or `ljreaux` comments the command
shown on the queue issue, for example:

```
/approve-weblate bd1cdb2
```

GitHub verifies that the commit is a German-only Weblate automatic-translation
batch listed on that exact issue, verifies its values still match Weblate, and
marks only those units approved. It then comments with the result. This does
not create a Git commit or deployment. Reviewing and approving an individual
unit directly in Weblate remains available as well.

For a small correction, editing in Weblate is also allowed; Weblate makes the
follow-up commit to `preview`. The GitHub issue is a queue, not a second source
of truth.

## English-source changes

| English change | German handling |
| --- | --- |
| New string | Weblate adds a German suggestion in Needs editing. |
| Meaningful source update | Weblate resets it for review and produces a new suggestion. |
| Source deletion | Weblate removes the stale German key during synchronization. |

Never bulk-rewrite approved German strings. When glossary guidance changes,
change the Weblate glossary and style instructions, then retranslate only
affected unapproved strings when useful.

## CI and deployment behavior

- normal feature changes without English locale edits build normally;
- a `preview` merge that changes English locale files waits for Weblate; and
- only the recognized Weblate German follow-up releases the web deployment and
  EAS preview builds.

This avoids duplicate builds and prevents the deployed artifact from missing
the generated German files. A German-only review correction after the initial
batch remains a normal translation-only update and does not release a new app
build by itself.

## Cutover validation

- [ ] Confirm `rizzek` can sign in to Weblate and has accepted GitHub access.
- [ ] Verify an OpenAI suggestion uses the glossary and informal German.
- [ ] Clear the old local-only unconfirmed batch and re-enable Weblate push.
- [ ] Merge one real English source change into `preview`.
- [ ] Confirm Weblate writes a needs-review German commit with the marker.
- [ ] Confirm one review issue points to that commit and source PR.
- [ ] Confirm the original preview push is deferred and the Weblate commit
      releases exactly one web/mobile preview build.
- [ ] Test one trusted German-only PR and one no-op issue approval.
- [ ] Confirm the latest approved migration baseline still matches Git.

## Recovery

If a generated batch is wrong, disable the Automatic Translation add-on or the
component push setting, correct the glossary/style, then retry only the
affected unapproved strings. Do not reset approved units during a bulk retry.
Daily encrypted off-site Weblate backups are available for host recovery.
