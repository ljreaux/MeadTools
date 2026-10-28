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
Phase 2 below.

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

Implemented for review on October 26, 2026. The shared domain suite
has 40 passing tests; the PostgreSQL suite has 80 passing transaction/handler
tests, including owner isolation, concurrent edits, safe retries, allocation
reductions, source selection, audit rollback, hierarchy changes, expiry and seed
behavior. All 55 API contract tests, 3 translation tests, relevant workspace
typechecks, package boundaries and migration constraints pass. Targeted lint has
no errors (the shared SearchableInput retains its existing state-in-effect
warning). A separate additive production migration preserves Phase 1 history.

Browser checks on the user's existing server covered category creation and
assignment, nested storage, keyboard selection, saved any/all category filters,
parent-location filtering, pointer/keyboard/explicit-button sort reordering,
preferences after reload, source-specific bottle use, retained movement history,
and the 390 px mobile workspace/dialog. The review example has 11 × 750 mL bottles,
two categories and two bottles in Cellar → Box A2 at position A1–A3; nine remain
unlocated. The existing server was restarted by Larry to load the generated
database client. No extra server or local data reset was used.

Review focus: do category/filter pills and ordered sorting feel flexible, and is
it clear that placing or moving bottles changes storage while Use bottles changes
the collection's total? Phase 3 bottling integration is described below.

Experience: give consumables and finished meads multiple custom labels, place
stock in meaningful storage areas and boxes, and find it using removable filter
pills. Retain those preferences between visits. The October 28 corrective review
simplifies sorting to one field and direction after user review of multiple rules.

Keep underlying stock types separate from user-defined categories/tags. Define
explicit any/all matching for selected labels. Storage areas support parents and
optional position notes. Stock may be split across locations; unlocated stock
remains valid. Moves preserve total stock and retain movement history. Consuming
or correcting counts updates allocations atomically, and deleting a location
requires resolving its remaining allocations. Storage is separate from brewing
vessel occupancy.

The Inventory workspace now includes Storage & categories for creating, renaming
and archiving categories and nested storage locations. Each stock card has an
Organize action with category assignment, storage positions and movement history.
Finished-mead categories apply to the user's grouping, while each bottle size has
its own allocations. Position text remains optional and free-form; no lot or
box-coordinate format is imposed.

Consumables and finished meads have separate account-scoped browser preferences.
Search covers names, notes, categories and location paths. Filters include stock
type, multiple categories with any/all matching, parent or individual locations,
and availability. Sorting now uses a single shared Select and a direction toggle. Amount sorting converts
compatible units and keeps mass, volume and counts in separate groups.

Storage edits replace a reviewed allocation snapshot atomically without changing
stock totals. Stale revisions require reopening the editor. Manual use optionally
selects unlocated stock or a particular location/position. Automatic use and count
corrections draw from unlocated stock first, then locations in path/position order.
Receipts and reversals return stock to unlocated rather than guessing its physical
position. Every changed allocation records a retained location-path snapshot.
Locations with stock or active children, and stock with allocations, cannot be
archived until resolved. Read-only access after expiry retains organization and
history. Production constraints enforce ownership, units, positive allocations and
valid label targets; transactions enforce totals and whole bottle counts.

## Phase 3: connect bottling to inventory

Implemented for review on October 27, 2026. Validation passed: 43 shared inventory
tests, 32 brew-domain tests, 57 API contract tests, 98 PostgreSQL transaction/route
tests, 11 targeted web bottling/baseline tests and 3 translation tests. Relevant
workspace typechecks, targeted lint, package boundaries, migration constraints and
Prisma schema parity passed. The generated OpenAPI change was reviewed alongside
the API contract and historical endpoint checks.

Browser checks on a separate review brew covered mixed sizes, splitting output
between a new and an existing entry, initial Box A2 placement, measured yield
independent of nominal capacity, later bottle use, an output correction preserving
that use, the separate-new-bottling/reset action, retained history/source links
and a 390 px mobile review. The review collection now contains two 375 mL bottles
in Cellar → Box A2 at B1–B2 and one unlocated 750 mL bottle. Its source records five
produced bottles across the two entries and a measured 2.95 L yield; the new entry
has three remaining after a use and correction. A temporary webpack preview was
used and stopped after checking. No development database reset or full seed run
was used.

Inventory-enabled packaging saves now
open a review of finished bottles, target entries, added-bottle storage and
resulting on-hand balances. Finished output remains optional. Multiple bottle
sizes can share an entry or split between existing entries and a new entry. The
packaged-stage form distinguishes correcting its latest record from recording
another bottling, and preserves the saved date and note when beginning an edit.

