# Public recipe and brew discovery (#476)

## Audit and initial supported scope

`recipes.private = false` is the existing public directory rule
(`lib/db/recipes.ts`). There is no separate unlisted recipe flag. Access to a
private record by its owner or a known link does not make it discoverable.
The existing recipe-linked brew listing/detail require **both** `brews.public`
and a surviving linked recipe with `private = false` (`lib/db/brews.ts`). MCP
uses exactly that discoverability rule, including for direct brew IDs: standalone
brews and brews linked to private/deleted recipes are unavailable. Public recipe
access never grants access to private brews. There are no soft-delete columns;
deleted rows disappear. Reads are uncached and reapply visibility on every call.

V2 recipe JSON supplies ingredient catalog references, saved nutrient yeast
identity, fermentation FG input and authoritative calculation inputs. Legacy
JSON is deliberately unsupported rather than guessed. Brews have start/end
dates, stage, stored liters and their own saved snapshot. `latest_gravity` has
mixed provenance and is unsuitable as measured FG. Only visible manual GRAVITY
entries explicitly tagged `source: measured`, `readingRole: OG/FG` are usable
for initial measured outcomes; sensor data and inferred/recipe readings are
excluded. Notes, contact/account data and device information are unnecessary.

| Criteria | Recipes | Brews | Definition |
| --- | --- | --- | --- |
| `query` | yes | yes | case-insensitive name substring, max 160 characters |
| `recipeId` | exact ID | linked public recipe | reapplied independently of brew visibility |
| `ingredientId` | V2 catalog ref | saved snapshot catalog ref | positive catalog ID from `search_ingredients`; custom/name-only lines do not match |
| `yeastId` | saved nutrient yeast ID | saved snapshot yeast ID | positive ID from `search_yeasts`; no fuzzy or current-source-recipe fallback |
| `estimatedAbvPercent`, `originalGravitySg`, `finalGravitySg`, `volume` | yes | snapshot estimates | inclusive min/max; FG means fermentation target; volume means estimated bottling yield |
| `stage`, `completed`, `startedFrom`, `startedTo` | rejected | yes | completed means COMPLETE stage **or** non-null end date; dates filter stored start date inclusively |

Volumes accept L, mL, or US gal and normalize to liters. Unknown fields, reversed
ranges and unsupported criteria fail validation; missing structured values do
not satisfy numeric/catalog filters. No measured-value filters, arbitrary SQL,
freeform groupings, custom-ingredient fuzzy matching or inferred yeast identity.

Five tools: `search_public_recipes`, `get_public_recipe`,
`search_public_brews`, `get_public_brew`, `summarize_public_brews`. Details accept
an ID or a same-origin application link, including a locale prefix. Recipe and
brew details are distinct from owner tools and never consult account consent.
Authentication, entitlement, rollout and usage limits stay at the existing MCP
boundary. Hosted consumers can reuse the same schemas/operations and adapter.

Search order is ID descending (UUID lexical order for brews), with keyset cursors,
10 results by default and at most 20. Follow cursors with identical filters.
Each call reflects current visibility, not a historical snapshot. Summaries and
search use a complete metadata/catalog-filtered candidate cohort, capped at 200 records.
If there are more candidates, return `too_broad` without records or statistics;
narrow by name, catalog ID, recipe association, stage or date. Catalog identities
are pushed into parameterized JSON containment predicates before
candidate admission (numeric and canonical decimal-string ingredient references are
compatible). The shared domain rechecks them. Numeric estimate filters run after
bounded V2 validation/calculation, so only numeric filters cannot reduce the
candidate admission limit. No partial page is treated as a complete cohort.

## Analysis definitions

The initial summary reports matching brew count; missing/unsupported snapshots;
and count, missing count, minimum, maximum and mean for measured OG and FG (SG)
and recorded lifecycle duration (days). Latest explicit OG and FG are selected
independently by `(datetime DESC, id DESC)`; the projection includes their dates.
Each brew contributes at most once per statistic. Duration is `(end_date -
start_date) / 86400000` only for ordered, present endpoints. This is recorded
lifecycle duration, **not fermentation duration**: the data does not establish
pitch/completion endpoints. Missing/invalid endpoints are unknown, never zero.
Measured SG is not calculated ABV or a recipe target. Estimates are labeled and
kept separate, and no observed ABV or stability/causality verdict is inferred.

