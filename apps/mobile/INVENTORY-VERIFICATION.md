# Mobile inventory verification

## Stock overview and adjustments (#607) · November 26, 2026

| Check | Result |
| --- | --- |
| iOS runtime | Passed on the iPhone 18 Pro simulator (iOS 27.0) with the existing Premium test account and local backend. Created 2.5 kg of stock, recorded 0.5 kg of use and a 1 kg receipt, corrected the balance to 2.75 kg, edited the name, and linked the Honey catalog entry. Checked the balance and history, then confirmed archival on a separate zero-balance item. |
| Local database | The retained **Mobile QA 607 Orange Blossom Honey (edited)** row has 2.75 kg and four adjustments. **Mobile QA 607 Archive Check** is retained as an archived row and is absent from the active list. |
| Android | The preview-profile JavaScript export passed. Runtime verification remains pending because no local Android SDK or emulator was available. |
| Remaining device checks | Free and expired account screens, reconciliation of flagged stock, stale balance handling, and retry after a lost response. The draft tests verify that changes carry the reviewed balance and that reconciliation requires the reviewed revision. |

The test records remain in the normal local development database.

## Finished meads and organization (#608) · November 26, 2026

| Check | Result |
| --- | --- |
| iOS runtime | On the iPhone 18 Pro simulator (iOS 27.0), created **Mobile QA 608 Orchard Mead** with four 750 mL bottles and added two more in the same size. Verified the count and receipt history. Created **Mobile QA 608 Aging** and assigned it to the mead. Created **Mobile QA 608 Cellar** with **Mobile QA 608 Shelf** nested inside it and saved two bottles at position **A1**. |
| Local database | Confirmed six bottles on hand, two stored at A1, the assigned category, and a recorded movement event. The test mead, category, and locations remain in the normal local database. |
| Android | Preview-profile JavaScript export passed. Runtime verification remains pending because no local Android SDK or emulator was available. |
| Remaining device checks | Movement history rendering, archived locations and finished meads, adjustments against a selected storage position, expired Premium, and retries after a lost response. Automated checks cover bottle sizes and counts, allocation limits, nesting rules, and the revision and operation IDs sent to the server. |

## Equipment and vessel assignments (#609) · November 26, 2026

| Check | Result |
| --- | --- |
| iOS runtime | The Equipment screen opened on the iPhone 18 Pro simulator (iOS 27.0) and displayed existing equipment from the local Premium account. The simulator window could not be controlled through Device Hub, so creating, editing, assigning, reassigning, releasing and archiving equipment remain pending on device. No test records were created. |
| Automated | Mobile tests cover optional capacity, grouped quantity and the reviewed assignment sent when a container is assigned, reassigned or released. API client tests confirm the existing routes and preservation of the server's assignment conflict. |
| Android | Preview-profile JavaScript export passed. Runtime verification remains pending because no local Android SDK or emulator was available. |

## Costs and currency (#610) · November 26, 2026

| Check | Result |
| --- | --- |
| iOS runtime | The iPhone 18 Pro simulator (iOS 27.0) loaded the local account's USD currency and Water exclusion. Key Lime Juice displayed its recorded USD 0.1838 per US fl oz average and price history. The Key Lime Pie recipe displayed a USD 77.81 estimate with Water excluded. The brew view loaded the recorded-usage empty state for a brew without deductions. |
| Automated | Tests cover blank versus zero prices, receipt and valuation payloads, currency validation on native engines without `Intl.supportedValuesOf`, owner-only cost summaries, separate mixed-currency totals, and cost exclusion routes. |
| Android | The preview-profile JavaScript export passed. Runtime verification remains pending because no local Android SDK or emulator was available. |
| Remaining device checks | Changing currency, saving receipts and valuations, editing exclusions, and checking totals for a brew with recorded uses. Device Hub did not expose a controllable simulator window. No local data was changed for this slice. |

## Android pass · November 27, 2026

Tested at `6f5cedf8` on the Medium Phone API 36.1 emulator with a native debug
client, Metro started with a clean cache, the local web server, and the
existing test account in the normal local database. All checks used the real
local backend. The account had no Premium membership, so a temporary manual
membership (`local-601-premium-cost-check`) was added for these checks and
deleted afterward.

The **Mobile QA 607** and **Mobile QA 608** records listed above were no longer
in the local database at the start of this pass. The only finished mead was
**House traditional**. This pass did not remove them.

