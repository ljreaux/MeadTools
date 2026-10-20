# MCP account reads

Seven read-only tools require explicit `mcp:account:read` alongside `mcp:tools`.
Authentication, premium access and payment restrictions run before the server
is created. Discovery and direct invocation both enforce the grant. Existing
credentials retain seven public/stateless tools; an opted-in connection sees
fourteen. There are no owner/user arguments and no mutation adapter methods.

| Tool                | Arguments                                                                               | Result                                                                                                                                 |
| ------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `list_brews`        | Optional `query`, `stage`, `activity` (`all`, `active`, `completed`), `cursor`, `limit` | Owned brew IDs, bounded names, stage, dates and stored current volume                                                                  |
| `get_brew`          | UUID `id`                                                                               | Owned brew summary, validated saved snapshot, latest visible manual gravity/temperature/pH entry per type and latest hydrometer sample |
| `get_brew_timeline` | UUID `id`, optional offset-aware ISO `from`/`to`, `types`, `cursor`, `limit`            | Typed visible entries for an inclusive date window and page metadata                                                                   |
| `get_brew_sensor_history` | UUID `id`, optional offset-aware ISO `from`/`to`, `cursor`, `limit` | Historical automatic hydrometer samples, measured/device-calculated gravity, temperature and partial-page coverage |
| `summarize_brew_sensor_history` | UUID `id`, optional paired `from`/`to` (at most 31 days) | Compact complete-window counts, measured/device-calculated ranges, dated endpoints and sampling gaps; default latest recorded 72 hours |
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

Brew and recipe summaries in both lists and details include `appUrl`. The web
adapter builds these from the authenticated application's configured public
origin, shared with OAuth: `/account/brews/{uuid}` and `/recipes/{id}`. The
locale-free paths resolve through the application's locale routing. Localhost,
Vercel Preview branch/deployment URLs, a configured Preview domain, and
production use their respective origins; request headers, names, notes and
snapshot content cannot supply the link. These are navigation links, not public
share links or access grants. Brews require owner sign-in, and private recipes
retain application visibility/authentication rules. Generic adapters that do
not supply application links return `appUrl: null`; clients must not guess a URL.

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
return the same `not_found` with `dataAvailability: unknown` and only the
caller-supplied `requestedRecord` kind/ID, without record details. A failed read
does not establish that history is empty. Empty lists return `ok` with
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

Detail responses other than the compact sensor summary include bounded `relatedGuidance` with relevant
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

The SDK fixture injects the authenticated account adapter, checks all seven calls,
permission-filtered discovery, foreign/missing IDs, query-boundary limits,
private recipes, cursor continuation, equal timestamps, precision/offsets,
rate/concurrency denial and unchanged source records. Query tests use mocked
persistence and inspect parameterized SQL; Preview checks against PostgreSQL and
supported Claude/ChatGPT clients remain pending in the client testing plan.

An additional deterministic database fixture exercises all seven read operations
against actual PostgreSQL with synthetic accounts. It checks ownership/private
recipes, multi-page lists and history, equal timestamps and microseconds,
inclusive offset date windows, hidden and null legacy entries, snapshot isolation
from an updated source recipe, derived losses, links, and unchanged records.
Use a separately provisioned disposable localhost database named
`meadtools_premium_foundation_test`, with reviewed migrations already applied;
never point it at development or Preview. Supply only that test database's
`DATABASE_URL`/`DATABASE_DIRECT_URL`, then from `apps/web` run:

```sh
node --conditions=react-server --import tsx scripts/verify-mcp-account-reads-postgres.mjs
```

It rejects other database hosts/names, never loads application environment files,
and deletes only its synthetic accounts' records. It calls no model provider.
Passing it still does not establish Preview client compatibility. See the
[parent closure review](mcp-450-closure-review.md) for the latest evidence.

## Automatic sensor history

`get_brew_timeline` reads manually recorded brew entries. Automatic readings are
stored separately and are now available through `get_brew_sensor_history` in both
MCP and hosted chat. The shared input/output schemas and tool description are the
same; account-read consent, ownership, rate limits and tool budgets still apply.

Sensor pages default to 10 samples and cap at 20, newest first, with inclusive
UTC/offset-aware date filters. SQL preserves timestamp microseconds and orders by
`(datetime, id)` to avoid dropped/duplicated samples at page boundaries. The brew
ownership predicate is repeated in the sample query. Output includes only sample
ID, timestamp, measured gravity, stored device-derived gravity, temperature/unit
and calculation provenance; no device identity, calibration coefficients, battery
or credentials are returned. Empty owned histories return an empty page; foreign
or absent brews return `not_found` with unknown data availability. Raw samples are not averaged or interpolated.

A returned page is not a stability verdict. The tool describes its coverage as
`requested_sensor_page_not_stability_verdict`; clients must disclose incomplete
coverage and use suitable date windows or continuation pages when assessing trends.
A lower endpoint cannot establish that fermentation was still active at that
endpoint. Dense sensor histories may exceed one hosted turn's twelve-tool budget;
prefer the complete-window summary for trend questions. Raw history does not
bypass that budget or silently summarize unreturned samples.

