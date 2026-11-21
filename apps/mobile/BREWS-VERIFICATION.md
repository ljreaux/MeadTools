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

- With the server stopped the banner read "Could not load brews" rather than
  "Connection unavailable": `expo/fetch` reports connection failures as its own
  `FetchError`, and the list and detail screens only recognised `TypeError`.
  Fixed during #577 (see below); both screens now show "Connection
  unavailable".
- Tests: brew-domain 45, Mobile 106, web 263, i18n 3. Typechecks and lint on
  the changed files.

## #577 Start a brew from a recipe

| Check | iOS | Web |
| --- | --- | --- |
| New Brew lists the account's recipes, in the same order as the web | Pass | Pass |
| Recipe search is fuzzy ("rasberry" finds "Rapsberry Cheesecake") | Pass | — |
| The confirm step prefills the recipe name; a renamed brew keeps the typed name | Pass | — |
| A blank name uses the recipe name ("Key Lime Pie") | — | Pass |
| Start opens the new brew; the list refreshes with it | Pass | Pass |
| Same recipe on both: Mobile brew Batch 1, then the web brew Batch 2; both Planned with a recipe snapshot | Pass | Pass |
| Server stopped: "The brew could not be started. Check your connection…", nothing created, stays on the step | Pass | — |
| A quick double tap on Start creates one brew | Pass | — |
| Brew list and detail with the server stopped show "Connection unavailable"; Try again recovers | Pass | — |

Records kept for inspection (seeded user): "Simulator Key Lime" and
"Rapsberry Cheesecake" started on Mobile, "Key Lime Pie" started on the web.
The test account also has "Contract check brew", created through the API to
capture the response shape.

Notes:

- In development builds the Expo dev-tools button sits over the right end of
  the New Brew button and catches taps there; release builds have no such
  overlay.
- The web New Brew page now uses the shared blank-name rule with no change in
  behavior.
- Tests: brew-domain 47, API client 15, Mobile 107, web typecheck. Typechecks
  and lint on the changed files.
