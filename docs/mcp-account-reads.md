# MCP account reads

Five read-only tools require explicit `mcp:account:read` alongside `mcp:tools`.
Authentication, premium access and payment restrictions run before the server
is created. Discovery and direct invocation both enforce the grant. Existing
credentials retain seven public/stateless tools; an opted-in connection sees
twelve. There are no owner/user arguments and no mutation adapter methods.

| Tool                | Arguments                                                                               | Result                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `list_brews`        | Optional `query`, `stage`, `activity` (`all`, `active`, `completed`), `cursor`, `limit` | Owned brew IDs, bounded names, stage, dates and stored current volume                                                                  |
| `get_brew`          | UUID `id`                                                                               | Owned brew summary, validated saved snapshot, latest visible manual gravity/temperature/pH entry per type and latest hydrometer sample |
| `get_brew_timeline` | UUID `id`, optional offset-aware ISO `from`/`to`, `types`, `cursor`, `limit`            | Typed visible entries for an inclusive date window and page metadata                                                                   |
| `list_recipes`      | Optional `query`, `cursor`, `limit`                                                     | Owned saved recipe IDs, bounded names and visibility, including private recipes                                                        |
| `get_recipe`        | Positive integer `id`                                                                   | Owned recipe summary, validated allowlisted inputs, recipe targets and shared-domain calculated estimates                              |

Lists default to 10 records, cap at 20 and fetch only one additional record to
establish continuation. Brews and recipes sort by ID descending; duplicate names
remain separate. Timeline ordering is `(datetime DESC, id DESC)`. Timeline SQL
preserves PostgreSQL microseconds in both the output and cursor; offsets are
compared as instants. Cursor arguments contain position only, never identity;
every continuation re-applies account ownership and requested filters. Keep the
same filters when following a cursor. Pagination reflects current records and
is not a transactional snapshot of a changing account.

Every successful response includes `textPolicy`, marking names, titles, notes
and recipe text as untrusted reference data. Text cannot authorize operations.
Names/titles/units cap at 160 characters and entry notes at 500; corresponding
`*Truncated` booleans disclose any cut. Recipe ingredients cap at 30, additives
at 20 and notes at 10 per phase. Oversized recipe inputs return an explicit
unsupported status, rather than silently omitting recipe content. Recipe input
JSON caps at 24 KiB; account execution results cap at 28 KiB. The transport
checks its full 64 KiB response limit, including both structured content and
compatibility text. Oversized pages return an error requesting a smaller page. No owner emails, alerts, device credentials, identifiers, battery
metadata or arbitrary entry/snapshot objects are returned.

Page metadata includes `hasMore`, `nextCursor`, `scanned`, and
`scope: requested_page`; it never labels a partial account/history as complete.
Hidden entries and internal nutrient-basis/ABV bookkeeping are excluded before
the SQL limit. Timeline includes notes, tasting/issues, structured additions,
pH, volume/packaging and stage changes. Other recorded entry types retain their
bounded title/note and typed scalar columns, without opaque data. Packaging
returns stored liters, display volume/unit and total package count.

Manual readings retain timestamps, SG units, OG/FG/general roles, entered
units/values and stored refractometer correction fields. `provenance` distinguishes
measured values, recipe targets, derived estimates and unknown legacy sources;
unknown provenance is never silently treated as a measurement. The latest
hydrometer sample separates measured gravity/temperature from stored calculated
gravity. It does not expose device calibration coefficients. Recipe calculations
use the full `calculateRecipeDerivedApiResponse` path. `derivedEstimates` preserves
the drafting response's complete `gravity`, `volume`, `alcohol`, `stabilizers`
and `nutrients` sections. In particular, `gravity.backsweetenedFg` and
`alcohol.abv` describe the finished recipe after secondary/backsweetening
additions; the pre-addition fermentation final-gravity input remains separate
as `recipeTargets.finalGravitySg`. Volume includes primary/secondary losses and
bottling volume. Alcohol includes Delle; nutrients include YAN, total/per-addition
amounts and Go-Ferm hydration amounts.

`stabilizers.sorbate` is grams of potassium sorbate; `stabilizers.sulfite` is
grams of the selected K-meta/Na-meta. `stabilizers.campden` is the alternative
tablet count, not an additional sulfite dose. The choice of sulfite does not
exclude sorbate. `calculationContext` labels these as estimates rather than
recorded additions, states whether stabilization is enabled, and reports the
configured pH and its basis. A configured pH reading is not independently
verified; disabling pH entry means the calculation uses a configured assumption,
not proof that the brewer never measured pH. If saved nutrient settings are
absent, their domain-default calculation basis is disclosed explicitly.

The canonical derived contract supplies the output allowlist, with strict nested
objects and non-finite calculation results represented as null. Numeric units
and roles are included in the advertised output schema. Batch calculations use
only the brew's saved snapshot, with no fetch of its source recipe.

Invalid arguments return `invalid_input`; valid foreign and missing IDs both
return the same `not_found` with no record details. Empty lists return `ok` with
an empty page. A missing adapter returns `unavailable`. Missing/legacy recipe
JSON returns nested `unsupported` with `missing_or_legacy`; unsafe recipe sizes
return `unsupported` with `exceeds_safe_bounds`. Unknown numbers are explicit
nulls. Adapter exceptions produce a generic error without database details.
No read rewrites, converts or backfills stored records. Operational usage
bookkeeping remains separate and logs only tool name, result class and duration.

## Wiki guidance for advice

The MCP initialization response supplies server instructions directing the agent
to search/fetch relevant wiki content before giving brewing advice or disputing
calculated doses, and to cite the fetched canonical URLs. Recipe detail, brew
detail and timeline tool descriptions reinforce that workflow. Calculator
assumptions and any disagreement with sources should be explained; guidance is
not a guarantee of stability or a reason to silently replace calculated values.
If retrieval fails or does not support a claim, the agent is asked to state the gap.

Those three detail responses include bounded `relatedGuidance` with relevant
fermentation, stabilization/backsweetening, nutrient or troubleshooting references.
Every reference comes from the bundled reviewed wiki catalog, selected using typed
recipe/entry fields. Names and notes cannot supply reference URLs or instructions.
`referenceStatus: catalog_references_not_fetched` makes clear that references are
navigation aids; the client still needs to call `fetch_wiki_page` to read evidence.
Reference generation adds no network calls to account reads. The existing wiki
fetch tool retains its host/redirect and response-size restrictions.

Server instructions and tool descriptions guide the client; the MCP server does
not control the external model's tool ordering or guarantee that it follows them.
Reconnect clients after changing the instructions or schemas, then repeat normal
recipe-analysis prompts and inspect wiki calls/citations. These human-operated
client checks remain separate from deterministic tests and involve no automated
model-provider batch.

Deterministic verification (no model provider, live database or credentials):

```sh
npm run test:recipe-agent
node --import tsx --test apps/web/lib/mcp/*.test.ts
npm run typecheck --workspace @meadtools/recipe-agent
npm run typecheck --workspace @meadtools/web
npm run check:package-boundaries
```

The SDK fixture injects the authenticated account adapter, checks all five calls,
permission-filtered discovery, foreign/missing IDs, query-boundary limits,
private recipes, cursor continuation, equal timestamps, precision/offsets,
rate/concurrency denial and unchanged source records. Query tests use mocked
persistence and inspect parameterized SQL; Preview checks against PostgreSQL and
supported Claude/ChatGPT clients remain pending in the client testing plan.
