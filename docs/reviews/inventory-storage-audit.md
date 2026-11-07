# Inventory storage audit — October 28, 2026

## Scope and decision

Review of the current Prisma schema and inventory write/read paths, including
issue #479. The schema has 68 models. Inventory and equipment together account
for 14 tables; their four feature migrations have not been deployed, per the
owner. Local development uses schema resets/push, not migration history.
If the feature schema changes before release, edit those existing undeployed
migrations alongside schema.prisma rather than layering corrective migrations.

This is a code/design audit, not a measurement of production disk usage or
PostgreSQL dead tuples. Table count alone does not establish storage bloat.
No production database was queried. Bottle units require two nullable scalar fields on the existing stock table:
`bottle_size_value` and `bottle_size_unit`. They retain what was entered alongside
canonical liters. The undeployed finished-mead migration is edited in place;
there is no new table or migration. Existing source rows already retain selected
bottle metadata in packaging JSON.

## Table-by-table assessment

| Table | Purpose and growth | Recommendation |
| --- | --- | --- |
| inventory_stock | One supply item or one capacity within a finished collection; counts are balances, not individual bottles | Keep; existing shared stock table already avoids separate bottle-item tables |
| inventory_meads | User-named collection, independent of a brew or compulsory lot | Keep; necessary for flexible grouping |
| inventory_labels | User-created categories | Keep; bounded by user organization |
| inventory_label_links | Category membership of supplies/collections | Keep; many-to-many association, not duplicated category documents |
| inventory_locations | User-created storage tree | Keep; distinct ownership and parent constraints |
| inventory_allocations | Current stock count at location/position | Keep; mutable current state, not another history stream |
| inventory_consumptions | Current deduction per brew entry/line, retained after removal | Keep; supports corrections and prevents returning ingredients twice |
| inventory_bottlings | One retained source identity and current snapshot per bottling | Keep; snapshot is overwritten on correction, not appended every edit |
| inventory_productions | Current source-row-to-stock output totals | Keep; permits splits and several bottlings in a collection; replaced on correction |
| inventory_adjustments | Append-only count changes | Keep; main inventory audit growth, per affected stock/action, not per physical bottle |
| inventory_storage_events | Append-only placement/move deltas and historical location names | Keep for storage history; moves are the growth driver |
| inventory_operations | Unique request identity/hash and saved retry result | Keep; grows per successful tracked operation; results are generally IDs/balances/status, not full inventory exports |
| equipment | One reusable tool/vessel, with current occupancy | Keep; count follows equipment owned |
| equipment_assignment_events | Assignment/release history with retry identities | Keep; grows per assignment, not per viewing or reading |

Merging unrelated history/association tables into one JSON table would reduce
table count while weakening foreign keys, ownership checks, and query clarity.
The audit found no consolidation whose benefit justifies that tradeoff now.

## Concrete findings and changes

- Finished-mead history previously loaded the complete bottling snapshot for
  every adjustment returned (up to 101), although it only renders source name,
  IDs and removal status. Its query now selects those four fields. This reduces
  database-to-server payload and memory, not stored disk bytes.
- Source snapshots duplicate packaging context deliberately so source deletion
  does not destroy history. They are one current snapshot per bottling. Keep
  them; do not describe them as a new full snapshot per correction.
- Retry results are mostly compact. Keep the deduplication identity/hash even
  if a future optimization compacts old response data. Blindly deleting old
  operations could make a late retry apply a second stock change; adjustment
  and storage-event foreign keys also depend on these rows.
- Compound unique keys that include owner/unit support foreign-key enforcement.
  They are not automatically redundant merely because IDs are already unique.
  Do not drop them from an index-count-only review.
- Filters/sorting already live in account-scoped browser preferences. Bottle
  sizes are intrinsic stock metadata, not browser preferences: 12 fl oz stays
  12 fl oz and 750 mL stays 750 mL in the same collection. Two scalar fields
  preserve that metadata; existing stock merging retains the first recorded
  size label. Old records without metadata use their canonical liters explicitly.
  No per-bottle rows, preference table, or extra history stream is added.

## Before further expansion

Measure table/index/TOAST sizes, live/dead tuples, average snapshot/result sizes,
row counts and high-volume query plans on a representative database. Review
account deletion/export and historical retention together. Any retention policy
must preserve correction, source-removal and retry semantics; there is no new
automatic purge in this slice. A project-wide storage audit should separately
cover chat messages, model usage, credit ledgers, webhook deliveries and image
metadata rather than attributing all future growth to inventory.

Collection overview queries currently return the whole owned collection.
Pagination/aggregation is a separate scaling concern to address with measured
collection sizes; do not add another table as a substitute.