| Area | Result |
| --- | --- |
| Stock create | Pass. Created **Mobile QA 611 Android Clover Honey**: 2.5 kg, linked to the Honey catalog entry, priced at USD 30 total. The list showed USD 12.00 per kg. |
| Use, receipt, correction, edit | Pass. A 0.5 kg use with a note left 2 kg. A 1 kg receipt at USD 15 gave 3 kg at USD 13.00 per kg, the correct weighted average. A correction to 2.75 kg recorded −0.25 kg. Renaming added “(edited)”. History and price history listed each change. |
| Stale balance | Pass. With the Android correction form open at 2.75 kg, the local web app recorded a 0.25 kg use on the same item. Saving the Android correction returned 409 `STALE_STOCK`. The form closed, the balance reloaded to 2.5 kg, the app explained that the stock had changed, and the correction was not applied. |
| Lost-response retry | Pass. The web server process was paused, a 0.1 kg use was saved on Android, and airplane mode was enabled. The app reported that the save could not be confirmed and offered Try again. The resumed server applied the buffered request (200) while the client was offline. After reconnecting, Try again sent the same operation (200) without applying it twice. The database still held 2.4 kg and six adjustments. |
| Stock archive | Pass. Cancel kept **Mobile QA 611 Android Archive Check** (0 kg). Confirming archived it and removed it from the active list (33 → 32 items). Wording note: the dialog title says “Remove stock?” while its button says “Archive stock”. |
| Finished meads | Pass. Created **Mobile QA 611 Android Orchard Mead** with four 750 mL and two 375 mL bottles (6 bottles, 3.75 L). Adding two 750 mL bottles gave six of that size, recorded in history. |
| Categories and storage | Pass. Created **Mobile QA 611 Android Aging** and assigned it to the mead. Created **Mobile QA 611 Android Cellar** with **Mobile QA 611 Android Shelf** nested inside it, then stored two 750 mL bottles at **A1** (four unlocated). |
| Movement history | Pass. The Organize history listed the storage move to Shelf · A1 with 2 units and the recorded quantity. |
| Selected storage position | Pass. Using one 750 mL bottle with Take from set to Shelf · A1 left five bottles. The database allocation at A1 dropped to 1. |
| Archived location and mead | Pass. **Mobile QA 611 Android Archive Spot** was archived after its warning dialog and hidden from the list. **Mobile QA 611 Android Archive Mead** (one bottle) was archived after its confirmation dialog, hidden from Finished meads, and kept in the database with its bottle count. |
| Equipment | Pass. Created **Mobile QA 611 Android Carboy** (container, 23 L), then edited the quantity owned from 1 to 2. Container 1 was assigned to Active Test Brew, reassigned to Unlinked Test Brew after the release notice, and released. The database recorded three assignment events. Removing Container 2 archived that item, leaving 1 available of 1. |
| Currency | Pass. Changed to EUR: the list said “Prices in EUR”, and existing USD prices stayed in USD. Changed back to USD, the original setting. |
| Exclusions | Pass. On the Key Lime Pie estimate (USD 77.81, Water excluded), Never track cost on Key Lime Juice changed the total to USD 71.93 with two excluded lines. Track cost restored USD 77.81 and one excluded line. |
| Valuation | Pass. Set unit cost of USD 7 for 500 g on the QA honey changed the average from USD 13.00 to USD 14.00 per kg, as recorded in price history. |
| Brew total with recorded use | Pass. A 200 g addition on Active Test Brew deducted 0.2 kg from the QA honey at USD 14.00 per kg. Ingredient costs showed USD 2.80, complete, attributed to that stock. |
| Expired and free access | Pass. With the membership expired, and again with it revoked, the Inventory tab showed “Premium access required” and “Inventory is available with Premium.” |
| Display note | The inventory cost views show unrounded volumes (“20.957506 L”, “18.92706 L”). The recipe detail rounds to 20.958 L. |
| Not checked | Reconciliation of flagged stock (no flagged item on this account) and the iOS equipment and pricing mutations below. |

Records kept in the local database: the QA honey (2.2 kg after the brew deduction), the
Orchard Mead, the Aging category, the Cellar and Shelf locations, the carboy,
and the archived Archive Check, Archive Spot, Archive Mead and Container 2. Active Test
Brew has a new Clover honey 200 g addition entry, and the QA honey has a web
0.25 kg use labeled “Web stale-balance check”.

Mobile tests (127) passed on this branch. This pass changed no code.

The iOS equipment and pricing mutations remain pending. Simulator control was
unavailable in this session.
