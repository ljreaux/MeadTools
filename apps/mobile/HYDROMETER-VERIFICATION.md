# Mobile hydrometer verification

Parent: #556. First child: #612 (linked devices and read-only device details).

## Review checkpoints

- #612: reviewed and approved for commit on November 27, 2026.
- #613: readings, history and brew live readings — not started.
- #614: brew linking and lifecycle — not started.
- #615: setup, tokens and device management — not started.
- Parent PR to `preview`: include `- [ ] UI review on iOS and Android before merging`.
  No separate review chat is needed.

## Scope of the first child

Tools has a labeled Devices group with a Hydrometers entry. The account-scoped
list opens read-only device details with the active brew, device ID and saved
calibration coefficients. Open brew uses the existing brew detail screen.

The typed API method validates the existing account contract and returns only
devices. The setup token stays out of the query cache and contract errors.
There are no server route or database schema changes.

## iOS — November 27, 2026

Verified in the existing iPhone 17 Pro simulator (iOS 26.2) against the normal
local backend, through Device Hub:

- Tools → Hydrometers loads the four existing seeded devices, with their active
  brew or no-active-brew status.
- Active Test Hydrometer shows its ID, Active Test Brew and empty calibration
  state. Open brew reaches Active Test Brew; returning to Tools preserves the
  device screen.
- Available Test Hydrometer shows no active brew and no Open brew action.
- An unknown device deep link shows Device unavailable, Refresh and Back to
  hydrometers. The back link returns to the list.
- Temporary query response fixtures verified the empty-device message, 401
  Session expired / Sign in again, and 500 error / Refresh states. No sign-out
  action was taken during the 401 fixture check.
- Removed all fixtures and verified that Refresh and returning to the list
  recover the live devices.

## Android — November 27, 2026

Verified in the existing Medium Phone emulator (Android API 36.1) against the
same local backend. ADB screenshots and input were explicitly authorized:

- Tools → Hydrometers loads the same four existing seeded devices.
- Active device details show the device ID, attached brew and empty calibration
  state; Open brew reaches Active Test Brew.
- An unknown device deep link shows the unavailable-device message and actions.
- Temporary query response fixtures verified empty-device, 401 and 500 screens.
- Removed all fixtures and restored live requests.

The installed development client initially needed a clean app launch and
restored ADB port forwarding. An extra emulator and Android Studio opened while
investigating display access were stopped afterward.

## Automated checks

- Mobile: 112 tests; lint and TypeScript pass.
- API client: 21 tests, including authenticated requests, empty/unassigned devices,
  malformed response token redaction, and 401 propagation; TypeScript passes.
- API contract: 77 tests pass; existing hydrometer schemas are reused.
- i18n: 3 tests pass. Only English source strings changed.
- Preview-profile iOS and Android JavaScript exports pass.

## Data and remaining review

No records were created, changed or deleted. Fixture responses were temporary
and are absent from the delivered changes. Device calibration with populated
coefficients is covered by the API client fixture; the existing local devices
have no saved coefficients.

The final parent PR still needs the requested UI review checkbox completed on
both platforms before merging, including large text, screen-reader navigation,
light/dark appearance and the combined feature flows. An actual offline transport
failure and account-switch interaction have not been manually exercised in this
first child.
