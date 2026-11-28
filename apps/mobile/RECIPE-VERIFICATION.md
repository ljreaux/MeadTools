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

## Nutrients, stabilizers, additives, and notes ([#597](https://github.com/ljreaux/MeadTools/issues/597))

November 25, 2026. Used the native Expo development client on iPhone 18 Pro
Simulator (iOS 27.0) and the existing local database. No new test records were
needed.

| Check | Result |
| --- | --- |
| Key Lime Pie nutrient plan | Pass. Mobile and the web report showed three TOSNA additions of 4.62 g Fermaid O each, 13.86 g total, and 0 ppm remaining YAN. Both also showed the same yeast and Go-Ferm quantities. |
| Key Lime Pie stabilizers, additives, and notes | Pass. The sulfite, Campden alternative, and sorbate quantities matched, as did all five additives and the separate primary and secondary notes. |
| Empty sections | Pass. Mead Wiki Simple Trad Metric omitted empty additive and secondary notes sections. |
| Android device or emulator | Pending a later Android pass. |

The initial web report showed zero nutrient additions because it captured the
plan before automatic fields had synced. The report now resolves the same
effective inputs as Mobile. A regression test covers automatic calculation
and preserves a manually selected zero dose.

## Recipe covers ([#598](https://github.com/ljreaux/MeadTools/issues/598))

November 25, 2026. Used the iPhone 18 Pro Simulator (iOS 27.0), the existing
local test account and database, and a loopback fixture for the cover metadata
and image response. Local object storage was unavailable.

| Check | Result |
| --- | --- |
| Owned private recipe with a cover | Pass with fixture. Metric Traditional Test displayed its image above the estimates. The fixture checked recipe ownership against the local backend. |
| Failed cover download | Pass with fixture. Key Lime Pie displayed a retry action and kept its recipe details readable. Retry requested a fresh image URL. |
| Recipe without a cover | Pass. Mead Wiki Simple Trad Metric showed its estimates immediately after its visibility label. |
| Real object storage and Android device | Pending. |

The fixture wrote no recipes or images to the local database or object storage.

## Premium recipe costs ([#599](https://github.com/ljreaux/MeadTools/issues/599))

November 25, 2026. Used the iPhone 18 Pro Simulator (iOS 27.0), the existing
local test account, and the local development database. The test account
lacked Premium access. To inspect the Premium view, a temporary loopback
fixture changed only the access flag in the existing web API response.

| Check | Result |
| --- | --- |
| Account without Premium | Pass. Key Lime Pie showed the Premium message and hid prices, even though the web service returned priced data. |
| Complete estimate | Pass with fixture. Key Lime Pie showed $77.81, $3.71 per liter, and $14.05 per US gallon, matching the web service. |
| Incomplete estimate | Pass with fixture. Metric Traditional Test showed a $22.26 partial total and explained that some ingredients had no price or match. The web service returned the same total and completeness. |
| Active Premium account and Android device | Pending. |

The fixture wrote no stock, recipes, or billing data.

## View, print, and share ([#600](https://github.com/ljreaux/MeadTools/issues/600))

November 25, 2026. Rebuilt the iPhone 18 Pro Simulator development client
(iOS 27.0) with the native PDF viewer and Expo Print and Sharing. Used the existing local account and
database.

| Check | Result |
| --- | --- |
| Saved recipe PDF | Pass. Rendered both pages of Metric Traditional Test. The report used the web layout, with separate fermentation and backsweetened gravities, ingredients grouped by stage, nutrients, stabilizers, additives, and notes. |
| Owner-only access | Pass. The endpoint returned the PDF to the owner, 404 to a different account, and 401 without authentication. The recipe remained private. |
| In-app PDF viewer | Pass. View PDF opened both pages. Scrolling reached the secondary ingredients and notes, double-tap zoomed the page, and Close returned to the three recipe actions. |
| Native print | Pass. Print opened the iOS sheet with both pages visible. Dismissing it returned to the recipe and restored both actions without an error. No printer was selected. |
| Native share | Pass. The iOS share sheet identified the 49 KB PDF by its filename and showed a page preview. Dismissing it restored both actions. No share destination was selected. |
| iOS and Android JavaScript exports | Pass. |
| Android device and hosted Preview | Pending. |

