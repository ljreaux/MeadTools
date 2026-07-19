# Shared API contract

`@meadtools/api-contract` owns the stable runtime request and response schemas
used by MeadTools, the OpenAPI generator, and external TypeScript consumers.
Zod schemas are the source of truth. Public TypeScript contracts are inferred
from them.

## OpenAPI compatibility

Before the Zod migration, `apps/web/public/openapi.json` was regenerated with
`next-openapi-gen` and captured as the endpoint compatibility baseline.

- Paths: 54
- Canonical endpoint-path SHA-256:
  `b04650619e96df83b3f5eba864c44cd4599039be01125b2b0b4966aaa068880a`
- Reviewed Zod document SHA-256:
  `b5da53654bc24a9c2b5016f18f5fcbba85864e1b6f2590fe72cbabcc10a6d7af`

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
