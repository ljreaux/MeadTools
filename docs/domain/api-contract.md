# Shared API contract

`@meadtools/api-contract` owns the stable runtime request and response schemas
used by MeadTools, the OpenAPI generator, and external TypeScript consumers.
Zod schemas are the source of truth. Public TypeScript contracts are inferred
from them.

For the implemented hosted-chatbot product, access, persistence, billing, and
operations architecture, see
[Hosted chatbot architecture](../hosted-chatbot-architecture.md). This document
defines the contract process and endpoint compatibility, not chatbot behavior.

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

Chat contract ownership is split by concern: `zod/chat.ts` owns private thread,
transcript, context, and conversation schemas; `zod/credits.ts` owns wallet,
activity, Checkout, and webhook receipts; and `zod/admin.ts` owns rollout,
grant, recovery, and usage-report schemas. The streaming `/chat/recipe` route
uses the TanStack chat transport plus the documented insufficient-credit `402`
response; its durable thread state is loaded through the conversation routes.

Run:

```sh
npm run contracts:generate
npm run openapi:generate
npm run test:api-contract
```

Any mismatch must be reviewed as an API documentation change before updating
the baseline.

## Generator inputs

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
