# Theme layout audit — 2026-10-21

Local Chrome audit of PR #464 on `design-themes`, with the responsive fixes described below applied.

## Interaction follow-up after user review

The first pass missed sidebar open/closed geometry and account-header containment.
Those are now explicitly checked, rather than inferred from document width:

- Both calculator sidebars: five designs × two modes × open/closed × 320px/1280px
  (80 rendered states). Toggle dimensions remain 32 × 32 and their position is
  unchanged between open and closed within each route/viewport. Neon matches the
  other designs. Extra-calcs navigation now lives outside its decorated panel.
- Account, brews, hydrometer, and chat headers: all designs and both modes at
  320px (40 checks), plus account at 390px and 640px (20 checks). Header controls
  remain within the panel; at phone widths they precede content in normal flow.
- Combined design/mode menu: both checked selections survive reload. Separate
  mode buttons were removed, including account settings and the legacy API nav.
- The startup script now only validates/applies a saved design. URL-based design
  overrides are removed. A deterministic test covers known/unknown preferences,
  blocked storage, and absence of startup writes.

These targeted follow-up checks do not replace the limits listed below.
Follow-up TypeScript and all five tests pass. Targeted ESLint reports no errors
and three existing effect/state warnings in the account settings and recipe
sidebar logic, which this layout change does not modify.

## Coverage

Five designs (Classic, Nordic Mead Hall, Neon Fermentation, Hive, Catppuccin), each in light and dark mode. Completed 50 route/query combinations at 320 × 800, four additional recipe-builder states at that width, and six representative states at 1280 × 900: **600 distinct completed theme/mode/viewport/state checks**. The tutorial opening was checked in Classic only and is excluded from that total.

Checks measured document width, overflowing button/tab labels, buttons extending beyond their immediate container, and visible application error pages. Screenshots were captured and representative problem areas were visually reviewed; this is not a manual pixel review of every screenshot or an exhaustive functional test. Earlier captures under viewport emulation were scaled thumbnails; DOM measurements remained valid. Later captures use full-page resolution.

No completed matrix state has remaining document-width or button-label overflow according to those checks. Dense tables intentionally scroll inside their own containers.

## Findings addressed

- Kept the contributor’s component artwork while moving colors, fonts, radii, shadows, and page canvases onto shared semantic tokens. Removed theme-specific content spacing and sizing.
- Removed per-page panel annotations and the `PagePanel` wrapper. Existing `bg-background` surfaces with `rounded-xl` or `rounded-2xl` receive the treatment, including guides.
- Styled helper-generated button links centrally through `buttonVariants()` markers. Variant and size classes remain distinct.
- Made button groups retain joined corners and borders; suppressed child shadows and movement. Standalone Hive icon buttons keep the hexagonal art.
- Allowed long text buttons to grow and wrap. Kept table button labels on one line within scrolling tables to avoid very tall rows.
- Wrapped tabs and split PDF zoom/actions into groups that can stack on narrow screens. Reduced mobile navbar control gaps.
- Reserved the visible banner region’s actual height so notices do not cover page content.
- Allowed cards to shrink inside grids, fixing admin chat report tables stretching the whole viewport.
- Reflowed shared catalog pagination so Previous/Next labels remain readable on narrow screens.

## Completed browser matrix

Every row below includes all five themes in both modes. Query variants are listed separately because they select different UI states.

