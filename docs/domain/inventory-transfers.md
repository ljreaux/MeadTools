# Inventory collection workbooks

Open Inventory → Import & export collection to download a complete current-stock
workbook or a blank template. The existing consumables CSV/XLSX tools remain
under Consumables → Import & export consumables.

Collection workbooks contain six editable data sheets plus Instructions. Keep
their sheet names and headers, including empty sheets. Enter literal values;
formulas, macros and external workbook links are rejected. Numbers use a decimal
point. New collections need only bottle size, unit and count; liter conversion
is automatic when the canonical capacity cell is blank.

| Sheet | What it contains |
| --- | --- |
| Consumables | One stock item per row, quantities in the chosen unit, optional catalog links and notes |
| Finished meads | One row per bottle size, grouped by Mead key; entered bottle sizes/units and counts |
| Categories | Custom categories, independent of consumable types |
| Locations | Storage locations with optional Parent keys |
| Assignments | Category keys linked to a consumable (`stock`) or finished-mead (`mead`) key |
| Storage | Consumable or Bottle key, location key, optional position, quantity in the stock unit |

Keys can be any unique text, such as `pie-1`, `bottle-12oz`, or `cellar`. Different
mead keys keep same-name entries separate; repeating one mead key groups its
sizes. Bottle and consumable keys share a namespace. A bottle size can have
several storage positions; its unallocated remainder is unlocated. Exported
canonical liters preserve existing identities and nominal size presets; retain
those cells when restoring an export. Original bottle units are never replaced
with a global display preference.

Import shows the entry names, notes, quantities, sizes, categories and storage
positions for review. Confirmation **adds new stock entries**, even if names
match. It never overwrites existing quantities. Categories with matching names
and locations with matching names under the same parent are reused within the
destination account. Exported database IDs are treated only as workbook keys;
the imported entries receive new identities. A retry from the same review cannot
add the stock twice. Starting another import is a separate action and can create
duplicates; the review requires acknowledging this.

The workbook represents active stock and organization. It excludes archived
records, adjustment history, equipment, brew links, bottling source snapshots and
browser filter preferences. Imported stock begins with receipt and movement
history; it does not reproduce past bottling output or supply deductions. This
keeps transfers independent of another account's brewing records. A full database
backup is still required to recover those histories and relationships.

Limits: 5 MB XLSX, 1,000 combined consumable/bottle stock rows, 50 sizes per mead,
1,000 rows in each organization sheet, 50 category assignments per entry and
100 storage positions per stock row. Export validates the same bounds and never
silently truncates stock. Active owners can export after premium expires; imports
and workbook inspection require premium.

No schema changes, tables or migrations are required for collection transfer.
All writes use the existing account lock, retry operations, balance ledger,
category links, storage allocations and movement ledger. Failure rolls back the
entire import, including newly created organization and its operation receipt.
