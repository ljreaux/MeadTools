# Shared API contract

`@meadtools/api-contract` owns the stable request and response TypeScript
contracts used by the MeadTools OpenAPI generator and external TypeScript
consumers.

## OpenAPI compatibility

Before extraction, `public/openapi.json` was regenerated with
`next-openapi-gen` and captured as the compatibility baseline.

- Raw SHA-256:
  `052fbee2d31a973c1f85a05d897f36d38ed14e851205d3f6129cbe67116f5c82`
- Canonical JSON SHA-256:
  `67cb52730796b39713ef6d29ffb1016b6164741f4740b8e85a832113b5b52a8b`
- Paths: 52
- Component schemas: 284

The canonical hash test sorts object keys before hashing, so harmless object-key
ordering does not hide or manufacture a contract change. Array order and all
values remain significant.

Run:

```sh
npm run openapi:generate
npm run test:api-contract
```

Any mismatch must be reviewed as an API documentation change before updating
the baseline.

## Generator inputs

The generator still uses TypeScript schema mode. It scans both:

- `app/api` for Route Handlers, annotations, and route-local contract types.
- `packages/api-contract/src` for shared contract types.

Both directories are required to reproduce the existing document. Pointing the
generator only at the package omits route-local definitions and changes the
output.

## Zod relationship

The package exports the shared recipe and nutrient Zod schemas through its
`schemas` entry point. Runtime validation can therefore share the same package
boundary as API contracts.

OpenAPI generation remains in TypeScript mode for compatibility. Switching the
generator to reinterpret existing definitions as Zod changes generated
component structure and is not part of this behavior-preserving extraction.
Zod-backed OpenAPI generation can be adopted incrementally only when each
generated component is proven equivalent or an intentional contract change is
approved.
