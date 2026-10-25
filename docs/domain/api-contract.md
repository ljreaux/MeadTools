# Shared API contract

`@meadtools/api-contract` owns the stable runtime request and response schemas
used by MeadTools, the OpenAPI generator, and external TypeScript consumers.
Zod schemas are the source of truth. Public TypeScript contracts are inferred
from them.

For the implemented hosted-chatbot product, access, persistence, billing, and
operations architecture, see
[Hosted chatbot architecture](../hosted-chatbot-architecture.md). This document
defines the contract process and endpoint compatibility, not chatbot behavior.

The hosted orchestration comparison originally added a server-controlled setting.
The selected model-led loop is now the only implementation; guided orchestration
and `CHATBOT_ORCHESTRATION` have been removed. This does not add client request
fields or change chat response shapes, statuses or confirmation contracts.
Contract/OpenAPI generation and API-contract checks verify the route wiring.

## OpenAPI compatibility

Before the Zod migration, `apps/web/public/openapi.json` was regenerated with
`next-openapi-gen` and captured as the endpoint compatibility baseline.

- Paths: 67
- Canonical endpoint-path SHA-256:
  `17093a3520993176a4f681b74166fe4c1a5d839508afbf0f4ba2c0c73c1d1fb8`
- Reviewed Zod document SHA-256:
  `dfb7f887be5ebb8050dd761c6274668741026ef40b94b21f487a696dad197c42`

The parity test preserves the complete pre-migration `paths` object: routes,
methods, parameters, descriptions, response statuses, and component references.
Zod now generates the component schemas, including explicit required and
nullable semantics, so the full document has a separately reviewed baseline.
The canonical hashes sort object keys; array order and all values remain
significant.

The native API readiness update intentionally adds `client_entry_id` to
`CreateBrewEntryRequestBody` and HTTP 409 documentation to the create-entry
operation. The nutrient-preset update intentionally adds the
`/nutrient-presets` endpoint. The endpoint parity test removes these approved
additions before comparing against the pre-migration paths hash, proving all
earlier endpoint documentation remains unchanged.

The mobile brew overview update makes recipe snapshot metadata optional so
legacy snapshots can still be read, while consumers validate `dataV2` before
calculating targets. Authenticated `GET /brews/{brew_id}` now returns the
documented `Brew not found` error with HTTP 404 for an unavailable brew.

The direct-brew update permits creating a brew from an owned or currently public
recipe and adds an explicit snapshot refresh to brew metadata updates. Snapshot responses retain
source attribution and prior snapshots. The parity test normalizes the approved
brew route descriptions and status additions before checking older paths.

The persistent-chat update intentionally adds `/chat/conversations` and
`/chat/conversations/{conversationId}`. The same path-parity check removes
these private authenticated endpoints before comparing earlier API paths.

The credit-accounting update intentionally adds `/account/credits`,
`/account/credits/checkout`, `/account/credits/history`, and `/webhooks/stripe`.
The same check removes these endpoints while preserving the documented behavior
of every earlier path. It also adds the documented `402` insufficient-credit
response to the private `/chat/recipe` endpoint.

The monthly-release update adds authenticated `GET` and `PATCH`
`/account/release-emails` endpoints for one default-off product-update email
choice. The response also says whether the user has answered the one-time
prompt. The path-parity test removes this approved addition before comparing
the earlier route set.

The unsubscribe follow-up adds unauthenticated `POST`
`/release-emails/unsubscribe` with a signed account token. A GET of
the linked page never changes consent, so email link scanners cannot opt users
out accidentally. The parity test removes this approved path as well.

The automated product-update follow-up adds the internal cron-authenticated
`GET /cron/product-updates` endpoint. It returns aggregate batch counts without
recipient details. Cron routes are deliberately excluded from public OpenAPI
by `apps/web/next.openapi.json`.

The chat-beta access update intentionally adds `/chat/access` and the
admin-only `/admin/chat-access` access and credit-grant endpoints. The same
check removes these private endpoints while preserving the documented behavior
of every earlier route.

The payment-recovery update intentionally adds the admin-only
`/admin/chat-access/payment-recoveries` read and resolution endpoints. They
record and resolve refunds or disputes after verified provider webhooks; the
same path-parity check removes them before comparing the earlier route set.
For Stripe disputes, each recovery response also includes a server-derived
Stripe Dashboard URL so an administrator can review or resolve the case before
recording the corresponding credit decision in MeadTools.

The chat-operations update intentionally adds the admin-only
`/admin/chat/usage` reporting endpoint. It returns aggregate operational and
per-user cost data from immutable usage and credit-ledger records; it does not
return chat transcripts or provider prompt payloads. The same path-parity check
removes this endpoint while preserving the documented behavior of every earlier
route.

