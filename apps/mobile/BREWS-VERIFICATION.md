# Brews verification

Tracking: [#552](https://github.com/ljreaux/MeadTools/issues/552) (Mobile
parity 4: Brews, list and lifecycle). Each child issue is checked on a device
and on the web before its commit. Keep credentials, tokens and account
screenshots out of the evidence.

## Environment — November 20, 2026

- Code: branch `552-mobile-brews` from `preview` at `0baf561`.
- Backend: local development server and database (reset and seeded on
  November 20), the seeded local user account.
- iOS: iPhone 18 Pro Simulator, SDK 57 development client built locally with
  Xcode 27 and connected to Metro. Xcode 27 builds need the UIKit scene life
  cycle, which the generated iOS project does not adopt yet; the local build
  used Expo's `ExpoAppSceneDelegate` in the git-ignored generated project.
- Android: not checked (no emulator on this machine).

## #576 Brew list: completed brews, search and filters

Seeded account: five active brews (two without a linked recipe) and one
completed brew.

| Check | iOS | Web |
| --- | --- | --- |
| Active by default, "5 active brews" | Pass | — |
| Completed: one brew, shows its end date | Pass | — |
| All: six brews, oldest start first | Pass | — |
| Stage and recipe filters ("No linked recipe" shows the two unlinked brews) | Pass | Pass |
| Recipe options unique and sorted by name | Pass | Pass |
| No match: "No brews match" with Clear filters, which resets the list | Pass | — |
| Sort: newest start matches the API's start times | Pass | — |
| Sort by end date: ongoing brews first when newest first, last when oldest first | — | Pass (unchanged) |
| Search "key lime" finds the three Key Lime Pie brews; "complete" finds the completed brew | Pass | Pass |
| Opening a completed brew, then back keeps search, status and sort | Pass | — |
| Largest accessibility text size: cards stack, chips scroll | Pass | — |
| Light and dark appearance | Pass | — |
| Server stopped: cached list and controls stay usable under the error banner; Try again recovers | Pass | — |

Notes:

- With the server stopped the banner reads "Could not load brews" rather than
  "Connection unavailable". This comes from the existing error handling, not
  this change.
- Tests: brew-domain 45, Mobile 106, web 263, i18n 3. Typechecks and lint on
  the changed files.
