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

## #578 Brew settings

Brew "Settings Test Lime" (seeded user; started on Mobile as "Simulator Key
Lime", linked to the public Key Lime Pie recipe) and "Unlinked Test Brew".

| Check | iOS | Web |
| --- | --- | --- |
| Brew settings opens with the saved name, batch, start date, alerts and visibility; Save stays disabled until something changes | Pass | — |
| Batch "0" shows "Enter a whole number of 1 or more…" and keeps Save disabled | Pass | Pass (unchanged toast) |
| Name, batch 7, start Nov 9 (time of day kept), email alerts on and public on save together; the database and the web page show the same values | Pass | Pass |
| The web batch editor saves 8 through the shared parser; Mobile shows 8 after reopening | Pass | Pass |
| A brew without a public recipe: visibility switch disabled with "Make the recipe public before sharing this brew." | Pass | Pass (unchanged) |
| Server stopped: "The settings could not be saved. Check your connection…", nothing saved | Pass | — |
| Opening another brew's settings by link starts from that brew's saved values | Pass | — |
| Light and dark appearance, including the native date picker | Pass | — |

Notes:

- The start date uses SwiftUI's date and time picker on iOS (Expo UI). Android
  shows the date and time as two buttons that open Material's date and time
  dialogs; that path is typechecked and its day/time helpers are tested, but
  not run on a device (no emulator on this machine).
- The picker works in minutes, so saving a changed start date sets seconds to
  zero, as the web's date-time field does.
- `PATCH /brews/{brew_id}` already accepted `batch_number` and `start_date`
  from the web; the contract and OpenAPI now document them (reviewed hash
  updated, see `docs/domain/api-contract.md`).
- Connection messages now come from a `ConnectionError` thrown by the Mobile
  fetch transport only. Before this, any non-API error counted, so a Metro
  module-resolution error during development showed "Check your connection".
- Development note: after adding a new subpath export to a workspace package,
  restart Metro; it keeps the old `exports` map and cannot resolve the import.
- Tests: brew-domain 53, API client 16, API contract 77, Mobile 109, i18n 3,
  web typecheck. Typechecks and lint on the changed files (the web brew page's
  5 existing lint warnings are unchanged).

## #579 Recipe snapshot and delete

Recipe snapshot checks used "Settings Test Lime" (Key Lime Pie). The recipe's
FG target was changed through the API to make the snapshot differ, and set back
to the seeded 0.996 afterwards.

| Check | iOS | Web |
| --- | --- | --- |
| The brew's Recipe card shows the snapshot date; "This brew uses the current saved recipe." when nothing changed | Pass | Pass |
| After the recipe's FG target changes: "Update recipe snapshot", and the confirm screen lists only "Final gravity target" | Pass | Pass |
| Updating replaces the snapshot (FG 0.998, new date) and keeps the old one in its history; both apps then say it's current | Pass | Pass |
| The recipe changes again while the confirm screen is open: "The recipe or the snapshot changed…", nothing saved; trying again applies the newest recipe (FG 0.995) | Pass | — |
| Delete asks for confirmation, names the brew and says it cannot be undone | Pass | — |
| With an unsent entry on the device, the confirmation says it will also be removed; after deleting, that entry is never sent | Pass | — |
| Server stopped: "The brew could not be deleted. Check your connection…", brew kept | Pass | — |
| Deleting from the brew's settings returns to the Brews list (no back button to the deleted brew) and the list drops it | Pass | — |

Records: "Rapsberry Cheesecake", "Delete test brew" and "Delete test brew 2"
were deleted from Mobile. "Settings Test Lime" was left with a pending
snapshot update (snapshot FG 0.995, recipe back to 0.996) so the update action
can be seen on both apps.

Notes:

- The first snapshot check listed "Nutrients and yeast" as changed when only
  the FG target had. The API contract's recipe parse normalizes nutrient
  settings (numeric YAN contributions become strings, a missing
  `usesOrganicMultiplier` becomes `false`), so a parsed recipe never matches a
  snapshot of the same plan. `getRecipe` now validates the response but returns
  `dataV2` exactly as stored; an API client test covers it with the seeded
  recipe's plan.
- The first delete pushed a second Brews list on top of the deleted brew's
  screen (`dismissTo` ran against the modal's root stack). The modal now closes
  first, then returns to the list in the Brews stack, and the deleted brew's
  cache is cleared after the transition so its screen does not refetch it.
- The snapshot comparison (`recipeSnapshotContentKey`, changed sections and the
  "can update" rule) moved from the web app into
  `@meadtools/brew-domain/recipe-snapshot-diff`. The server's snapshot update
  check, the web dialog and Mobile all use it; its two web tests moved with it.
- Tests: brew-domain 57, API client 17, API contract 77, Mobile 110, i18n 3,
  web 261 (two tests moved to brew-domain), web typecheck and lint on the
  changed files.
