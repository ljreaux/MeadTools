# Inventory spreadsheet import/export — next implementation pass

Status: implemented locally in the spreadsheet slice following commit `daa5f9d6f`.
The flow includes XLSX/CSV export, a blank Excel template, file inspection,
sheet/header selection, mapping, number formats/defaults, optional source columns
in notes, paged row review, catalog choices, and an atomic audited import with
explicit owned-ID updates. Export remains available after premium expiry.

Current limits: 5 MB upload, 20 MB expanded XLSX, 12 sheets, 1,101 rows and
50 columns per sheet, and 1,000 selected rows per import. The 1,000-row create
fixture completed in approximately 100 ms locally. These are development results,
not production latency guarantees. Existing inventory tables/operation receipts
are reused; this slice needs no schema change or local reset.

The remaining text records the product/verification design. Named platform
presets remain future work until representative source exports are available;
the generic column mapper is implemented.

## Goal and scope

Help brewers move ingredient and packaging inventory from another platform, or an
existing spreadsheet, without retyping their stock. Support `.xlsx` and `.csv`
imports, an Excel export, and a downloadable blank Excel template. Equipment is
outside this pass; its grouped containers and brew assignments need a separate
mapping design.

The current implementation is on
`471-premium-add-ingredient-inventory-and-equipment-management`. Keep using the
regular checkout and current branch, preserve current local test data, and leave
new work uncommitted unless asked. Read AGENTS.md and relevant Next.js docs first.

## Product decisions to carry forward

- Import is a premium inventory mutation. Recommend keeping export available to
  signed-in owners after premium expiry, consistent with retained read access and
  data portability. Export is reachable outside the blurred item list.
- Export the entire active inventory by default, with an explicit filtered-export
  option if useful. Never silently export only the visible page or search result.
- Import creates new stock by default. Never infer a merge from a matching name:
  two identical products can be separate lots. Never add an exported balance onto
  the same existing stock automatically.
- Support deliberate round trips with an explicit "Update existing stock" mode.
  MeadTools stock IDs identify owned existing rows; changing balances uses audited
  absolute corrections, not receipts. Require a reviewed before/after quantity
  and an expected-current-balance check. Unknown/foreign IDs cannot update rows.
- Do not import historical deductions, equipment allocations, premium state, or
  reconciliation flags. An imported starting quantity creates an initial receipt.
  Reconciliation warnings cannot be cleared by an ordinary bulk import.
- Do not commit data until the brewer reviews and confirms the normalized rows.
  Canceling or correcting a mapping makes no stock changes.

## User flow

1. Add labeled Import and Export actions alongside Add stock using the existing
   account UI patterns. Export and template download each need one action.
2. Select a local file. Detect its sheets and header row; allow choosing a sheet
   and header row. Handle UTF-8 BOM, quoted CSV fields, common delimiters and
   blank leading rows. Start with one selected inventory sheet per import.
3. Map source columns into MeadTools fields using shared Select/SearchableInput.
   Suggest mappings from common header names and remember the selection while
   reviewing this file. Source-platform presets can build on this generic mapper;
   obtain representative exports before promising a named platform adapter.
4. Show a preview with row numbers, normalized amounts/units, suggested catalog
   links, duplicate/conflict indicators, row errors and totals. Allow correcting
   mappings and excluding rows. Make "unlinked" a valid intentional choice.
5. Confirm once. The server validates again, checks premium/ownership and current
   balances, then persists the reviewed set with a stable operation ID. Do not
   silently skip invalid rows or partially save a batch. Return a useful summary
   and downloadable row-error report if validation fails.
6. Refresh inventory and history after success. An uncertain response can be
   retried safely with the same operation ID and request fingerprint.

Use one staged flow rather than stacked dialogs. Reuse SearchableInput,
AmountUnitField, InputGroup, Select, Dialog, AlertDialog and LoadingButton where
appropriate. Keep keyboard focus predictable, suggestions closed on initial dialog
focus, and mapping/preview usable at narrow widths.

## Workbook and row contract

Use an `Inventory` sheet with plain headers and one row per stock lot:

| Field | Requirement and behavior |
| --- | --- |
| Name | Required; preserve the brewer's stock name. |
| Category | Required; map to honey, fruit, yeast, additive or packaging. |
| Quantity | Required; finite, nonnegative and within shared precision/range. |
| Unit | Required; use the shared unit normalizer and conversion rules. |
| Notes | Optional; preserve line breaks as text. |
| Catalog type | Optional ingredient, yeast, additive or nutrient namespace. |
| Catalog ID | Optional scoped ID; validate against catalogs/built-in products. |
| Catalog name | Human-readable label for export and migration matching. |
| MeadTools stock ID | Exported for explicit round-trip updates; not needed for migration. |

Include an `Instructions` sheet with format version, examples, supported units,
category meanings and the difference between initial quantity and a purchase.
A `Reference` sheet can list category/unit choices and built-in nutrient,
Go-Ferm and stabilizer identities. Packaging uses whole unit counts; Campden
stock remains an additive and may use partial unit counts.