The optional loss update adds estimated post-transfer primary volume,
primary loss volume and percentage, secondary loss volume and percentage, and
estimated bottling volume to the derived recipe response's volume object.
Existing recipe inputs may omit `lossAdjustment`, which preserves all prior
calculation results. Secondary loss is an optional, default-off manual
percentage and affects only bottling yield. The reviewed OpenAPI diff adds
these required derived-volume fields.

The premium groundwork adds authenticated `GET /account/premium` and Ko-fi
account-link `POST` routes, plus `POST /webhooks/kofi` for verified recurring
payment receipts. Local premium testing also adds authenticated Stripe
subscription Checkout and Billing Portal `POST` routes and processes signed
subscription events on the existing Stripe webhook route. New subscription
Checkout remains behind `PREMIUM_SUBSCRIPTIONS_ENABLED`, which is unset in
production. Remote MCP access remains disabled until its launch gates are
complete. The path-parity test removes these additions before comparing the
pre-Zod endpoint baseline.

The MCP follow-up adds authenticated `GET` and `POST`
`/account/premium/mcp/tokens` and `DELETE`
`/account/premium/mcp/tokens/{id}` for account-owned connection credentials.
The generated OpenAPI document includes only these account API routes; the
Streamable HTTP `/mcp` resource and OAuth discovery/authorization endpoints
live outside `app/api` and follow their respective protocols. The parity test
removes the new account paths before comparing the earlier endpoint baseline.

The premium/MCP lifecycle follow-up documents the existing explicit HTTP 500
responses on Ko-fi linking/claiming and webhooks, MCP connection listing/creation,
and Stripe subscription Checkout/Portal routes. Recovery administration also
supports premium invoices: its existing `packId` identifies these sources as
`premium:<invoice_id>`, with the included allowance in `packCredits`. Response
shapes remain unchanged. The regenerated OpenAPI baseline includes only those
additional error statuses.

Chat contract ownership is split by concern: `zod/chat.ts` owns private thread,
transcript, context, and conversation schemas; `zod/credits.ts` owns wallet,
activity, Checkout, and webhook receipts; and `zod/admin.ts` owns rollout,
grant, recovery, and usage-report schemas. The streaming `/chat/recipe` route
uses the TanStack chat transport plus the documented insufficient-credit `402`
response; its durable thread state is loaded through the conversation routes.

Credit activity operation IDs accept canonical PostgreSQL UUID strings,
including the deterministic hash-derived IDs used for Stripe and Ko-fi Premium
allowances. These existing IDs do not require RFC UUID version/variant bits.
Wallet responses and pagination cursors use the same validation, preserving
ledger identity and grant idempotency without rewriting historical entries.

Credit activity includes optional nullable `grantSource` (`premium` or `beta`).
The server derives Premium allowances from existing Stripe/Ko-fi grant metadata;
legacy grants without a recognized Premium source retain the beta category.
Non-grant activity returns null. The optional field preserves compatibility
with earlier responses and does not expose ledger metadata or provider IDs.

Run:

```sh
npm run contracts:generate
npm run openapi:generate
npm run test:api-contract
```

Any mismatch must be reviewed as an API documentation change before updating
the baseline.

## Generator inputs

The inventory brew-entry integration adds optional `inventory` selections to
POST/PATCH and an optional DELETE body on brew entries. Deduct mode requires a
stable operation UUID and stock UUID; corrections/removal include the prior
deducted stock quantity. Existing untracked requests remain valid, and mutation
responses add an optional inventory outcome beside the existing result. No stock
identities are added to public brew entry data. The three entry operations now
document typed 400/403/404/409 failures, including stock shortages and stale
deductions. The path parity check normalizes these reviewed entry changes before
comparing the earlier routes. DELETE's optional body is restored by the OpenAPI
normalizer because the generator omits DELETE bodies. Imported inventory quantity
definitions are rendered from the runtime Zod schemas so unit enums and numeric
limits cannot degrade into unresolved references or generic object schemas.

Equipment management adds authenticated `GET`/`POST /account/equipment` and
`PATCH /account/equipment/{equipment_id}`. Reads include `can_manage`, retained
equipment and ongoing owned brew choices. Mutations require premium and a stable
operation UUID. PATCH discriminates `edit`, `assign` and `archive`; assignment
includes the expected prior brew and an explicit reassignment choice. Conflicts
return typed 409 errors, foreign records return 404, and expired accounts retain
read-only access. The normalizer renders these schemas from runtime Zod to keep
shared equipment capacity units and request defaults intact. The path-parity
check excludes only these approved new paths; older endpoint docs are unchanged.

