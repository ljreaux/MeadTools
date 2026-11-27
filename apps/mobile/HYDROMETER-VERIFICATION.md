# Mobile hydrometer verification

Parent: #556. First child: #612 (linked devices and read-only device details).

## Review checkpoints

- #612: reviewed and approved for commit on November 27, 2026.
- #613: reviewed and approved for commit on November 27, 2026.
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

## #613 — readings, history and charts

Reviewed and approved for commit on November 27, 2026. Existing HTTP routes, authentication,
Prisma queries and API contracts are unchanged. The only web edit replaces the
local wireless-series builder with its shared brew-domain implementation.

### Chart design and reuse by #591

- `src/charts/time-series-chart.tsx` exports `TimeSeriesChart` and `TimeSeries`.
  Pass series with stable keys, labels, units, colors and `{ date, value }`
  samples. Gravity and temperature are visible together by default for
  hydrometer charts; each series can be toggled independently.
- All series share elapsed time on the x-axis. The first two visible series
  have labeled left/right y-axes. Additional series expose their axis ranges
  with their summaries. Every line keeps its own numeric scale.
- The optional `markers` prop accepts `{ date, label }` for #591's OG/FG markers.
  No manual-entry chart is implemented here; #591 can reuse this renderer.
- `@meadtools/brew-domain/hydrometer` shares calibrated-gravity selection,
  wireless chart data, optional temperature normalization, SG/Brix samples,
  and extrema-preserving chart sampling. Rendering is limited to 400 points
  per line while the reading inspector and virtualized log list retain the
  full data.
- Readings refresh every 30 seconds while the app is active. Live device
  requests advance their end time; applied historical ranges stay fixed.
- Device details and brew details both link to the reading screen. Device
  history has date/time filters and All readings. Brew history uses its
  existing authenticated brew-log endpoint.
- Log editing uses the existing numeric fields and API `dateTime` property.
  A blank calibrated gravity preserves the current value, matching the
  existing endpoint. Single and fixed-range deletion require confirmation.

### iOS verification

Rebuilt the development client with `react-native-svg` 15.15.4. Verified on
iPhone 17 Pro / iOS 26.2 with the normal local backend:

- Opened the reading screen from Active Test Brew and from the device route.
- Loaded all 673 existing hydrometer readings and rendered the overlaid
  gravity/temperature chart with labeled axes.
- Checked SG/Brix, Celsius/Fahrenheit, individual-reading navigation and the
  ABV overlay toggle. Axis ranges and text summaries expose the series to
  accessibility tools.
- Opened an existing log in the editor, entered an incomplete decimal and
  confirmed Save was disabled. Restored its original value and saved
  successfully through the existing API.
- Opened and cancelled single-log deletion. No logs were deleted.
- Full VoiceOver and enlarged-text interaction remain part of the final
  pre-merge UI pass.

### Android verification

Rebuilt the development client with SVG support. Verified on the existing
Medium Phone / API 36.1 emulator using the authorized ADB workflow:

- The initial recent range correctly showed zero readings. All readings loaded
  the same 673 logs as iOS.
- Verified simultaneous gravity and temperature lines, both y-axes, SG/Brix,
  Celsius/Fahrenheit and individual-reading navigation.
- Opened the editor and saved an existing reading with its original values.
  The editor dismissed and the log list reloaded successfully.
- Opened and cancelled single-log deletion.
- Checked the overlaid chart in dark mode at 140% font scale; labels and legend
  remained readable. Restored the emulator to its original light mode and 100%
  font scale afterward.

### Checks

- Mobile: 118 tests, typecheck and lint pass.
- API client: 24 tests and typecheck pass.
- Brew domain: 61 tests and typecheck pass.
- API contracts: 77 tests pass. No contract generation was needed.
- Web: 264 tests and typecheck pass.
- i18n: 3 tests pass. Only English source strings changed.
- iOS and Android preview-profile JavaScript exports pass.

### Test data and remaining UI review

No test records were created or removed. Two existing seeded readings were
saved with their original values during editor checks: November 9 at 5:48 AM
on iOS, and November 10 at 6:03 PM on Android (displayed local times).

Actual deletion was not performed against seeded records. Automated API-client
checks cover single and range deletion requests; device checks cover the native
confirmation and cancellation. New physical-device telemetry arrival, complete
screen-reader navigation and the combined-area UI pass remain for final review.
The parent PR must keep its unchecked iOS/Android UI-review item before merging.
