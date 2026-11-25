# Mobile recipe verification

Tracks [#554](https://github.com/ljreaux/MeadTools/issues/554).

## Saved recipe list and detail ([#596](https://github.com/ljreaux/MeadTools/issues/596))

November 25, 2026. Tested the native Expo development client on iPhone 18 Pro
Simulator (iOS 27.0), using an existing test account and the local development
database. Compared the saved Key Lime Pie recipe (ID 2) with its local web
report in the desktop browser.

| Check | Result |
| --- | --- |
| Browse, search, and open a saved recipe | Pass. Searching `lime` reduced the list to Key Lime Pie. Opening it loaded the detail, and Back restored the filtered list. |
| Primary ingredients | Pass. Water 4.33 gal and honey 8 lb matched. |
| Secondary ingredients | Pass. Key lime juice 0.25 gal, honey 1 lb, lime juice 0.1171875 gal, and brown sugar 1 lb matched. The web report rounds lime juice to 0.117 gal. |
| Estimates | Pass. OG 1.056, ABV 7.12%, and bottling volume 5.536 gal matched the web report. |
| Separate gravity values | Pass. Mobile displayed fermentation FG target 0.996 and estimated finished gravity 1.011 as separate fields. |
| Empty account and private recipe | Pass on iPhone 17 Simulator (iOS 27.0). The empty account showed the empty state before the local test copy was saved. The signed-in owner could find and open the copy, Mobile QA #596 — Key Lime Pie (ID 9). |
| Pull-to-refresh and error recovery | A pull gesture was attempted without confirming a fresh request. Offline, expired-session, and unavailable-recipe recovery were not exercised on a device. |
| Android device or emulator | Pending a later Android pass. |

Mobile lint, typecheck, and tests passed (112 tests). The issue records
successful iOS and Android exports.
