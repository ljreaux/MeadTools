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
  the app, so cold-start links were checked on local Release builds instead
  (see "Release builds" below): both pass.
- During one Android Fast Refresh, after a layout file changed, the app
  closed without a crash log. It did not happen again after relaunching.

## Accessibility and long lists (#564) — November 15, 2026

Environment: as for #562, with the #562 and #563 commits applied. Screen
reader output on Android was read from the accessibility tree
(`uiautomator dump`), which is what TalkBack announces. Dynamic type was
checked at the largest iOS accessibility size
(`accessibility-extra-extra-extra-large`).

| Check | iOS Simulator | Android emulator |
| --- | --- | --- |
| Brew list cards announce name, stage, recipe, volume and entry count (previously only "Open <name>") | Not run with VoiceOver | Pass |
| Each timeline entry is one focusable item with its full summary; local entries keep Retry and Discard reachable | Not run with VoiceOver | Pass |
| Tabs, headers, radios, checkboxes and switches expose roles, labels and checked state | Code review (already in place) | Pass (tabs and rows in tree) |
| Largest text size: brew list name no longer squeezed beside the stage pill (stacks below it) | Pass after fix | Not run |
| Largest text size: brew detail, overview, timeline and add-entry wrap without clipping | Pass | Not run |
| Error text contrast (was about 1.5:1 in both themes) | Pass (dark, light red) | Pass (light, dark red) |
| Light-mode muted text, borders and status marks on honey meet 4.5:1 / 3:1 | Not run (dark only) | Pass |
| Placeholders read as hints, distinct from entered values | Pass | Pass |
| Brew list and timeline stay virtualized (`FlatList`, stable keys); timeline separators no longer remount every render | Code review | Code review |

Notes:

- Contrast ratios for every native semantic color pair are enforced by
  `packages/design-tokens/test/tokens.test.ts`; the web's CSS colors are
  unchanged.
- A live text-size change does not relayout an open screen until the app is
  relaunched (the text grows but layout is stale). This is React Native
  behavior in the dev client and was not changed here.
- Long lists were measured on local Release builds (see below).

## Release builds: cold-start deep links and long timelines — November 15, 2026

Local Release builds, no EAS: `expo run:ios --configuration Release` and
`expo run:android --variant release` (debug-keystore signed), pointing at the
local API. Android release builds block plain-HTTP traffic, so the local test
build temporarily added a git-ignored `android/app/src/release` manifest
allowing it (removed afterwards; production uses HTTPS). Test data: a local
"Long timeline test brew (600 entries)" (gravity readings and notes over 60
days) under the primary test account. Both dev clients were reinstalled from
their debug builds afterwards.

| Check | iOS Simulator | Android emulator |
| --- | --- | --- |
| App closed; `meadtools://brews/<id>` opens brew detail with the brew list behind it | Pass | Pass (launch 478 ms) |
| App closed; `meadtools://change-stage?...` opens the modal; dismissing it shows the Brews tab | Pass | Pass |
| 600-entry brew opens without a visible delay | Pass | Pass |
| Fast flings through the 600-entry timeline show no blank rows | Pass (to about entry 465) | Pass (to the end) |

Android frame statistics (`dumpsys gfxinfo`, emulator, so absolute numbers
are pessimistic):

| Run | Frames | Janky | 50th / 90th percentile |
| --- | --- | --- | --- |
| 600 entries, 15 downward flings | 692 | 1.6% | 20 / 24 ms |
| 600 entries, alternating up/down mid-list | 648 | 19% | 29 / 48 ms |
| 600 entries, flings into the top edge | 205 | 12% | 27 / 44 ms |
| 26 entries, alternating (two runs) | 171 / 315 | 22% / 25% | 18–22 / 125–150 ms |

List length is not the cost: the short brew is the jankiest. Jank appears
when the scroll direction reverses or a fling hits an edge (rows re-mount and
Android draws the overscroll effect). Check on a real Android phone before
tuning; a streamlined timeline (for example recent entries with "show all")
fits the brew tracker work in #553.
