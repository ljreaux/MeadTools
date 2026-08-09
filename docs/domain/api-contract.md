# Shared API contract

`@meadtools/api-contract` owns the stable runtime request and response schemas
used by MeadTools, the OpenAPI generator, and external TypeScript consumers.
Zod schemas are the source of truth. Public TypeScript contracts are inferred
from them.

## OpenAPI compatibility

Before the Zod migration, `apps/web/public/openapi.json` was regenerated with
`next-openapi-gen` and captured as the endpoint compatibility baseline.

- Paths: 67
- Canonical endpoint-path SHA-256:
  `17093a3520993176a4f681b74166fe4c1a5d839508afbf0f4ba2c0c73c1d1fb8`
- Reviewed Zod document SHA-256:
  `ecc9f8bc4d4ae856dbbdf5562dde24b3ed90b5895fc375ebb4d06d4462415df1`

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

The persistent-chat update intentionally adds `/chat/conversations` and
`/chat/conversations/{conversationId}`. The same path-parity check removes
these private authenticated endpoints before comparing earlier API paths.

The credit-accounting update intentionally adds `/account/credits`,
`/account/credits/checkout`, `/account/credits/history`, and `/webhooks/stripe`.
The same check removes these endpoints while preserving the documented behavior
of every earlier path. It also adds the documented `402` insufficient-credit
response to the private `/chat/recipe` endpoint.

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