Results include criteria, units, coverage, counts and a selected/incomplete
public-submissions caveat. Names and composition text are untrusted reference
content. No notes are returned, including snapshot notes that could predate a
visibility change. Canonical links are built from the configured app origin;
record text and request hosts cannot supply them. Detail V2 projections contain
only bounded composition and explicit calculated estimates, never opaque JSON.

## Local verification and manual review

Deterministic suites use synthetic records, mocked persistence and the actual MCP
SDK in-memory transport. They exercise query predicates/parameters, bounds,
visibility combinations and changes, missing/legacy data, catalog/range filters,
duplicate names, cursors, aggregate coverage and existing permission/usage limits.
Those suites do not execute queries against PostgreSQL or call a model provider.
The additional [local brewing fixture seed and verification](mcp-public-local-fixtures.md)
executes the real public queries against approved local PostgreSQL databases.

```sh
npm run test:recipe-agent
node --import tsx --test apps/web/lib/mcp/*.test.ts apps/web/lib/ai/*.test.ts
npm run typecheck --workspace @meadtools/recipe-agent
npm run typecheck --workspace @meadtools/web
npm run check:package-boundaries
```

Use the existing local preview and reconnect the local MCP client so it discovers
the five added tools. All credentials retain their current auth/entitlement rules;
public tools need `mcp:tools`, not account-read consent. Useful manual prompts:

- Find public raspberry mead recipes using 71B, with estimated finished ABV
  between 10 and 12 percent. Resolve catalog IDs first; disclose missing data.
- Show public brews made from a returned public recipe and open one result.
- Summarize recorded OG, FG and lifecycle duration for those brews, including
  usable/missing counts. Do not describe lifecycle duration as fermentation time.
- After changing one fixture brew or source recipe to private, repeat list,
  direct detail and summary calls and verify it disappears. Restore the fixture's
  visibility only after testing.

Direct deterministic tool arguments (replace IDs with real local public records):

```json
{"tool":"search_public_recipes","arguments":{"filters":{"query":"raspberry","yeastId":71,"estimatedAbvPercent":{"min":10,"max":12}},"limit":5}}
{"tool":"get_public_recipe","arguments":{"id":123}}
{"tool":"search_public_brews","arguments":{"filters":{"recipeId":123,"completed":true},"limit":5}}
{"tool":"get_public_brew","arguments":{"url":"http://localhost:3000/recipes/123/brews/00000000-0000-4000-8000-000000000001"}}
{"tool":"summarize_public_brews","arguments":{"filters":{"recipeId":123,"completed":true}}}
```

The IDs above are illustrative, not catalog facts or known records. Use the
client's normal tool-call interface; the `tool`/`arguments` wrapper illustrates
names/arguments rather than a new HTTP endpoint. The database-backed fixture verification and a user-operated ChatGPT retest with
populated brew records now pass; see the recorded client evidence below.
No database schema, REST route contract or launch configuration changes are
required. Release notes belong in the separate release workflow.

## Client interpretation follow-up

The [local ChatGPT retest](mcp-public-client-retest.md) exercised all five tools
and matched the populated fixture counts/statistics. One comparison table
misnamed measured fermentation FG as finished gravity. Strict public responses
now include `readingBasis`, and shared output descriptions/MCP/hosted guidance
explicitly align `measuredFg` with `fermentationTargetFgSg`. The separate
`finishedGravitySg` remains a recipe estimate; measured finished/backsweetened
gravity and measured ABV are not returned. A deterministic sweetened-recipe
regression covers that distinction. A subsequent user-operated retest with an explicit comparison prompt kept the
stages separate and matched the fixture statistics. This is evidence for that
manual scenario, not a guarantee for arbitrary prompts or other clients.
