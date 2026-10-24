# Inventory and equipment — issue 471

Tracking: [#471](https://github.com/ljreaux/MeadTools/issues/471), launch integration
[#474](https://github.com/ljreaux/MeadTools/issues/474).

## Implementation status

The first implementation adds `@meadtools/inventory-domain`: shared stock and
equipment input schemas, quantity conversions, owned catalog matching, stock
receipt/manual use/correction calculations, linked-consumption difference and
reversal calculations, vessel occupancy transitions, and access capabilities.
Deterministic tests exercise these calculations without a database or provider.

The next slice adds Prisma models and migration
`20261024000000_add_inventory_equipment` for stock, account-scoped retry
operations, consumption links/tombstones, adjustment history, equipment and
assignment history. Seed cleanup removes those records in foreign-key order.
PostgreSQL regression checks apply the migration to a disposable database built
from the prior Prisma schema and verify quantity/capacity checks, ownership,
retry uniqueness, historical retention and deletion restrictions.

The stock transaction adapter now supports stock creation with an initial receipt,
receipts/manual use/absolute corrections, and linked ADDITION creation, correction,
stock reassignment and erroneous-use removal. PostgreSQL tests exercise actual
concurrent transactions, request replay, rollback at the audit write, shortages,
ownership, entitlement, stale edits, tombstones and historical brew deletion.

The brew-entry POST/PATCH/DELETE routes now call the inventory gateway. Optional
`inventory` selections choose a specific stock deduction or an untracked use;
legacy requests remain valid for untracked entries. Responses include an optional
inventory outcome beside the existing brew/entry/message, never in public entry
data. The full API contract and generated OpenAPI describe these choices, typed
errors and the optional DELETE body. Handler/database tests cover this wiring
with only the account authentication boundary stubbed.

This is a foundation, not a shipped feature. Equipment transaction adapters,
stock-management routes, matching/reconciliation UI and account management UI are
still required. The current browser UI does not yet offer inventory selection,
and legacy summary entry types still need normalization. The complete Preview
flow remains unverified. Larry reset and seeded local development
and confirmed the new tables on October 24; the production migration remains
unapplied to hosted environments. This transaction slice adds no schema changes.

### Stock transaction adapter

`apps/web/lib/db/inventory.ts` exposes a server-only service. Each operation locks
the account row, checks the existing account premium decision within the same
transaction, and then locks the owned brew/entry and stock in order. Account
serialization protects both existing rows and absent retry/use identities; this
deliberately trades per-account parallelism for simple, reliable local ordering.
It must be used by every inventory mutation; direct Prisma writes bypass it.

The account + operation key identifies a request. The adapter hashes the complete
normalized request with sorted JSON keys and stores its response with the ledger
write. A replay returns that saved response without running the entry writer;
reusing the key with changed content fails. A failed transaction saves no retry
record and may be retried after the shortage/failure is resolved. A replay returns
the historical operation response, so clients should refresh current stock after
later operations. Absolute corrections require the expected prior balance, and
usage edits/removal require the expected prior stock/deduction to reject stale
forms rather than overwriting intervening changes.

For linked usage, the server caller supplies the complete entry mutation for
fingerprinting and a trusted writer callback that uses the supplied transaction
to create/update/delete the entry and its derived brew data. The adapter checks
the persisted ADDITION identity and amount against the intended deduction before
committing. Callback, balance, consumption/tombstone, operation and audit writes
commit together or all roll back. No network work belongs inside the callback.
The first supported path has one confirmed physical use per ADDITION, with entry
ID as the stable use key; summary events and multi-use entries still need explicit
normalization during brew integration. Do not call it in addition to an existing
independently committed entry mutation.

Archived stock cannot receive new consumption or manual changes; an erroneous
existing use may still be reversed to that archived stock. Audit rows are only
inserted, never edited, and a zero stock movement creates no audit row. Stock
selection is explicit here; the usage UI must use shared matching and resolve
ambiguity/untracked uses before invoking the adapter. Expired/free logging uses
the gateway's non-deduction path; explicitly requesting a premium deduction is
rejected rather than silently pretending a deduction occurred.

### Brew-entry API integration

`inventory: {mode: "deduct", operation_id, stock_id, expected}` is opt-in.
Creates require a client-generated `client_entry_id` and an ADDITION amount/unit.
Edits submit the complete replacement addition data and the prior stock/deducted
quantity in `expected`; erroneous-use deletion submits the same expected state
in its optional JSON body. `operation_id` must remain stable across a request's
retries and change for a new edit. Existing logging unit aliases (`lbs`, `liters`,
`ml`, `quarts`, `fl oz`) normalize through shared logic. One ADDITION is one
physical use; quantities in summary event types do not independently deduct.

Omitting inventory or selecting `{mode: "untracked"}` keeps new/untracked uses
free of stock changes. An active premium account must explicitly confirm the
expected deduction when replacing a linked entry's data or deleting it; an old
client cannot bypass this with an untracked request. Metadata-only changes remain
available without a new inventory selection. The existing derived gravity,
volume and ABV writes execute inside the same transaction callback.

After expiry/payment restriction/feature disablement, ordinary brew edits and
deletion remain available. Editing/removing a previously linked use keeps its
recorded balance and link unchanged, sets the stock's reconciliation flag and
returns `reconciliation_required`. A missing entry with a retained link cannot
be recreated by a legacy retry. On renewal, flagged stock rejects deductions
with HTTP 409 instead of silently backfilling offline changes. Resolving that
flag and establishing new link baselines still needs the reconciliation workflow
before launch; a manual quantity adjustment does not silently clear it.

HTTP 400 represents malformed requests/units or incompatible selections; 403
denies explicit deductions without premium; 404 hides unavailable owned records;
409 covers shortages, stale expectations, retry conflicts and required review.
Shortage errors expose only the missing amount/unit. Unexpected persistence
errors remain generic server failures. The route tests exercise these responses,
request parsing, legacy bodyless DELETE and PostgreSQL writes without a server,
provider calls or application env files.

Run the deterministic adapter fixture using
`npm run test:inventory-transactions-postgres --workspace @meadtools/web` with an
explicit connection to the disposable local
`meadtools_inventory_transactions_test` database, initialized with the prior
schema and the inventory migration. The script rejects other database names,
does not load application env files and truncates only that test database.

### Database verification and limits

`apps/web/prisma/tests/inventory-constraints.sql` requires the dedicated
`meadtools_inventory_schema_test` database and rolls back its fixture data.
After provisioning that disposable database and applying the baseline schema
plus the new migration, run it using `psql -X -v ON_ERROR_STOP=1` with `-f`
pointing to that file. It must never be run against the development database.

Production migration SQL includes CHECK constraints Prisma cannot express. A
local `db:push` creates the modeled types, tables, foreign keys and unique
indexes; shared validation must enforce the extra checks locally. Do not switch
the development database to migration-history setup to obtain these constraints.
PostgreSQL rounds numeric input to six places; callers must validate precision
before writing, using the shared schemas.

Consumption brew/entry IDs and assignment event brew IDs are historical
snapshots without cascading foreign keys. Live equipment assignment uses a
compound brew/owner foreign key. The stock adapter verifies and locks an owned
brew/entry before creating consumption. Brew integration must explicitly release
equipment before deleting a brew. Reversed consumption rows remain as tombstones; do not
delete and recreate them on retries. When changing the matched stock, adjustments
retain their original stock/unit while the consumption link records the new
deduction. Referenced stock units cannot be changed in place.

The schema permits only one current brew per equipment row. Completed-brew
checks and explicit conflict/reassignment checks remain equipment adapter
responsibilities. Append-only audit behavior, stock balance/adjustment consistency
and request hash comparisons are enforced by the stock adapter. Database
uniqueness alone does not implement them.

## Agreed access policy

Confirmed with Larry on October 24, 2026: after premium expiry, retain inventory,
equipment and history as read-only. Existing free brew access and logging continue
without deductions. Every new usage must visibly indicate that inventory was not
updated. Never silently delete retained records or backfill deductions on renewal.

Use the existing `getPremiumAccessStatus` account decision, including account
activity, payment restrictions and `PREMIUM_ACCESS_ENABLED`. Domain capabilities
consume that resolved decision; they do not create another entitlement system.
Reads still require authenticated ownership and an active account. Every stock,
equipment and assignment mutation requires `canManage` at the server boundary.
Completion/deletion may release vessel occupancy as part of a free brew operation.

Keep the balance history accurate about what was actually recorded: usage while
inventory is unavailable has no stock adjustment. The UI must distinguish a
recorded balance from physical stock that needs reconciliation after untracked
usage. Corrections of previously linked uses during expiry must not silently
modify retained balances; integration must retain the original link/audit snapshot
and mark the record for reconciliation. Do not replay these changes on renewal.
The exact reconciliation UI is still part of integration work.

## Quantity and matching rules

- Share existing core mass/volume conversion factors; US and imperial volumes
  remain distinct. Add mg, US teaspoons/tablespoons and unit counts. No mass to
  volume, packet to grams, or density-based conversion. The adapter must normalize
  existing spellings such as `lbs`, `liters`, `ml` and `quarts` explicitly.
- Quantities range from zero through one billion with six fractional digits in
  the stock item's chosen unit. Conversion rounds once to that precision. A
  nonzero use that would round to zero requires a finer stock unit or explicit
  logging without deduction. Show the rounded deduction before confirmation.
- Store the amount actually deducted in the stock unit on the link. Reversal
  uses that snapshot, not a recipe or recalculated conversion. Do not change a
  stock item's unit while it has linked consumption/history without an explicit
  atomic migration of all quantities.
- Match only owned catalog namespace + ID. A recipe line ID is not a catalog ID.
  Multiple stock records with the same identity require selection. Missing catalog
  identities require explicit selection or logging as untracked; names are never
  an automatic match. Matching does not guarantee compatible quantity units.
- Insufficient stock fails the entire linked usage write. Show the shortage and
  allow adding/correcting stock or explicitly logging without deduction. No
  automatic negative balance or partial deduction.

## Existing usage paths audited

- `apps/web/app/[locale]/account/brews/[brew_id]/page.tsx`: `addAddition`
  creates `ADDITION` with kind `INGREDIENT`, `NUTRIENT`, `YEAST` or `OTHER`.
  `addAdditions` submits initial uses sequentially. Each confirmed initial use
  needs a stable client ID and its own inventory decision across retries. If one
  fails, keep successful IDs and show exactly which additions remain unsaved.
- `PrimaryStagePanel.tsx` records recipe nutrients, Go-Ferm and manual nutrients
  through those additions. Subsequent ingredient/additive panels use the same
  addition callback. Preserve catalog identity separately from recipe line IDs.
- The entry enum/API also accepts `NUTRIENT`, `STABILIZATION` and
  `BACKSWEETENING`. These must normalize into the same confirmed-use representation
  before deductions; never deduct both a summary event and its child additions.
  Define a stable use ID per physical use if more than one entry represents it.
- `createBrewEntryForApp` already uses `client_entry_id` with insert-once behavior.
  Its callback currently returns identity without whether insertion occurred.
  Stock adjustment must use the persisted link and stored entry, not blindly
  apply the retry's request payload after `skipDuplicates`.
- `patchBrewEntryForApp` replaces entry data; apply only the change from the
  persisted deduction. `deleteBrewEntryForApp` corrects an erroneous use and must
  reverse once inside its transaction. Preserve a tombstone/idempotency record
  so retrying a deleted entry cannot recreate the original deduction.
- `createBrewForApp`, recipe edits, snapshot refresh and stage metadata changes
  do not represent physical ingredient use. They must not deduct stock.
- `deleteBrewForApp` deletes the historical brew. Preserve consumption audit
  snapshots and balances while releasing occupancy; deleting a historical brew
  must not call the erroneous-use reversal operation.

## Persistence and integration requirements

1. Add account-owned stock, immutable adjustments, consumption links, equipment,
   and reviewed Prisma migration SQL. Use decimal quantities matching the shared
   precision, database nonnegative constraints and owned foreign keys. Archive
   referenced stock rather than cascading away adjustment history.
2. Give receipts/manual adjustments/corrections stable operation IDs with unique
   account-scoped constraints. Retain request fingerprints to reject reuse of an
   operation ID with a different request. Bind consumption to stable physical-use
   identity; retain deletion tombstones. Retried creates return the saved result.
3. In a transaction, lock the owned brew/entry, affected stock and consumption
   rows in a consistent order. Read current state under those locks, calculate
   with this package, and persist entry, link, balance and immutable adjustment
   together. Roll back all changes on shortage or any other failed write. Use a
   deterministic lock order when switching stock; atomically reverse the old
   link and create the new one. Never independently commit either side.
4. Lock equipment and brew consistently for assignment/completion/deletion.
   Each vessel has at most one current brew; a brew may occupy multiple vessels.
   Reassignment must be explicit. Completion/deletion releases all owned vessels;
   historical timeline changes alone do not consume stock. Assignment to a
   completed brew is rejected. Preserve assignment history in the adapter.
5. Wire authenticated APIs to ownership + entitlement checks, then generate and
   review contracts/OpenAPI per `docs/domain/api-contract.md`. Add PostgreSQL
   regression tests for duplicate/concurrent requests, failure rollback, expiry,
   entry correction/deletion, historical brew deletion and vessel conflicts.
6. Add English UI strings in Git, inventory/equipment management and matching/
   deduction confirmation to every confirmed-use path. Verify the complete flow
   on Preview with premium/free/expired/foreign/public accounts. Keep new paid
   subscriptions closed through the November 2 deployment; activation remains
   November 9 under #474.