The logs composite index migration `20261019010000_index_brew_sensor_history`
supports brew/date/sample-ID lookup. It is included for deployment review and has
not been applied locally or remotely. The Prisma schema validates. Offline tests
cover schema bounds, date order, projection, microsecond/tied-timestamp pagination,
ownership, SDK consent filtering and hosted-loop access. The disposable PostgreSQL
verification script now includes synthetic sensor samples and cleanup, but was
not executed in this iteration. A separate read-only check against the existing
local fixture retrieved all 673 samples in 34 pages without duplicates or omissions,
verified a restricted date window and compared MCP/hosted output equality. It made
no provider calls or database writes.

## Compact sensor summary

For trend questions, prefer `summarize_brew_sensor_history` over raw paging. Both
MCP and hosted receive the same compact result, without repeated wiki-reference
metadata or per-sample provenance. Tool descriptions retain the requirement to
fetch/cite brewing guidance before making process claims. No host-only argument
rewriting, forced tool sequences, answer replacement or increased budgets are added.

Omitted dates select the 72 hours ending at the latest recorded sample, **not now**.
Provide both offset-aware date endpoints to select another inclusive window, at
most 31 days. The result identifies the requested window, actual first/last sample
and count, and complete-in-window coverage. A foreign or absent brew is not_found;
an owned brew with no samples returns zero counts and null coverage/endpoints.

Measured and stored device-calculated SG are separate series. Each reports valid
count, minimum, maximum, first/last valid value **with its timestamp**, range and
net change. SQL excludes NaN/Infinity from these statistics but still counts those
samples in total coverage. Device calibration/credentials are not returned. Maximum
time gap, number of gaps strictly over one hour, and repeated timestamps describe
sampling within the window; window edges are visible through actual coverage dates.
One sample has no gap estimate; simultaneous samples have zero elapsed time and
are ordered by sample ID for deterministic first/last selection. No sampling,
interpolation, inferred expected sampling frequency or stability verdict is applied.

Aggregation runs in PostgreSQL over the owner-bound date window. Raw history remains
available for anomaly inspection. The existing sensor-history index migration also
supports the summary query; no additional schema/migration or database writes are
needed by this fix. It does not summarize manual brew entries.

The failed raw-history provider batch is documented in
[the retest](chatbot-sensor-history-retest.md). Fix evidence and verification are
recorded in [summary implementation](chatbot-sensor-summary-fix.md).

## Shared context size

MCP and hosted use the same compact account responses. Optional manual-reading
fields with no stored value are omitted; an omitted field means no recorded value,
not zero or false. All-null correction objects are omitted. Non-null corrections,
zero/false values, units, timestamps, provenance and truncation warnings remain.
Account `relatedGuidance` retains source, reference status and catalog references;
it no longer repeats `adviceWorkflow` and `recommendedTools` on every read.
Server policy and short tool descriptions retain the search/fetch/cite requirements.
Raw sensor pages, pagination and complete-window sensor summaries remain available.

## Evidence interpretation follow-up

`get_brew_timeline` now returns `gravityChange` alongside the unchanged records
and pagination. It compares only finite, explicitly measured GRAVITY entries in
the returned page, orders their timestamps and reports measurement count,
first/last dated SG, `netChangeSg` (last minus first), and `direction`
(`decreased`, `increased`, `unchanged`, or null when a temporal comparison is
unavailable). Recipe targets, unknown/derived provenance and other entry types
are excluded. Coverage is `returned_manual_page`, never an entire-history or
stability claim; `stabilityAssessment` remains `not_assessed`. For example,
1.100 followed by 1.055 is a decrease, not a value above the starting gravity.

The sensor summary adds `seriesComparison: not_assessed`. Matching aggregate
counts/extrema/endpoints do not establish sample-by-sample equality between
measured and device-calculated series. Raw sample access remains available.

Account `not_found` responses retain that status and now include
`dataAvailability: unknown` and an application-authored explanatory message.
They deliberately do not distinguish a foreign record from a missing record.
Only a successful empty history result establishes no returned samples in the
requested coverage; failed reads cannot establish an empty history. Brew-ID
input descriptions identify the UUID from `list_brews`, rather than a manual
entry, sensor sample or device ID. No account scope or ownership rule changed.

Hosted and MCP share an explicit fetched-evidence instruction for fermentation
completion, stability and readiness-to-rack assessments, including a conclusion
of “not confirmed.” If wiki retrieval fails, disclose the gap and stay with
recorded observations. No runtime forces the model's tool sequence or rewrites
its answer. These changes have deterministic/local verification; model behavior
still requires a separately approved provider retest.


The follow-up activity clarification also adds `activityAssessment: not_assessed`
to manual `gravityChange` and sensor-summary responses. A recorded decrease
establishes change over its dated interval, not ongoing fermentation at the
endpoint or now. This rule is shared by hosted and MCP instructions. The live
three-turn results and the subsequent local-only clarification are recorded in
[reading-evidence retest](chatbot-reading-evidence-retest.md).

## Explicit record association

Successful `get_brew_timeline`, `get_brew_sensor_history` and
`summarize_brew_sensor_history` results carry `brewId`, identifying the requested
owner-checked brew. Nested entry/sample `id` fields are not brew identifiers.
Missing/inaccessible account reads also carry `requestedRecord: {kind, id}`
(`brew` with a UUID or `recipe` with a positive integer). This echoes the validated
input even when the record cannot be retrieved; it establishes neither existence
nor ownership. `dataAvailability` remains `unknown`. See
[record identity follow-up](chatbot-record-identity-fix.md) for verification.
