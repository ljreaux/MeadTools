# Shared brew domain

`@meadtools/brew-domain` owns pure brew projection and scaling behavior that is
shared by the MeadTools web application and future companion clients.

## Current responsibilities

- Project database-shaped brew data into the stable, read-only brew view.
- Remove authorization, alert, device, and other server-only fields from that
  view.
- Normalize dates to ISO strings and supply established defaults for omitted
  collections and nullable fields.
- Calculate batch-to-recipe scaling ratios.
- Scale unlogged secondary ingredient and additive suggestions using the
  existing editable-amount rounding rules.
- Construct note, reading, volume, packaging, addition, and estimated-ABV entry
  payloads with the established defaults and metadata.
- Define read-only brew capabilities.

## Boundaries

The package contains no React, Next.js, Prisma, database, authorization,
storage, or platform-specific code. Inputs are structural transfer types rather
than Prisma models. Recipe snapshots are opaque generic values: projecting a
brew preserves the snapshot but does not interpret it. Entry payload inputs
use structural transfer types rather than importing React hook or calculator
component types.

Database queries, ownership checks, private-recipe access, mutations, and
Route Handler response decisions remain in the web/API application.

Compatibility modules under `lib/` and `types/` re-export the package API so
existing callers retain their current import paths while the extraction settles.

## Verification

Projection tests prove that server-only fields cannot leak into serialized
views. Scaling parity tests cover valid ratios, invalid boundaries, filtering
of logged rows, amount rounding, and empty results. Entry payload tests lock
existing titles, defaults, linkage metadata, and measurement shapes. Run:

```sh
npm run test:brew-domain
npm run typecheck --workspaces --if-present
```
