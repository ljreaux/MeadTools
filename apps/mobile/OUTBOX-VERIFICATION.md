# Gravity outbox verification

Tracking: [#446](https://github.com/ljreaux/MeadTools/issues/446) (parent
[#443](https://github.com/ljreaux/MeadTools/issues/443)). This records checks of
the durable outbox from #444 using development builds and the development-only
outbox panel on brew detail. The user-facing entry flow (#445) is not built yet,
so #446 remains open. Do not put credentials, tokens, account screenshots or
backend responses in this document.

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
| Bottling/packaging with inventory selection | Not built — remains on the web | — |

## Findings

- Typing into the iOS Simulator while no field has focus triggers dev-client shortcuts (`r` reloads, `d` opens the dev menu). Automated checks must confirm focus before typing letters.

- #522 added an `expo-network` listener, so queued entries replay as soon as the device reports connectivity (4–7 s on the Android emulator) instead of waiting for retry backoff.
- The Expo development tools button can cover the brew list's Logout button
  when the list is empty. This affects development builds only.
- The sign-in email field has autocorrect enabled, which can alter addresses.
