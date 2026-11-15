# Platform verification

Tracking: [#550](https://github.com/ljreaux/MeadTools/issues/550). This records
local device checks of the Mobile platform slices. Keep credentials, tokens,
account screenshots and raw backend responses out of the evidence.

## Navigation shell (#562) — November 15, 2026

Environment:

- Code: uncommitted #562 working tree on `9d97e8dd`.
- Backend: local development server and database, local test accounts
  (an expired-Premium account and the primary account).
- iOS: iPhone 17 Pro Simulator (iOS 27.0), dark appearance, debug dev client
  built November 14 (no rebuild needed: native tabs use the bundled
  `react-native-screens`).
- Android: `Medium_Phone_API_36.1` emulator, light appearance, debug dev
  client built November 14.

| Check | iOS Simulator | Android emulator |
| --- | --- | --- |
| App opens to the Brews tab; five tabs (Brews, Recipes, Tools, Inventory, Account) with icons and labels | Pass (Liquid Glass bar) | Pass (Material bar, labeled) |
| Native headers use the MeadTools palette instead of the default white header | Pass | Pass |
| Brew list opens brew detail inside the Brews tab; Back returns to the list | Pass | Pass (header and system Back) |
| Add entry opens as a modal over the tab bar; Cancel or Back returns to brew detail | Pass | Pass |
| Brew detail scrolls its last timeline card clear of the tab bar | Pass | Pass |
| Recipes, Tools and Inventory show the placeholder; no links or purchase prompts | Pass | Pass |
| Account shows the signed-in email and version; Log out returns to sign-in | Pass | Pass |
| Signing in again lands on the Brews tab with that account's brews | Pass | Pass |
| `meadtools://brews` from another tab switches to Brews | Pass | Not run |
| `meadtools://brews/<id>` from the Account tab opens brew detail with the list behind it | Pass | Pass |
| `meadtools://change-stage?...` from the Tools tab opens the modal over the tabs | Pass | Not run |
| Selected tab stays readable in light mode (icon on the indicator pill) | Not run (dark only) | Pass after fix |
| German tab labels | Not run (German strings arrive through Weblate after merge) | Not run |

Notes:

- A cold-start deep link opens the development client's launcher instead of
  the app, so the `anchor` settings that keep the list behind a cold-start
  deep link were not exercised in a dev build. Check them on a preview build.
- During one Android Fast Refresh, after a layout file changed, the app
  closed without a crash log. It did not happen again after relaunching.