Bottle and closure rows now retain UUIDs. Legacy input-deduction keys remain
readable; a reviewed packaging edit upgrades closure keys without changing the
meaning of prior deductions. Converted capacities use the inventory's six-place
liter identity and remain intact when reopening custom bottle rows.

The premium review uses one account-serialized retry operation for packaging,
optional supply deductions, measured yield and its related volume/ABV history,
finished stock, storage movements and audit records. Counts come from confirmed
whole-bottle rows, independently of measured yield. A repeated save with the same
operation cannot add the output twice. Corrections apply only the production
difference; later uses and receipts remain reflected in the balance. A reduction
cannot consume bottles still assigned to storage. Added bottles are placed in
listed order, up to the positive production difference; prior moves stay intact.

Private production records retain source IDs, a name and a packaging snapshot;
quantity-ledger rows retain an owned foreign key to that source even when output
links are removed. Finished-mead history links to a live source or displays its
retained name after removal. None of the output selections, stock identities or
locations are written into public timeline data. Brew deletion preserves finished
stock and provenance. Explicit packaging removal reviews output reversal and
returns tracked supplies in the same transaction. Completing/reopening a brew
does not produce bottles.

Older untracked packaging needs confirmation of the bottles still on hand before
receiving stock. Existing tracked supplies are not retroactively inferred. If a
source changes through the legacy/free path after premium expires, counts and
storage are retained and a reconciliation warning is recorded. Renewal never
replays output. The review's Keep reviewed on-hand counts mode links existing,
physically reviewed inventory without a receipt. Its produced-count baseline may
exceed the remaining stock because previously used bottles stay used. A removed source can be
acknowledged from Finished meads after correcting physical counts; this clears
the warning while preserving stock and source history.

The additive production migration includes ownership, quantity and retained
history constraints. The guarded local seed attributes existing sample bottles
to an example bottling without receiving them again. Local schema push preserved
data; the main seed and reset were not run. The prior filter cleanup is included
in this phase's local commit.

Review focus: is the difference between supplies used, bottles produced and
bottles still on hand clear? Does correcting a record feel distinct from another
bottling, and do the balance preview and reconciliation choices explain changes
before saving? Import/export and the final cross-flow review remain Phase 4.

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


## Corrective review: simpler controls, bottle units and storage audit

October 28, 2026: replace the searchable filter picker with grouped checkbox
sections for item type, categories and locations, plus availability. Active
filter pills and category any/all matching remain. Sorting is one select and
one direction toggle; previously saved multi-sort browser preferences are
normalized so invisible secondary rules cannot affect the list.

Packaging review and supply-use labels retain selected preset/custom units.
Custom bottle edits restore their original amount/unit when those agree with
the saved canonical liters. Manual entries and bottling outputs retain the
entered amount/unit on the existing stock row. Inventory, history and storage
render that size directly; there is no display-unit selector or unit preference.
Mixed units coexist within one collection. Existing capacity merges retain the
first size label, while older records with no entered-size metadata show their
canonical liters. The two nullable scalar fields are added to the undeployed
finished-mead migration in place. No new table or migration is added.

The [storage audit](../reviews/inventory-storage-audit.md) covers all 14
inventory/equipment tables, growth drivers, retry/history retention, and the
limits of a code-only audit. History now selects only the source metadata it
renders instead of reading complete bottling snapshots. No table consolidation
or additional migration file is justified by this review alone. Feature migrations are
undeployed, per the owner, and may be edited in place if the schema changes;
the finished-mead migration is updated in place. No local reset or migration was run; schema push preserved existing local data.

Verification: 46 inventory-domain, 100 PostgreSQL integration, 58 API-contract,
5 bottle-format/edit and 3 translation tests passed (212 total). The edited
migration and full inventory constraints passed on disposable schemas. Targeted
lint and web/domain/contract type checks passed. Desktop and 390px mobile filter/sort keyboard checks
passed, including Escape focus return and no horizontal overflow. After the user
restarted their server, the preview verified a mixed collection of 12 fl oz and
750 mL bottles, retained receipt/use selectors, successful bottle use, history,
and storage choices. A separate review brew verified both selected sizes in
the bottling confirmation, its after-save preview, and the saved inventory
collection. No private server was
started. Local review examples are named Mixed bottle sizes — review and
Bottling sizes — review.
Previous seed changes remain separate, uncommitted work.
Imports/exports remain the next planned phase.
