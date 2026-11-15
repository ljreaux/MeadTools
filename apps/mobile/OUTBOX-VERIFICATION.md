# Gravity outbox verification

Tracking: [#446](https://github.com/ljreaux/MeadTools/issues/446) (parent
[#443](https://github.com/ljreaux/MeadTools/issues/443)). This records local device checks of the durable outbox and the Mobile write
flows. Keep credentials, tokens, account screenshots and raw backend responses
out of the evidence.

## Environment — November 8, 2026

- Code: uncommitted #444 working tree on `preview` at `bdd1ff5c`.
- Backend: local development server and database, local test accounts.
- iOS: iPhone 17 Pro Simulator (iOS 27.0), debug dev client.
- Android: `Medium_Phone_API_36.1` emulator, debug dev client.
- Failure injection: the development panel's `offline` / `lose-response`
  faults on iOS (the Simulator shares the Mac's network), and real emulator
  airplane mode on Android.

## Results

| Check | iOS Simulator | Android emulator |
| --- | --- | --- |
| Online reading syncs once, record retired | Pass | Pass (via reconnect checks) |
| Lost acknowledgement (server commits, client sees failure) retries with the same UUID; one server entry | Pass (retired by server reconciliation without a second upload) | Not run |
| Offline reading persists to disk, survives app termination, syncs once after relaunch with original measurement time | Pass (injected offline) | Pass (real airplane mode) |
| Reconnect while the app stays open, no user action | Not run | Pass: synced 20 s after the network returned, via the retry backoff timer |
| Repeated Replay, Retry and app resume during recovery create no duplicates | Pass | Not run |
| Account switch: another account never sees or uploads the queue; the original account delivers it after signing back in | Pass | Not run |
| Persisted record contains no credentials | Pass | Pass (record stored under the account's own directory) |
| Expired session / server 401 pause and recovery | Not run (unit tested) | Not run |
| Terminal validation, not-found and UUID-conflict errors | Not run (unit tested) | Not run |

## Native gravity entry (#445) — November 8, 2026

| Check | iOS Simulator | Android emulator |
| --- | --- | --- |
| Record gravity opens from brew detail with the brew's unit preference | Pass | Pass |
| Empty and implausible input (`1050` SG) refused with a visible error; nothing queued | Pass | Not run |
| Decimal comma accepted (`21,5` °Bx, `1,008` SG) | Pass | Pass |
| °Bx shows the SG to be saved and states it is not refractometer-corrected | Pass | Not run |
| Offline save shows an immediate local row with an honest status, Retry and Discard | Pass (injected offline) | Pass (real airplane mode) |
| Retry now moves the row to "Waiting to sync"; it syncs once and becomes one server row | Pass | — |
| Reconnect syncs without user action; the row becomes one server row with its original time | — | Pass: 16 s after reconnect |
| Discard asks for confirmation and removes the unsent reading from the device | Pass | Not run |
| Online save syncs immediately with no stale pending copy | Pass | Pass (via reconnect) |
| Dark mode | Pass | Not run |
| Stored request matches the web payload for the same input | Pass (unit tested; record inspected on device) | Pass (record inspected on device) |

## Every entry type (#522) — November 8, 2026

| Check | iOS Simulator | Android emulator |
| --- | --- | --- |
| Add entry offers gravity, temperature, pH, volume, addition, note, tasting and issue | Pass | Pass |
| Gravity roles (reading, OG, FG) and °Bx refractometer correction using the brew's recorded OG; corrected FG synced as 0.992 SG | Pass | Not run |
| Correction toggle reachable by tapping its label while the keyboard is open | Pass (after fix) | Not run |
| Temperature defaults to the device's unit (°F on the US-locale emulator) | Not run | Pass |
| Manual nutrient addition (DAP, 2 g) records without changing inventory | Not run | Pass |
| Empty note refused with a visible error; nothing queued | Not run | Pass |
| Temperature, addition and note queued with real airplane mode, delivered automatically 4–7 s after reconnect via the network listener, each once | — | Pass |
| Gravity records queued by the earlier gravity-only outbox migrate and still deliver | Unit tested | Unit tested |

## Offline-safe stage changes (#520) — November 8–9, 2026

| Check | Local API | iOS Simulator | Android emulator |
| --- | --- | --- | --- |
| Queued change stored under the client UUID at its original time | Pass | Pass (synced as Primary → Secondary at 3:07 PM) | Pass (Primary → Planned at the phone's time) |
| Retry after a lost response replays without a second entry or move | Pass | Unit tested | Unit tested |
| Two concurrent identical requests create one entry | Pass | — | — |
| Stale change (brew moved on the web meanwhile) returns 409 `STAGE_CONFLICT`, server unchanged | Pass | Pass: row shows the conflict with Discard only | Not run |
| Client UUID reused on another brew returns 409 `Entry ID is already in use` | Pass | — | — |
| Stage picker follows the web rules; blocked stages list the unmet prerequisites | — | Pass (Complete blocked without packaging) | Pass |
| Effective stage shown with "Waiting to sync" while a change is queued; syncs after reconnect | — | Pass (injected offline) | Pass (real airplane mode, 3 s after reconnect) |

## Online-only actions (#521, partial) — November 9, 2026

| Check | iOS Simulator | Android emulator |
| --- | --- | --- |
| Tap a saved entry to edit it; value and note changes save and refresh the timeline (gravity 1.050 → 1.048 SG with display metadata) | Pass | Not run |
| Delete with confirmation removes the entry; latest gravity recalculates | Pass | Not run |
| Stage changes edit their note only and cannot be deleted | — | Pass |
| Premium account: addition matched to Wildflower honey stock, balance preview 63 lb, saved online with the web's `items` selection; stock 64 → 63 lb; nothing queued | Pass | Not run |
| Changing the amount of a stock-linked addition is refused by the server (`SELECTION_REQUIRED`); the app shows the inventory message and points to the web review | Pass | Not run |
| Offline: edit/delete disabled with an explanation; additions say stock deduction needs a connection and still queue untracked | — | Pass (real airplane mode) |
| Free account (`can_manage` false): no deduction offered | Unit tested | Unit tested |
| Bottling/packaging with inventory selection | Moved to #531 | Moved to #531 |

## Findings

- Typing into the iOS Simulator while no field has focus triggers dev-client shortcuts (`r` reloads, `d` opens the dev menu). Automated checks must confirm focus before typing letters.

- #522 added an `expo-network` listener, so queued entries replay as soon as the device reports connectivity (4–7 s on the Android emulator) instead of waiting for retry backoff.
- The Expo development tools button can cover the brew list's Logout button
  when the list is empty. This affects development builds only.
- The sign-in email field has autocorrect enabled, which can alter addresses.

## Slice 2 verification — November 9, 2026

- Feature commits: `448b9626` (#532) and `a63200f0` (#531).
- Backend: local development server and database. Both devices used local test
  accounts. Preview was not used for these runs.
- iOS: iPhone 17 Pro Simulator (iOS 26.2), SDK 57 development client.
- Android: `Medium_Phone_API_36.1`, SDK 57 debug development client rebuilt
  with JDK 17 after the earlier binary failed during startup. Android offline
  tests used emulator airplane mode.
- Preview-profile JS exports passed for iOS and Android. Development clients
  were used for device checks.

### Planned additions and bottling

| Check | Result |
| --- | --- |
| Planned ingredient offline → reconnect | Android passed. On **Mead Wiki Simple Trad Metric Equipment Test Brew**, Water showed **Waiting to sync**, then **Logged** automatically. The local server held one entry for the recipe line. The web stage calculation also counted it once. |
| Adjusted planned ingredient with stock deduction | iOS passed. Honey saved as 1.4 kg from a 1.45 kg plan and showed **Logged**. The selected Wildflower honey stock preview went from 63 lb to approximately 59.914 lb. The outbox stayed empty. |
| Manual yeast | iOS passed. A 4 g manual pitch on **Active Test Brew** saved and showed **Logged**. |
| Bottling, packaging stock and new finished output | iOS passed on **Inventory bottling example**. Two 750 mL bottles saved as 1.5 L with two finished bottles. Supply stock went from 48 to 46. Correcting the finished output to one kept the two supply deductions. Reopening verified the saved correction. |
| Tracked removal review | iOS passed for the preview. The review showed the one finished bottle to undo and the supply count that would be restored. The test record was retained. Removal and reconciliation selection rules are covered by deterministic tests. |
| Bottling offline → reconnect | Android passed on **Inventory bottling example**. Airplane mode disabled confirmation and explained the connection requirement. Reconnect allowed one 750 mL bottling. One supply was deducted (46 → 45) with finished tracking off. The local server held both test bottlings with their expected output and supply links. |
| Free/expired packaging, splits, on-hand confirmation, legacy row IDs, online-only guard | Deterministic checks cover untracked payload acceptance, splits, correction/removal selections, and outbox rejection. Free or expired accounts and reconciliation were not exercised on a device in this run. |

### Gravity, recovery and online-only actions

| Check | Result |
| --- | --- |
| SG with note online | iOS recorded 1.042 SG and Android 1.043 SG on **Active Test Brew**. Mobile and the local API showed the values, measurement times and notes. An earlier iOS automated input attempt saved 1.000 SG after 1.041 SG was entered. The recheck saved correctly when field interactions were separate. The initial discrepancy remains recorded here. |
| Offline gravity, full termination and relaunch | Android passed at 1.047 SG. The persisted request kept the same UUID and measurement time across force-stop and offline relaunch. Reconnect produced one server entry at that time and the synced value appeared in Mobile. |
| Server commit followed by a lost response | iOS passed with the development fault. The queue showed a retryable network failure after one attempt. Repeated Replay left the same item with one server copy and the queue retired it. Stable retry identity, repeated foreground/reconnect/manual triggers and account switching also passed deterministic tests. |
| Network/5xx backoff, expired session and terminal validation, ownership and UUID errors | Covered by deterministic outbox tests. Live server fault cases were not repeated on both devices. Account switching is also covered by the earlier iOS device check above. |
| Other brew entry types | Android saved temperature, pH, volume, addition, note, tasting and issue online and again in airplane mode on **Active Test Brew**. After reconnect the server held exactly one copy of each of the fourteen entries. |
| Stage changes | An online iOS move from Planned to Primary on the linked test brew synced once. A subsequent offline move showed **Waiting to sync**. A competing local API move caused the replay to return 409. Mobile showed the conflict with Discard, and the competing server stage was preserved. The failed local row was retained for inspection. Both earlier offline sync checks are recorded in the #520 section. |
| Online-only edits, deletes, stock deduction and bottling | Android airplane-mode checks are recorded above. The older #521 entry edit/delete checks remain applicable. |
| English labels, status and long timeline | Native accessibility trees exposed entry, status, stock, and confirmation labels. Both platforms rendered the long **Active Test Brew** timeline. Android scrolled through older entries during the form checks. German layout remains open until the Weblate follow-up. |
| Web preview parity | Local API values and the shared web stage calculation were checked. The local browser redirected to sign-in, so the signed-in web timeline and stage panels were not checked in this run. See the November 14 section below. |

### Checks

- Mobile tests and typecheck, including a regression for Go-Ferm skip state
  affecting a different planned item.
- Brew domain, inventory domain, API client, API contract and i18n tests.
  Contract and OpenAPI regeneration produced no changes.
- Web typecheck and web tests.
- iOS and Android preview-profile exports.

The local records were retained. **Active Test Brew** has the iOS manual yeast
pitch, the online gravity checks (including the mismatched first iOS attempt),
the Android restart reading, the iOS lost-response reading, and the Android
online/offline entry sweep. **Mead Wiki Simple Trad Metric Equipment Test
Brew** has the Water and Honey recipe additions and stage test moves.
**Inventory bottling example** has the two new packaging records and the
corrected finished-mead output from the iOS record.

## Signed-in web parity — November 14, 2026

- Branch rebased onto `preview`, with the Expo SDK 57 patch releases applied
  (expo 57.0.33, expo-constants 57.0.24, expo-linking 57.0.14, expo-router
  57.0.31). The development clients were not rebuilt for this check.
- The local database had been reset and re-seeded on November 10, after the
  device runs above. None of those records remain, including the second test
  account.
- The entries were therefore rebuilt with the Mobile builders
  (`buildGravityEnqueueInput`, the `entry-forms` builders,
  `buildStageChangeInput`, `buildPlannedAddition`, `buildPackaging`). They were
  sent with a client UUID through `@meadtools/api-client` to the local server,
  then compared in the signed-in local web app. No device UI was involved.

| Check | Result |
| --- | --- |
| Readings and notes | On **Active Test Brew**, the web timeline showed every Mobile entry like a web entry. Gravity 1.042 SG with its note. A refractometer reading as "SG: 1.015 (11.20 Brix) corrected", entered as `11,2` with the recorded OG 1.100. Temperature 19.5 °C, pH 3.6, volume 5 gal (current volume updated to 5 gal), a titled note, tasting, issue and a 50 g manual addition. |
| Stage change, replay and conflict | Primary → Secondary moved the brew once. Resending the same client UUID left one stage-change entry. A stale move expecting Primary returned 409 `STAGE_CONFLICT` with `current_stage: SECONDARY`. The web tracker and stage panel showed Secondary with its normal actions. |
| Packaging | A 4 × 750 mL packaging payload rendered as "Packaging: 3 L - 4 packages" in the Secondary group. It was then deleted through the API client and the brew moved back to Primary. |
| Planned recipe additions | On **Mead Wiki Simple Trad Metric Equipment Test Brew** (moved Planned → Primary), Water and Honey were logged from Mobile's planned rows. The web Primary panel showed **Primary ingredients · 2/2**, both **Logged**, with yeast and **Nutrients · 0/4** open. Mobile's `plannedAdditionRows` reported the same statuses. |

Test records kept in the local database:

- **Active Test Brew** is back in Primary. It has the parity readings, notes,
  addition and two stage changes (Primary → Secondary → Primary).
- **Mead Wiki Simple Trad Metric Equipment Test Brew** is in Primary with Water
  and Honey logged.

## Rebuilt development clients and live failures — November 14, 2026

- Both development clients were rebuilt on the Expo SDK 57 patch releases:
  iOS on the iPhone 17 Pro Simulator, Android on `Medium_Phone_API_36.1`.
  The git-ignored iOS project needed `pod update` for the Expo pods first.
- Backend: a private local web server. A local pass-through proxy sat in front
  of it and could answer entry posts with a real HTTP 503 or 401. Every other
  request went to the server unchanged.
- In development, Expo layers `.env.local` over the process environment at
  runtime. The API URL was therefore set through a temporary, git-ignored
  `.env.development.local`, which was deleted afterwards.
- Account: the main local test account, which has no premium membership.

| Check | Result |
| --- | --- |
| Online reading, iOS and Android | Each platform saved a reading on **Active Test Brew** and the server answered 201 at once: iOS 1.012 SG, Android 1.010 SG. |
| Offline reading and reconnect, Android | In airplane mode, 1.009 SG showed **Offline. It will sync when you are back online.** (network, retryable). After airplane mode was turned off it was delivered automatically. The server held exactly one copy. |
| Live 503, iOS | The card showed **MeadTools is unavailable. It will retry automatically.** Retries came after 5 s, 10 s and 20 s. With the server restored, the 40 s retry delivered it automatically, and the server held one copy. |
| Expired session (401), iOS | The app refreshed its token once (`/api/auth/refresh` 200), retried, got 401 again and stopped. The card showed **Not synced. Sign in again to send it.** and no automatic retries followed. With the session valid again, **Retry now** delivered it once. |
| Terminal error, iOS | A reading was held by a 503 on a throwaway brew. The brew was then deleted, and the next retry got the server's real 404. The record moved to `terminal_failure` (not_found) with **Not saved: this brew is no longer available.** and stopped retrying. **Discard** asked for confirmation and removed it. |
| Free-account packaging, iOS | 6 × 375 mL bottling showed **Packaging will be saved without inventory tracking. Inventory tracking requires Premium.** The 2.25 L packaging entry saved, and no inventory operation was created. Invalid bottle-count text was refused before review. |
| Stage change, Android | Primary → Secondary synced once (one stage-change entry). Cancelling a confirmation sent nothing. |

Findings, both also present on `preview`:

- An expired refresh token makes `/api/auth/refresh` return 500 instead of
  401. Mobile still falls back to the sign-in screen (seen on Android with a
  token that expired in July).
- `scripts/run-mobile-android.mjs` runs `apps/mobile/node_modules/.bin/expo`,
  which does not exist now that Expo is hoisted, so `npm run mobile:android`
  fails. The build here used `../../node_modules/.bin/expo run:android`.

Minor: after a brew is deleted elsewhere, its cached detail page and list row
stay until the list is refreshed.

Test records added: on **Active Test Brew**, the readings above, a 1.050 SG
outbox check, the 2.25 L packaging entry and Primary → Secondary → Primary
stage changes. The throwaway brew was deleted.

## Expired-account packaging — November 14, 2026

- iOS Simulator (iPhone 17 Pro) on the rebuilt development client, against a
  private local web server on port 3000.
- A new local account, `expired@test.com`, was given a `manual` premium
  membership in the local database. While premium was active it created a
  recipe, a brew and two packaging stock items (24 × 750 mL bottles, 24
  corks). The membership's `paid_through` was then moved to the previous day,
  so the account lapsed with real tracked history.

| Check | Result |
| --- | --- |
| Bottling while premium was active | The review offered tracked stock (**750 mL bottles · 24**, 20 after the change). Saving 4 × 750 mL (3 L) deducted the bottles from 24 to 20 and created one bottling record. |
| After expiry | `GET /api/brews/:id/inventory` returned `can_manage: false` with no usages, while the bottling record stayed. |
| New bottling while expired | The review showed **Packaging will be saved without inventory tracking. Inventory tracking requires Premium.** Saving 2 × 750 mL created a 1.5 L packaging entry. Stock stayed at 20; no deduction or bottling record was added. |
| Editing the tracked bottling while expired | The edit form loaded the saved rows. Changing 4 bottles to 3 showed the same untracked review. Saving updated the entry to 2.25 L / 3 bottles. The original 4-bottle deduction was kept (stock stays 20, nothing reversed). The bottling record moved to version 2 with `reconciliation_required`, and the bottle stock was flagged too. Mobile showed **Bottling changes need review**: the source changed while tracking was unavailable, so physical counts need review before relinking. |

Dev-client only: the Expo dev menu's floating gear button covers the top
right of the brew list's **Logout** button on iOS. Taps on its upper part do
nothing; its lower-left part works. Release builds have no gear button.

Test records kept: the `expired@test.com` account (password as in the local
notes) with its expired membership, recipe, brew, stock and the three
packaging changes above.

## Expired-account stock deductions — November 14, 2026

Same account and setup as above. The membership was made active again, a
5 kg **Wildflower honey** stock item was added, and the account was expired
after each tracked save.

| Check | Result |
| --- | --- |
| Tracked addition while premium was active | The Addition form showed **Deduct from inventory** with Wildflower honey (5 kg) selected and the balance after the change. Saving 1 kg deducted the honey to 4 kg. |
| New addition while expired | No stock picker. The form showed **This does not change inventory. Inventory tracking requires Premium.** (this branch's wording; it used to send free users to the web, which also needs Premium). The 500 g entry saved as an ordinary entry with no deduction; stock stayed at 4 kg. |
| Editing a tracked addition while expired | 1 kg → 2 kg saved. The original 1 kg deduction stayed (nothing reversed), and the honey stock was flagged `reconciliation_required`, the same rule as bottling. |
| Deleting a tracked addition while expired | The entry was removed, its deduction stayed, and the stock stayed flagged. |
| Notice after an edit or delete | The first edit and delete showed nothing, so a stock change happened silently. Mobile now shows the web's existing **The brew change was saved without changing the recorded stock. That stock now needs review before new deductions.** whenever the server returns `reconciliation_required` for an entry edit or delete. Rechecked on the device with a second tracked addition (1 g, edited to 2 g, then deleted): the delete showed the notice, the deduction stayed, and the stock stayed flagged. |

The first tracked addition saved with the name "W" although the field showed
"Wildflower honey". Typing through the simulator automation also dropped
" honey" from "Orange blossom honey", and a later name typed the same way
("Honey") saved intact, so this is the known automation keystroke loss, not
an app bug.

Test records kept: the 500 g untracked addition. The 1 kg and 1 g tracked
additions were deleted in the checks above; their deductions remain, and the
Wildflower honey stock (3.999 kg) is flagged for reconciliation.

#446 device checks are complete. The German layout still waits for the
Weblate follow-up.
