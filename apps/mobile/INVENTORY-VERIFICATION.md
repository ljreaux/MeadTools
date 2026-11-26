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