Treat SKU, brand, lot number, purchase price and expiration columns from other
platforms as source data requiring an explicit mapping. Do not silently discard
important columns: offer to append selected columns to Notes for the first
version. Separate amount and unit columns are canonical; accept combined values
only when parsing is unambiguous and the preview shows the interpretation.

## Matching and validation

- Share normalization, category/unit validation and matching in
  `packages/inventory-domain`; keep workbook parsing outside that domain package.
- Reuse catalog namespace + ID priority, built-in Go-Ferm/stabilizer identities,
  Fuse fallback and known-product mismatch guards. Weak/ambiguous suggestions
  must be visible and editable. Never silently choose between linked lots.
- Validate catalog references on the server with the same rules as stock create
  and details editing. Do not create additive catalog database rows just to
  represent built-in nutrients or stabilizers.
- Show localized numbers, but parse file numbers deliberately. Detect decimal
  comma versus thousands separators using an explicit format selection when
  ambiguous. Distinguish empty cells from zero and reject formulas/errors where
  a literal quantity is required.
- No density conversions, packet-to-gram assumptions, tablet-to-powder conversion,
  or bottle-count inference from volume. Surface incompatible units by row.
- Preserve six-decimal stock precision and whole-unit packaging validation. Reject
  negative, nonfinite, oversized or precision-losing values with useful messages.
- Flag duplicate source rows and existing matches without collapsing legitimate
  separate lots. Exact owned stock IDs can support an explicit update; names alone
  cannot authorize one.

## Implementation sequence

1. **Choose the parser and define contracts.** Inspect current dependencies, then
   evaluate a maintained `.xlsx` reader/writer for licensing, security, bundle size
   and deployment support. Do not assume the popular npm package is current.
   Lazy-load browser parsing only if it improves the preview; server validation
   remains authoritative. Define versioned portable rows, mapping and error types.
2. **Export and template.** Build workbook generation and CSV text handling, wire
   owner-scoped read-only export, and verify exported quantities/catalog links can
   be read back without losing precision or changing names.
3. **Import preview.** Build file/sheet/header selection, column mapping, row
   normalization, catalog suggestions and conflict/error review without writes.
4. **Confirmed persistence.** Add a server operation for an atomic reviewed import
   and explicit audited updates. Reuse account serialization, ownership checks,
   operation fingerprints and ledger rules in `apps/web/lib/db/inventory.ts`.
   Use efficient bulk writes and measure the transaction duration before choosing
   limits; do not call the stock-creation API separately for every row.
5. **Migration polish.** Add column aliases and presets using real example exports,
   a downloadable error report, clear recovery after a failed upload, and examples
   in the seed/test fixtures. Add equipment only in a later requested pass.

Start with conservative, documented file/row/cell limits sized from measured
transaction performance. Validate compressed workbook expansion as well as upload
size. If realistic files exceed a safe atomic transaction, design resumable jobs
explicitly rather than introducing silent partial imports.

Every API change requires runtime schemas in `packages/api-contract`, generated
contracts/OpenAPI and the standard verification commands from
`docs/domain/api-contract.md`. Do not hand-edit generated contracts. A schema change
requires a reviewed Prisma migration; do not reset the current local database
without new authorization. Use the existing development server for browser work.

## File safety and verification

Treat workbook contents as untrusted data. Do not execute macros, formulas,
external links, embedded objects or external data connections. Reject unsupported
formats clearly. Export user text as literal cells, and neutralize CSV formula
prefixes without corrupting canonical stock names. Keep account-scoped IDs and
stock data private; avoid logging uploaded contents or storing source files longer
than needed. Enforce file/row/cell limits on both preview and server boundaries.

Deterministic fixtures should cover:

- Canonical workbook export/import round trip, Unicode, multiline notes and zeros.
- Reordered/extra headers, alternate sheets/header rows, BOM, delimiters, quoted
  CSV, decimal commas, missing values and mixed categories/units.
- All Go-Ferm variants, nutrients, stabilizers, packaging and catalog-free stock.
- Separate identical lots, duplicate source rows, explicit owned-ID updates and
  foreign/unknown IDs; stale balance and reconciliation conflicts.
- Wrong chemical matches, weak Fuse suggestions, incompatible dimensions,
  fractional bottles, partial Campden tablets and precision/range errors.
- Premium expiry between preview and confirmation, operation replay after an
  uncertain response, concurrent stock changes and rollback after a late failure.
- Oversized/malformed files, workbook formulas/macros/external links and literal
  text that resembles a spreadsheet formula.

Use disposable Postgres fixtures for writes. Browser-check file selection,
column mapping, error correction, cancellation, confirmation, resulting balances
and history, read-only export, mobile layout and keyboard focus. Never use a
production account or an external platform login just to obtain a test file.