Ingredient and packaging stock management adds authenticated `GET`/`POST /account/inventory`
and `GET`/`PATCH /account/inventory/{stock_id}`. Overview returns `can_manage`
and owned nonarchived stock. The category enum includes `packaging`; packaging
accepts only whole `units` counts, never volume-to-bottle conversion. Item reads include up to 100 recent adjustments
and `has_more`; retained archived history remains readable. Premium mutations
use stable operation UUIDs. Balance changes require `expected_balance`; PATCH
chooses receipt, manual use, absolute correction or archival. Typed 400/403/404/
409 failures preserve the existing inventory error codes. Runtime normalization
retains shared unit enums and quantity limits, and path parity excludes these
approved additions while preserving earlier endpoint documentation.

The OpenAPI generator uses Zod schema mode. It scans:

- `apps/web/app/api` for Route Handlers and their OpenAPI annotations.
- `packages/api-contract/src/zod` for runtime schemas.

`scripts/normalize-zod-openapi.mjs` then preserves the established PascalCase
component names and restores the generator's reviewed operation-parameter
metadata from `packages/api-contract/openapi-parameters.json`. This compatibility
step is necessary because the current Zod mode does not emit those annotated
path and query parameters.

## Adding or changing a contract

1. Add or update the named `*Schema` export in
   `packages/api-contract/src/zod`.
2. Run `npm run contracts:generate` to regenerate inferred public types and
   OpenAPI aliases.
3. Add schema acceptance and rejection tests.
4. Run `npm run openapi:generate` and review any documentation diff.
5. Run `npm test` and workspace typechecks.

Do not edit `src/contracts.ts` or `src/zod/openapi-aliases.ts` by hand; both are
generated. The package's domain subpaths export the runtime schemas directly,
while `@meadtools/api-contract/contracts` retains the existing TypeScript type
surface for consumers.

The private-MCP authorization groundwork adds optional boolean `accountRead`
to personal-token creation (omission means false), and reports it on credential
listing and creation responses. This is a permission disclosure, not an
account-data REST API. Existing credentials default to seven-tool access; only
an explicit new grant enables the private-read capability. The reviewed
OpenAPI diff is limited to these MCP credential schema properties.

The RAPT Brew Stream compatibility update adds optional query-token authentication
to `/hydrometer/rapt-pill/cloud` and accepts nested telemetry envelopes alongside
legacy flat payloads. Its 400 response also covers invalid payloads. The parity
test normalizes these approved route changes before comparing earlier paths.

### Live answer previews

The chat SSE transport now also emits the optional custom event `recipe.answer`.
Its shared `@meadtools/chat-domain` schema accepts `{type:"answer_delta",delta}`
and `{type:"answer_reset"}`. These are transient display updates, not persisted
messages or permission to save a draft. A reset discards an intermediate tool-step
preamble. `recipe.turn` and the final TanStack text message remain authoritative
and are emitted after persistence/accounting. Clients may ignore preview events.
Errors, cancellation or the next turn discard previews. Existing request/response
schemas, statuses, durable messages and confirmation contracts are unchanged.

The existing `recipe.tool` SSE events may also include optional `detail`, validated
by `chatToolProgressDetailSchema`. This allowlisted object contains a bounded
subject, item count, cached-result flag, safe issue category, optional HTTP status
or missing-field categories. It never contains raw arguments, record IDs, source
bodies or exception messages. Old clients can ignore it. These details describe
a tool step, not a terminal request failure or permission to mutate records.

The inventory component follow-up adds premium-only
`POST /brews/{brew_id}/entries/batch`, which atomically saves reviewed additions
and all stock uses. The operation and each entry have stable IDs for retries.
The `items` inventory mode identifies each nutrient/packaging line and includes
all previous deduction snapshots for optimistic concurrency checks. Private brew
inventory context includes line keys/names and tracked entry IDs. Stock PATCH
also supports a `details` action for names, notes and optional catalog links;
quantities and units remain unchanged. These additions are included in generated
contracts and OpenAPI, with the batch path excluded from legacy path parity.

Inventory spreadsheet transfers add `POST /account/inventory/transfer` with
`inspect`, `import` and `export` actions. Inspection accepts bounded base64 XLSX
or UTF-8 CSV and returns literal sheet rows for mapping. Import accepts reviewed
normalized stock rows with a stable operation ID; explicit updates use owned
stock IDs and expected snapshots, while new rows retain separate lots. Inspection
and import require premium; owner-scoped export/template download does not.
Responses include sheet data, a base64 file or import counts. Row failures identify
the source row; file limits use HTTP 413. The route is excluded from historical
path parity and documented using runtime schemas and generated contracts.
