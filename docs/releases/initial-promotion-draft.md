# Initial full preview promotion — working draft

This is an internal candidate, **not a published release**. Recompare the
complete `main...preview` diff immediately before the promotion, update the
candidate SHA and product decisions, and verify production deployment and
availability. Use the actual verified production date for the public entry
under `releaseNotes.entries` in `packages/i18n/locales/en/default.json`.

Snapshot assembled October 4, 2026: `main` at
`7ac6f8f0593547123fc0181907b65e5316c86b54`, `preview` at
`660676679537ee421c964a7b9ab040b37cb881ac`. These SHAs are evidence for
this draft only and will be stale after further preview merges.

## Candidate public notes

### Web

- The brew tracker now displays stabilized and backsweetened brews in the
  appropriate bulk-aging workflow while retaining their actual stage.
  Source: the brew-stage changes in the candidate `main...preview` diff.
- Release notes now have a permanent archive and product-separated dated
  entries. Source: [#419](https://github.com/ljreaux/MeadTools/pull/419).
- Signed-in users can opt in to MeadTools product updates by email and change
  that choice in account settings. It is off by default. Sources:
  [#422](https://github.com/ljreaux/MeadTools/pull/422) and
  [#427](https://github.com/ljreaux/MeadTools/pull/427). Include this only
  after the account setting works in production; email sending stays off until
  the verified PO Box address is configured.
- Juice Calc is under Extra Calcs in the desktop navigation. Source:
  [#426](https://github.com/ljreaux/MeadTools/pull/426).

### API and integrations

- An unavailable brew detail now returns a documented `404` response, and
  legacy recipe snapshots remain readable by Mobile clients. Source:
  [#411](https://github.com/ljreaux/MeadTools/pull/411).
- The product-update preference endpoint supports one account-wide opt-in and
  a signed unsubscribe flow. Sources:
  [#422](https://github.com/ljreaux/MeadTools/pull/422) and
  [#423](https://github.com/ljreaux/MeadTools/pull/423), updated by
  [#427](https://github.com/ljreaux/MeadTools/pull/427).

### Mobile preview progress — no production Mobile release

- The preview app can list active brews, show a read-only brew overview, and
  show recent brew timeline activity. Sources:
  [#407](https://github.com/ljreaux/MeadTools/pull/407),
  [#411](https://github.com/ljreaux/MeadTools/pull/411), and
  [#412](https://github.com/ljreaux/MeadTools/pull/412).
- Preview launch and native dependency fixes support device testing. Sources:
  [#408](https://github.com/ljreaux/MeadTools/pull/408),
  [#409](https://github.com/ljreaux/MeadTools/pull/409), and
  [#410](https://github.com/ljreaux/MeadTools/pull/410).
- **No production Mobile build or app-store release is included.** The
  `build-mobile-production` label must be absent, and the disabled main-push
  EAS trigger in [#418](https://github.com/ljreaux/MeadTools/pull/418) must be
  verified before promotion. Send no Mobile release email for this section.

### Chat assistant

No candidate user-facing Chat release change in this snapshot. Omit this
section from public notes unless the final reviewed diff changes that.

## Promotion checks still needed

- Review the final full `main...preview` diff and linked PRs, including Mobile
  source that will land on `main` with its production build skipped.
- Confirm Web/API/Chat behavior in the deployed production SHA before making
  availability claims. Verify the release email migration and subscription
  controls before mentioning them.
- Confirm `main` note and release gate checks are required and tested, or use
  the explicitly reviewed initial-promotion path documented in
  `docs/monthly-release-gate.md`. Record exact head/base SHAs and Mobile
  run/skip in the promotion PR.
- Draft the dated site entry and matching GitHub Release only after the real
  production date is known. The production cron will compose one combined
  product-update email from that published entry. Do not enable subscriber
  sending until the sender, PO Box address, unsubscribe flow, and duplicate
  protection have been verified.
- If the next first Monday brings no further shipped work, record a no-change
  cycle instead of repeating this initial announcement.