## Android pass

November 27, 2026. Used a rebuilt native debug client (`expo run:android`) on
the Medium Phone API 36.1 emulator, with Metro started with a clean cache. All
checks used the real local backend, the existing signed-in test account, and
the normal local development database. No fixtures were used.

| Check | Result |
| --- | --- |
| Recipe list | Fixed, then pass. The list was blank on Android: the header rendered, `/api/auth/account-info` returned the recipes, and the rows were laid out but detached. FlatList's default Android `removeClippedSubviews` dropped every row beneath the sticky search header. The list now sets `removeClippedSubviews={false}`. Reverting only that line made the list blank again on a fresh launch; restoring it showed all six recipes. |
| Search, sort, and detail | Pass. Searching `lime` showed "1 of 6 recipes" and Key Lime Pie. A–Z ordered the six recipes by name. Opening Key Lime Pie matched the iOS and web values: OG 1.056, fermentation FG target 0.996, ABV 7.12%, estimated finished gravity 1.011, bottling volume 5.536 gal, and the same primary and secondary ingredients. |
| Nutrients, stabilizers, additives, and notes | Pass. Three TOSNA additions of 4.62 g Fermaid O (13.86 g), 10.02 g Lalvin ICV D47, 12.52 g Go-Ferm with 250.5 mL water, 0 PPM remaining YAN, 1.838 g k-meta or 3.691 Campden tablets, 6.203 g k-sorb, all five additives, and both note sections. |
| Offline recovery | Pass. In airplane mode, pulling to refresh showed the connection error and Try again. After reconnecting, Try again restored the list and kept the A–Z sort. |
| Account without Premium | Pass. Both recipes showed the Premium message instead of prices. |
| Active Premium account | Pass with a temporary manual membership (`local-601-premium-cost-check`) on the test account, removed after testing. Key Lime Pie showed $77.81, complete, $3.71 per liter and $14.05 per US gallon. Metric Traditional Test showed a $22.26 incomplete estimate, $5.28 per liter and $19.97 per US gallon. These match the earlier iOS fixture results, this time from the real cost service. |
| Owned private recipe PDF | Pass. Metric Traditional Test (private) fetched `/api/recipes/6/pdf?locale=en` and rendered both pages with separate fermentation and backsweetened gravities. Scrolling reached the secondary ingredients, additives, and notes. A double tap zoomed into the page. Close returned to the recipe. |
| Native share | Pass. The Android share sheet listed `metric-traditional-test.pdf` as one file. Back dismissed it without choosing a destination. |
| Native print | Pass. The Android print preview showed both pages. Back cancelled without printing and returned to the recipe with no error. |
| PDF action accessibility | Fixed, then pass. After any action finished, Android kept "busy" as the button description, so TalkBack would no longer read the button name. The buttons now have explicit labels. After a fresh view and share, the descriptions read View PDF, Share PDF, and Print recipe. |
| Recipe cover with real storage | Pass. With approval, a test PNG (577 × 319) was uploaded through the local web Recipe Builder as the cover of Metric Traditional Test (private). It was stored in the non-production bucket's `development/` namespace and is kept as a test record. The temporary Premium membership was briefly restored to allow the upload, then deleted. On Android, the recipe showed the image above the PDF actions after the owner cover and image-access requests. |
| Cover recovery | Pass. Opening the recipe in airplane mode showed the connection error and Try again. After reconnecting, Try again loaded the details and the cover from real storage. A failed image download with working API requests could not be produced on the emulator: with Private DNS pointed at an invalid host, the storage host failed to resolve from the shell, but the app still displayed the image. The settings were restored. The iOS fixture check above covers the download-failure retry card. |
| Recipe without a cover | Pass. Both recipes went from visibility straight to estimates. |

Mobile tests (119) and the Mobile typecheck passed with both fixes.
