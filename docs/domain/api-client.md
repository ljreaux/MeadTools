# MeadTools API client boundary

`@meadtools/api-client` is the platform-independent HTTP boundary for MeadTools
companion applications and other API consumers.

The package:

- accepts an injected Fetch-compatible transport and API base URL;
- resolves an optional bearer token for each request without owning credentials;
- uses request and response contracts from `@meadtools/api-contract`;
- validates contract data at runtime where a shared schema exists;
- exposes typed API and contract errors; and
- contains no React, Next.js, Prisma, storage, or authentication state.

The first supported operation is `calculateRecipeDerived`, which calls the
existing `POST /api/recipes/derived` endpoint. The package does not change that
endpoint or the generated OpenAPI document.

The optional `getAccessToken` callback only attaches the current bearer token.
Credential persistence, login, and refresh behavior remain the responsibility
of each platform adapter until companion-app authentication requirements are
defined.
