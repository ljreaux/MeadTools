# Website release notes

The public archive is `/release-notes`, with a permanent `/release-notes/YYYY-MM-DD`
page for each dated release. It also links the preserved 4.0 and 3.5 notes.

Add a release under `releaseNotes.entries` in
`packages/i18n/locales/en/default.json`. The key is the **actual verified
production release date** in `YYYY-MM-DD` form. Each entry has a `title`, a
`summary`, and a `products` object. Include only relevant product keys:
`web`, `mobile`, `chat`, and `api`. Each product has a nonempty `items` array.
Use `mobilePreview` solely for clearly labeled preview progress when Mobile
source reaches `main` without a production Mobile release; it does not count
as a shipped Mobile product or trigger Mobile subscriber email.

Example shape (illustrative, not an announcement):

```json
"2026-11-02": {
  "title": "November 2026",
  "summary": "A short overview of changes available to users.",
  "products": {
    "web": { "items": ["A verified Web change."] },
    "api": { "items": ["A verified API change."] }
  }
}
```

Run `npm run release-notes:check` before opening the PR. English source changes
merge to `preview` first, then Weblate supplies German in a separate commit for
human review; follow `docs/translation-workflow.md`. Do not directly edit the
German file to make a release. The site uses the English fallback while a
translation is pending. The 4.0 and 3.5 legacy MDX copy remains English only.

Do not add a dated entry to the public locale file during preparation if its
date or availability is still uncertain. Keep the draft in the release checklist
until the production candidate and actual date are known. If nothing shipped,
record no change internally and add no dated entry, GitHub Release, or email.
For the initial full `preview` to `main` promotion, verify its production date
and shipped product scope before publishing the dated notes. Review the complete
diff even when the Mobile production build is skipped.