| Route | UI state | Width | Theme/mode checks |
| --- | --- | ---: | ---: |
| `/account` | initial | 320 | 10 |
| `/recipes/4?pdf=true` | initial | 320 | 10 |
| `/integrations/mcp` | initial | 320 | 10 |
| `/account/premium` | initial | 320 | 10 |
| `/public-recipes` | initial | 320 | 10 |
| `/account/chat` | initial | 320 | 10 |
| `/yeasts` | initial | 320 | 10 |
| `/` | initial | 320 | 10 |
| `/account/brews` | initial | 320 | 10 |
| `/account/brews/new` | initial | 320 | 10 |
| `/account/hydrometer` | initial | 320 | 10 |
| `/account/hydrometer/devices` | initial | 320 | 10 |
| `/account/hydrometer/brews` | initial | 320 | 10 |
| `/account/hydrometer/setup` | initial | 320 | 10 |
| `/recipes/2` | initial | 320 | 10 |
| `/recipes/4` | initial | 320 | 10 |
| `/nute-calc` | initial | 320 | 10 |
| `/juice` | initial | 320 | 10 |
| `/stabilizers` | initial | 320 | 10 |
| `/extra-calcs` | initial | 320 | 10 |
| `/extra-calcs/bench-trials` | initial | 320 | 10 |
| `/extra-calcs/blending` | initial | 320 | 10 |
| `/extra-calcs/bottling` | initial | 320 | 10 |
| `/extra-calcs/brix` | initial | 320 | 10 |
| `/extra-calcs/estimated-og` | initial | 320 | 10 |
| `/extra-calcs/priming-sugar` | initial | 320 | 10 |
| `/extra-calcs/refractometer-correction` | initial | 320 | 10 |
| `/extra-calcs/sorbate` | initial | 320 | 10 |
| `/extra-calcs/sulfite` | initial | 320 | 10 |
| `/extra-calcs/temperature-correction` | initial | 320 | 10 |
| `/recipe-building/calculating-gravity` | initial | 320 | 10 |
| `/recipe-building/nutrient-schedules-and-amounts` | initial | 320 | 10 |
| `/about` | initial | 320 | 10 |
| `/contact` | initial | 320 | 10 |
| `/desktop` | initial | 320 | 10 |
| `/taplist` | initial | 320 | 10 |
| `/release-notes` | initial | 320 | 10 |
| `/reset` | initial | 320 | 10 |
| `/admin` | initial | 320 | 10 |
| `/admin/brews` | initial | 320 | 10 |
| `/admin/recipes` | initial | 320 | 10 |
| `/admin/users` | initial | 320 | 10 |
| `/admin/yeasts` | initial | 320 | 10 |
| `/admin/ingredients` | initial | 320 | 10 |
| `/admin/additives` | initial | 320 | 10 |
| `/admin/maintenance` | initial | 320 | 10 |
| `/admin/chat` | initial | 320 | 10 |
| `/reset-password` | initial | 320 | 10 |
| `/release-emails/unsubscribe` | initial | 320 | 10 |
| `/account/chat?tab=credits` | initial | 320 | 10 |
| `/` | nutrients | 320 | 10 |
| `/` | additives | 320 | 10 |
| `/` | notes | 320 | 10 |
| `/` | pdf | 320 | 10 |
| `/` | pdf | 1280 | 10 |
| `/account` | initial | 1280 | 10 |
| `/account/chat` | initial | 1280 | 10 |
| `/admin/chat` | initial | 1280 | 10 |
| `/extra-calcs/bottling` | initial | 1280 | 10 |
| `/recipe-building/calculating-gravity` | initial | 1280 | 10 |

## Limits and separate follow-ups

- `/api` uses Scalar’s separate styling; the app themes do not restyle that embedded documentation UI.
- The legacy `/extra-calcs/abv` route redirects to `/ExtraCalcs`, which returned a 404. The actual ABV calculator at `/extra-calcs` passed the matrix. This routing issue was not changed.
- The tutorial opening fits at 320px in Classic, but its modal blocks the navbar theme picker; the full tour was not audited across themes.
- Signed-out login/register screens, token-valid reset/unsubscribe flows, OAuth consent, admin create/edit dialogs, every populated brew/device detail/chart, and every guide/release article were not exhaustively exercised. Account-dependent empty states and available local data were used.
- The recipe PDF builder state was explicitly opened and checked. A public recipe URL with `pdf=true` alone does not establish that an owner-only PDF view was reached.
- No forms were submitted, records or account preferences changed, or chatbot requests sent. No model-provider spend or database changes were made.

## Verification

- Web TypeScript typecheck.
- ESLint on the changed shared layout/component files and theme test: no errors;
  one existing `set-state-in-effect` warning in `PaginatedTable.tsx` (unchanged pagination state logic).
- Five tests: startup preference behavior plus four theme contracts covering both palettes and semantic colors, variable references, no per-page hook requirement, and no content layout declarations in theme styles.
- `git diff --check`.

The checks above cover rendering and shared layout behavior; they do not establish accessibility compliance or validate all application workflows.
