# Calculator verification

Tracking: [#572](https://github.com/ljreaux/MeadTools/issues/572) (parent
[#551](https://github.com/ljreaux/MeadTools/issues/551)). This records the
device checks of the Mobile calculators and the web regression check of the
logic this area moved into `@meadtools/core`. Keep credentials, tokens and
account screenshots out of the evidence.

## Environment — November 14–16, 2026

- Code: branch `551-mobile-calculators` on `preview` at `d0f41031` (#566–#571
  plus the legacy provider removal).
- Backend: local development server and database, local test accounts.
- iOS: iPhone 17 Pro Simulator (iOS 26.2), SDK 57 development client.
- Android: `Medium_Phone_API_36.1` emulator, SDK 57 debug development client.
  Offline checks used real airplane mode.
- Web baseline: a detached worktree of `preview` at `d0f41031` running on port
  3001 against the same local database, next to the branch on port 3000.
  `preview` had not moved since the branch was cut, so this is what
  preview.meadtools.com runs.

## Device results

Inputs are each calculator's defaults unless noted. "Web" is the branch web
calculator with the same inputs.

| Calculator | Inputs | Result | iOS | Android | Web |
| --- | --- | --- | --- | --- | --- |
| ABV | 1.105 → 1.000 | 13.95% ABV, 63 DU | Pass | Pass | Pass |
| Brix conversion | 1.1 SG | 23.75 Brix | Pass | Pass | Pass |
| Refractometer correction | CF 1, OG 1.1 SG, FG 8.5 Brix | 0.998 SG, −0.63 Brix, 13.58% ABV, 60 DU | Pass | Pass | Pass |
| Temperature correction | 1.1 SG at 90 °F, calibrated 68 °F | 1.103 SG, 24.5 Brix | Pass | Pass | Pass |
| Estimated OG | FG 1.000 SG, refractometer 5 Brix | 1.054 SG, 13.32 Brix, 7.07% ABV, 32 DU | Pass | Pass | Pass |
| Stabilizers | 1 gal, 12% ABV, pH 3.6 | 0.505 g sorbate, 0.332 g K-meta, 0.7 Campden | Pass | Pass | Pass |
| Sulfite | 1 gal, 50 ppm | 0.332 g K-meta, 0.67 Campden | Pass | Pass | Pass |
| Sorbate | 1 gal, 12% ABV | 0.505 g | Pass | Pass | Pass |
| Blending | 1.1 × 3 and 1.0 × 0.5 (typed "1,1" on Android) | 1.086, total 3.5 | Pass | Pass | Pass |
| Bench trials | 1 gal, 50 ml sample, 10%, 0.5 ml | 0.05 g, 990 ppm, 3.747 g per gal | Pass | Pass | Pass |
| Priming sugar | 1 gal, 68 °F, 2.4 vol, corn sugar | 23.378 g per batch, 2.192 g per 12 oz | Pass | Pass | Pass |
| Bottling | 5 gal, empty plan | "Use 54 bottles" (12 oz), status and totals | Pass | Pass | Pass |
| Juice | 26 g, 240 ml, 8 servings | 10.833 Brix, 1.044 SG, 208 g | Pass | Pass | Pass |
| Yeast table | 108 catalog yeasts | 20 cards at a time, "Show 20 more", search/filter/sort reset paging, °F/°C | Pass | Pass | — |
| Nutrients | 5 gal, SG 1.1, Lalvin 18-2007, Fermaid O | 196 ppm, 23.183 g, Go-Ferm 12.5 g, 250 ml | Pass | Pass | Pass |
| Nutrients | as above, Fermaid O + K | 17.032 g + 9.841 g | Pass | Pass | Pass |

| Check | iOS Simulator | Android emulator |
| --- | --- | --- |
| Nutrient steps: pinned step bar stays at the top while a step scrolls; changing step opens it at the top | Pass | Pass |
| A focused field near the bottom scrolls above the keyboard | Pass | Pass after fix (see Findings) |
| First launch with no saved catalogs while offline: Tools list, yeast table and nutrient yeast picker ask to connect once; catalog-free calculators work; nitrogen can still be chosen | Pass (server unreachable) | Pass (airplane mode) |
| Reconnect saves the catalogs with no user action | Pass after fix: returning to the Tools list saved all three (see Findings) | Pass: saved about 15 s after airplane mode was turned off |
| Cold launch offline with saved catalogs: yeast table and nutrient yeast picker load from the device | Pass | Pass |
| Tools list shows the offline-data status with the saved date | Pass | Pass |
| German layout | Waits for Weblate's German strings on `preview` | Waits for Weblate |

## Web regression check against `preview`

### Logic, old against new

The old code (preview's core plus the inline code preview's web hooks used)
and the branch's core helpers were run on the same generated inputs, including
NaN, negative zero, empty and out-of-range values.

| Item | Cases | Differences |
| --- | --- | --- |
| `normalizeNumberString` (all digits 0–6, `en`/`de`/default locale, clamp on and off) | 840,840 | 0 |
| Refractometer correction (shown SG, Brix, ABV, DU; both units; correction factor) | 30,000 | 0 |
| Temperature correction (°F and °C) | 30,000 | 0 |
| Estimated OG (shown SG, Brix, ABV, DU) | 30,000 | 0 |
| ABV highlight (English display) | 1,576,924 (−50% to 2,000%) | Only at 1,000% and above (intended, see below) |
| Stabilizers (sorbate, sulfite, Campden) and the gal/L volume switch | 30,000 each | 0 |
| Priming sugar table | 30,000 | 0 |
| Bottling status | 30,000 | 0 |
| Bottles to finish | 30,000 | 0 after fix (see Findings) |
| Juice g/mg and ml/fl oz switches | 30,000 each | 0 |
| Yeast °C temperature; nitrogen sort over catalog values | 30,000; 16 pairs | 0 |
| MCP tools `correct_refractometer`, `correct_hydrometer_temperature`, `estimate_original_gravity`, `calculate_sorbate`, `calculate_priming_sugar` (results, refusal messages and published schemas) | 20,000 each (1,099–3,678 accepted, the rest refused) | 0 |

### Pages, branch against `preview`

Each scenario ran on both servers with the same steps. The page text after
every step was compared.

| Item | Scenario | Result |
| --- | --- | --- |
| Refractometer | CF 1.04, OG/FG in SG and Brix, unit switches (typed value converts) | Same |
| Temperature correction | °F, °C, empty and comma input | Same |
| Estimated OG | Five readings including an empty one | Same |
| ABV page | English: high, negative, equal and invalid readings | Same |
| ABV line in German (ABV, refractometer) | 28.82%, −13.05% and 39.45% ABV | Intended difference: highlighted on the branch, never on `preview` |
| Stabilizers | pH on and off, sodium, gal ↔ L with the typed volume converting | Same |
| Sorbate | Litres, 16.5% ABV, empty ABV | Same |
| Priming sugar | Sugar order, all five bottle columns, °F/°C, gal/L, out-of-range warnings | Same |
| Bottling page | Under, within 0.1, over, "Add bottles", custom bottle, litres | Same |
| Bottling in the brew Packaged stage | Rendered page, then unsaved edits: under, over, cleared, "Add bottles" | Same (nothing saved) |
| Juice | Both unit switches and back | Same |
| Yeast table | Nitrogen sort both directions, °C, tolerance sort | Same |
| Blending | Parts of 1.5 and 2, 1.2345 and 2, 10 and 5 | Intended difference: totals 3.5 and 3.234 on the branch, 4 and 3 on `preview`; blended values the same |
| Nutrient calculator `/nute-calc` | Brand → first strain and nitrogen, nitrogen, offset, every nutrient combination, O+K at SG 1.04–1.15, Other, additions, all Go-Ferm types, typed yeast amount (28 states) | Same |
| Nutrient calculator settings | Other presets (three), edited Other max g/L, edited Fermaid O max g/L, provided YAN on and off, typed yeast amount then Auto | Same |
| Recipe builder (controlled provider) | Same draft on both; builder sync, then O+K+DAP, additions, Go-Ferm Protect; the saved draft's nutrient data compared after each step | Same, so a saved recipe stores the same nutrient data |
| Owner recipe page | Every builder step of a saved recipe | Same nutrient values; other differences were page load timing only |
| `GET /nutrient-presets` OpenAPI | Served schemas and `/api` reference | Intended difference: real list and error schemas on the branch (empty on `preview`); the reference shows the preset fields |

## Findings

- **Fixed: catalogs never retried after a server outage (#568).** With the
  device online but the server down or slow, a failed catalog query was not
  fetched again until the app restarted. The Tools list kept asking to connect
  and ingredients and nutrient presets were not saved. A failed catalog now
  retries when its screen comes back into view.
- **Fixed: bottles to finish could return NaN (#569).** The shared helper
  returned NaN for an unreadable volume where the old web code returned 0.
  Neither caller could reach it (both turn unreadable input into 0), but it
  now returns 0, with a regression test.
- **Fixed: Android keyboard covered fields near the bottom (#566).** Android
  draws edge to edge, so the window no longer shrinks for the keyboard, and
  `KeyboardAvoidingView` measured from its parent and left too little room.
  The calculator screen now measures its position in the window and pads by
  the covered height.
- **Intended differences for the PR:** the ABV highlight now works in German
  and for values of 1,000% or more (the old check read the displayed text);
  blending total volume shows up to 3 decimals; `GET /nutrient-presets` has
  real response schemas.
- **Existing `preview` issues, fixed in a follow-up commit on this branch:**
  - Sorbate went negative above 16% ABV on the web sorbate and stabilizers
    pages (−0.315 g at 16.5%). Core now keeps the stabilizer dose at 0, and web
    and Mobile show the recipe builder's "No Sorbate Needed!" from 16% ABV.
  - In development only, the stabilizer and sorbate pages opened with
    0.264 gal instead of 1: React's development double effect ran the
    unit-conversion effect a second time. The web juice and stabilizer hooks
    now convert in the unit change handlers, not effects.
  - Juice serving size drifted after a ml → fl oz → ml round trip
    (240 → 240.0008). Core `switchUnitText` now restores the typed value when
    a unit is switched straight back; web juice, stabilizers and temperature
    correction and the Mobile volume, juice and temperature fields use it.
  - Web temperature correction kept the typed temperatures when switching °F
    to °C. It now converts them, to one decimal place, like Mobile (shared
    core `convertTemperature`).
  - `YeastTable.json` had no "Very Low" label. English is added; German waits
    for Weblate.
- **Follow-up checks — November 16, 2026:** on the branch web, juice
  240 mL → 8.1154 fl oz → 240 mL and an edited value converts normally; the
  stabilizer page loads at 1 gal and 0.505 g; 16% and 16.5% ABV show "No
  Sorbate Needed!" with the sulfite result kept, 15.9% gives 0.013 g;
  temperature correction converts 90/68 °F to 32.2/20 °C and back with the same
  1.103 SG. On iOS, juice returns to 240 mL and sorbate at 16.5% shows 0 g with
  "No Sorbate Needed!".

## Checks

- Mobile tests (105), typecheck, lint, and preview-profile exports for iOS and
  Android.
- Core (36), web (263), recipe-agent (91), API client, API contract and i18n
  tests. Contract and OpenAPI regeneration produced no changes.
- Each rewritten commit typechecks on its own; autosquash rebases left the
  final tree unchanged.
