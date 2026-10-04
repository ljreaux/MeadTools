# Release artifact drafts

Public dated entries live under `releaseNotes.entries` in
`packages/i18n/locales/en/default.json`; see `docs/monthly-release-notes.md`.
Once the actual production date and shipped product scope are verified, run:

```sh
npm run release-notes:check
npm run release:drafts -- YYYY-MM-DD
```

The second command writes `release-drafts/YYYY-MM-DD/github-release.md` plus
one text email draft per **shipped** product. `release-drafts/` is ignored by
Git. It suggests the calendar tag `release-YYYY-MM-DD`, but creates no tag or
GitHub Release and sends no email. Review the generated Markdown against the
deployed SHA before using it for a GitHub Release draft. Email drafts include
unsubscribe and postal-address placeholders; they cannot be sent as-is.

The explicit `mobilePreview` section may describe progress in the site and
GitHub notes, but does not generate a Mobile subscriber email. A month with no
shipped product fails draft generation; record the no-change decision instead.
For the first full preview promotion, keep the working content in
`docs/releases/initial-promotion-draft.md` until production deployment is
verified and a real date can replace the draft's snapshot.
