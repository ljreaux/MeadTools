# Shared runtime schemas

`@meadtools/schemas` is the runtime source of truth for data transferred between
the MeadTools web/API application and future mobile, desktop, and MCP clients.

## Current schemas

- `recipeDataV2Schema` validates complete version 2 recipe data.
- `nutrientDataV2Schema` validates complete version 2 nutrient settings and
  inputs.
- Supporting schemas define units, ingredient lines, additives, notes,
  nutrient schedules, and selected nutrients.

TypeScript types are inferred from the schemas and exported with them. Static
types help during compilation; Zod schemas validate untrusted values at
runtime.

## Boundary with Prisma

These schemas describe transfer and persisted JSON data, not database rows.
Prisma models remain private to the web/API application. Native clients must
not import Prisma-generated types or assume that database columns are public
API fields.

## Versioning

Recipe and nutrient schemas currently require `version: 2`. A future format
must receive its own schema and an explicit migration path rather than
silently widening the v2 contract.

Legacy recipe removal is intentionally separate from this extraction. Before
removing v1 readers or database fields, production data must be inventoried and
migrated, and all fallback paths must be identified.

## Adoption

The existing `isRecipeData` compatibility guard delegates to
`recipeDataV2Schema`. This means current Route Handlers now validate nested
recipe and nutrient fields while retaining their existing interface.

Unknown object properties remain accepted during this compatibility phase,
matching the previous guard's forward-tolerant behavior. Parsing returns the
known schema shape; callers that need to preserve the original object should
use validation as a guard rather than replacing it with parsed output.
