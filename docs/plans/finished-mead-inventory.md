# Inventory before and after brewing — issue 479

Inventory supports consumables before brewing and finished meads after bottling.
Users choose how to organize their collection; a visible entry is not a required
lot, batch, vintage, or bottling session. Each phase ends with local verification,
a local commit, and a pause for Larry's review before the next phase starts.

## Phase 1: manage the bottles already on hand

Implemented for review on October 26, 2026. Validation passed: 37 shared inventory
tests, 53 API contract tests, 71 PostgreSQL transaction/handler tests, 3 translation
tests, workspace typechecks, targeted lint, and the migration constraint checks.
Browser checks on the existing local database covered create, mixed sizes,
receipts into existing/new capacities, shortage recovery, bottle use, absolute
correction, history/notes, persistence, keyboard selection, and a 390 px mobile
dialog. The temporary preview used the webpack development mode after the default
compiler took unusually long on the new endpoint. No local data reset was used.

Review focus: does an entry feel like the user's chosen grouping, are the bottle
counts clear, and do Add bottles / Use bottles / Correct count describe the right
actions? Storage, custom label/filter pills and multiple sorting rules belong to
Phase 2 and have not started.

Experience: open Inventory, choose Finished meads, and add a named entry with one
or several bottle sizes. Add more bottles to that entry, use or gift bottles,
correct a count, edit its name/notes, and inspect changes across sizes. Names may
describe a batch or a broader collection. No recipe, brew, date, or lot is required.

Keep Consumables and its current deduction behavior intact. Finished meads reuse
the existing stock balance, operations, and quantity ledger. One account-owned
`inventory_meads` entry groups count-stock rows by bottle capacity. Each capacity
has one stable stock identity within an entry. Internal production provenance
will be added with bottling integration rather than guessed from manual stock.

Counts are whole bottles; capacity is a positive volume with six-place precision
in liters. Each mutation checks a revision of the reviewed entry, uses an
account-scoped retry operation, and writes balances and history atomically.
Existing consumables endpoints cannot modify finished stock; use the grouped
finished-mead endpoints so revisions and later allocations stay consistent.

Premium owners can manage entries. Active owners keep read-only access and
retained history after expiry. Archival hides an entry and retains all counts and
history. The guarded local seed includes a mixed-size entry and cleans records
in foreign-key order. Local development uses schema push without a reset; the
new production migration is reviewed and verified on a disposable database.

## Phase 2: find and organize the collection

Experience: give consumables and finished meads multiple custom labels, place
stock in meaningful storage areas and boxes, and find it using removable filter
pills. Apply several ordered sorting rules, each with its own direction, and
retain those preferences between visits. Support keyboard reordering as well as
pointer interactions.

Keep underlying stock types separate from user-defined categories/tags. Define
explicit any/all matching for selected labels. Storage areas support parents and
optional position notes. Stock may be split across locations; unlocated stock
remains valid. Moves preserve total stock and retain movement history. Consuming
or correcting counts updates allocations atomically, and deleting a location
requires resolving its remaining allocations. Storage is separate from brewing
vessel occupancy.

## Phase 3: connect bottling to inventory

Experience: review packaging use and finished bottles in the bottling flow, then
create entries, add to compatible entries, or split output between entries and
locations. Distinguish correcting an existing bottling from recording another.

Add durable packaging-row identities and internal production links. A single
transaction saves packaging, related volume changes, optional bottle/closure
deductions, finished output, allocations, and audit/retry records. Produce counts
from confirmed bottle rows rather than a volume estimate. Corrections apply the
production difference while retaining later uses and moves. Impossible reductions
or size changes need explicit reconciliation. Completion/reopening never creates
duplicate stock. Brew deletion retains finished stock and source snapshots.
Removing erroneous packaging explicitly resolves input and output movements.
Older packaging can be added only through review of the bottles still on hand.
Expiry preserves stock and flags affected source changes for reconciliation;
renewal never silently backfills inventory.

## Phase 4: transfer and complete the full experience

Experience: import an existing collection or export a useful backup containing
finished-mead details, labels, and storage allocations alongside consumables.
Preserve current consumables file compatibility. Complete end-to-end checks
across manual stock, bottling, moves, consumption, corrections, source deletion,
expiry, and restore. Retain private stock/location data outside public brew-entry
JSON. Update API contracts, OpenAPI, seeds, migrations, and documentation together.

Cost tracking and arbitrary custom fields are separate follow-ups.
