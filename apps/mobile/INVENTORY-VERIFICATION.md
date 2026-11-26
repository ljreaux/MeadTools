# Mobile inventory verification

## Stock overview and adjustments (#607) · November 26, 2026

| Check | Result |
| --- | --- |
| iOS runtime | Passed on the iPhone 18 Pro simulator (iOS 27.0) with the existing Premium test account and local backend. Created 2.5 kg of stock, recorded 0.5 kg of use and a 1 kg receipt, corrected the balance to 2.75 kg, edited the name, and linked the Honey catalog entry. Checked the balance and history, then confirmed archival on a separate zero-balance item. |
| Local database | The retained **Mobile QA 607 Orange Blossom Honey (edited)** row has 2.75 kg and four adjustments. **Mobile QA 607 Archive Check** is retained as an archived row and is absent from the active list. |
| Android | The preview-profile JavaScript export passed. Runtime verification remains pending because no local Android SDK or emulator was available. |
| Remaining device checks | Free and expired account screens, reconciliation of flagged stock, stale balance handling, and retry after a lost response. The draft tests verify that changes carry the reviewed balance and that reconciliation requires the reviewed revision. |

The test records remain in the normal local development database.
