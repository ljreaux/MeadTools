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

Supported operations are:

- `calculateRecipeDerived`
- `listRecipes`, through the authenticated account-info endpoint
- `listBrews`
- `getBrew`
- `createBrewEntry`

Every successful response is checked against the same Zod schema used by the
OpenAPI contract. Invalid request payloads are rejected before the transport is
called.

`createBrewEntry` accepts an optional `client_entry_id` UUID. Offline-capable
clients should generate one UUID when an entry is first queued and reuse it for
every retry. The server uses it as the entry resource ID, so repeated uploads
resolve to the original entry instead of creating duplicates.

The optional `getAccessToken` callback only attaches the current bearer token.
Credential persistence, login, and refresh behavior remain the responsibility
of each platform adapter until companion-app authentication requirements are
defined.
